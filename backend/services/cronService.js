const cron = require('node-cron')
const User = require('../models/User')
const Standup = require('../models/Standup')
const Team = require('../models/Team')
const Retro = require('../models/Retro')
const { sendReminderEmail, sendManagerSummary, sendRetroEmail } = require('./emailService')
const { completeChat } = require('./groqService')
const {
  collectWeek,
  summarise,
  buildPrompt,
  previousRetro,
  SYSTEM_PROMPT
} = require('../controllers/retroController')
const { resolveWeek, previousWeek } = require('../utils/week')
const { hourIn, todayIn, weekdayIn, zoneOf } = require('../utils/time')
const slack = require('./slackService')
const { notify } = require('./notifyService')
const { writeBrief, resolveScope } = require('../controllers/briefController')
const { writeReport, weekOf } = require('../controllers/weeklyReportController')

/**
 * The hours, in each person's own zone, at which the two daily jobs fire.
 *
 * These used to be cron expressions pinned to Asia/Kolkata, so a person in
 * London was nudged at 3:30am and a manager in New York got the day's summary
 * before lunch. The schedules below now run every hour and each job asks, per
 * person, whether it is that hour where they are.
 */
const REMINDER_HOUR = 9
const SUMMARY_HOUR = 18
// Late enough that the morning's standups and check-ins are in
const BRIEF_HOUR = 11
// Friday afternoon, before the retro at half past six
const REPORT_HOUR = 17

/** Monday to Friday where this person is — nobody wants a Saturday nudge. */
const isWorkday = (zone, at) => {
  const day = weekdayIn(zone, at)
  return day >= 1 && day <= 5
}

/** Generate, persist and email one team's weekly retro. */
const runRetroForTeam = async (team, week) => {
  const standups = await collectWeek(team._id, week)
  if (standups.length === 0) {
    console.log(`No standups for ${team.name} — skipping retro`)
    return
  }

  const stats = summarise(standups, team.members?.length || 0)

  const prev = previousWeek(new Date(week.weekStart))
  const previousBlockers = (await collectWeek(team._id, prev))
    .filter(s => s.hasBlocker)
    .map(s => ({ member: s.user?.name || 'Unknown', blocker: s.blockers }))

  // The Friday job writes the same report the page does, so it has to read
  // last week's too or the two would disagree about what was promised
  const lastRetro = await previousRetro(team._id, week)

  const content = await completeChat({
    system: SYSTEM_PROMPT,
    prompt: buildPrompt({
      teamName: team.name,
      week,
      standups,
      stats,
      previousBlockers,
      lastRetro
    }),
    maxTokens: 2000
  })

  if (!content.trim()) {
    console.log(`Empty retro for ${team.name} — not saving`)
    return
  }

  const { byMember, ...persisted } = stats

  await Retro.findOneAndUpdate(
    { team: team._id, weekStart: week.weekStart },
    {
      team: team._id,
      teamName: team.name,
      ...week,
      content,
      stats: persisted,
      generatedBy: null
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  await slack.notifyTeam(
    team._id,
    'weeklyRetro',
    slack.retroMessage(team.name, week, content)
  )

  if (team.manager?.email) {
    await sendRetroEmail(
      team.manager.email,
      team.manager.name,
      team.name,
      week,
      content,
      persisted
    )
  }

  console.log(`✅ Retro generated for ${team.name}`)
}

const startCronJobs = () => {
  // console.log('✅ Cron jobs registered!')

  // ⏰ Morning Reminder — 9am on a weekday, wherever the person is
  cron.schedule('0 * * * *', async () => {
    try {
      const at = new Date()
      const members = await User.find({ role: 'employee' })

      // A blank zone reads as UTC, so an account that never chose one still
      // gets exactly one reminder a day rather than none
      const due = members.filter(m => {
        const zone = zoneOf(m)
        return hourIn(zone, at) === REMINDER_HOUR && isWorkday(zone, at)
      })
      if (due.length === 0) return

      console.log(`⏰ Morning reminder — ${due.length} due this hour`)

      for (const member of due) {
        const submitted = await Standup.findOne({
          user: member._id,
          date: todayIn(zoneOf(member), at)
        })
        if (submitted) continue

        try {
          await sendReminderEmail(member.email, member.name)
          console.log(`Reminder sent to → ${member.email}`)
        } catch (err) {
          // One bad address must not stop the rest of the round
          console.error(`Reminder failed for ${member.email}:`, err.message)
        }
      }
    } catch (err) {
      console.error('Reminder cron error:', err)
    }
  })

  // 📋 EOD Summary — 6pm on a weekday in the manager's own zone
  cron.schedule('0 * * * *', async () => {
    try {
      const at = new Date()
      const teams = await Team.find().populate('manager', 'name email timezone')

      for (const team of teams) {
        if (!team.manager) continue

        // The summary lands at the end of the manager's day, since they are
        // the one reading it
        const zone = zoneOf(team.manager)
        if (hourIn(zone, at) !== SUMMARY_HOUR || !isWorkday(zone, at)) continue

        const today = todayIn(zone, at)

        const standups = await Standup.find({
          team: team._id,
          date: today
        }).populate('user', 'name')

        if (standups.length > 0) {
          await sendManagerSummary(
            team.manager.email,
            team.manager.name,
            standups,
            team.name
          )
          console.log(`Summary sent to → ${team.manager.email}`)
        }

        // The channel gets the digest whether or not anyone posted — "nobody
        // submitted today" is the message a team most needs to see
        await slack.notifyTeam(
          team._id,
          'dailySummary',
          slack.summaryMessage(
            team.name,
            today,
            standups,
            team.members?.length || standups.length
          )
        )
      }
    } catch (err) {
      console.error('EOD summary cron error:', err)
    }
  })

  // ☀️ Daily brief — 11am on a weekday in each manager's zone
  cron.schedule('5 * * * *', async () => {
    if (!process.env.GROQ_API_KEY) return
    try {
      const at = new Date()
      const teams = await Team.find({ manager: { $ne: null } }).populate('manager', 'name role timezone')

      for (const team of teams) {
        const manager = team.manager
        if (!manager) continue
        const zone = zoneOf(manager)
        if (hourIn(zone, at) !== BRIEF_HOUR || !isWorkday(zone, at)) continue

        try {
          const scope = await resolveScope(manager, team._id)
          if (scope.error || scope.people.length === 0) continue
          const today = todayIn(zone, at)
          await writeBrief({ ...scope, date: today, today })
          await notify(null, {
            recipient: manager._id,
            type: 'brief_ready',
            message: `Your morning brief for ${team.name} is ready`,
            link: '/brief'
          })
          console.log(`☀️ Brief written for ${team.name}`)
        } catch (err) {
          console.error(`Brief failed for ${team.name}:`, err.message)
        }
      }
    } catch (err) {
      console.error('Daily brief cron error:', err)
    }
  })

  // 📑 Weekly project report — 5pm on the manager's Friday
  cron.schedule('10 * * * *', async () => {
    if (!process.env.GROQ_API_KEY) return
    try {
      const at = new Date()
      const teams = await Team.find({ manager: { $ne: null } }).populate('manager', 'name role timezone')

      for (const team of teams) {
        const manager = team.manager
        if (!manager) continue
        const zone = zoneOf(manager)
        if (hourIn(zone, at) !== REPORT_HOUR || weekdayIn(zone, at) !== 5) continue

        try {
          const scope = await resolveScope(manager, team._id)
          if (scope.error || scope.people.length === 0) continue
          const today = todayIn(zone, at)
          await writeReport({ ...scope, week: weekOf(today), today })
          await notify(null, {
            recipient: manager._id,
            type: 'report_ready',
            message: `This week's project report for ${team.name} is ready to send`,
            link: '/reports'
          })
          console.log(`📑 Weekly report written for ${team.name}`)
        } catch (err) {
          console.error(`Weekly report failed for ${team.name}:`, err.message)
        }
      }
    } catch (err) {
      console.error('Weekly report cron error:', err)
    }
  })

  // 🗓️ Weekly Retro — 6:30pm on the manager's Friday, after their EOD summary
  cron.schedule('30 * * * *', async () => {
    try {
      const at = new Date()
      const week = resolveWeek(at)
      const teams = await Team.find().populate('manager', 'name email timezone')

      for (const team of teams) {
        const zone = zoneOf(team.manager)
        if (hourIn(zone, at) !== SUMMARY_HOUR || weekdayIn(zone, at) !== 5) continue

        try {
          await runRetroForTeam(team, week)
        } catch (err) {
          // One team's failure must not stop the rest
          console.error(`Retro failed for ${team.name}:`, err.message)
        }
      }
    } catch (err) {
      console.error('Weekly retro cron error:', err)
    }
  })

}

module.exports = { startCronJobs }