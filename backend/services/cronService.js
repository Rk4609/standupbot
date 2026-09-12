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
  SYSTEM_PROMPT
} = require('../controllers/retroController')
const { resolveWeek, previousWeek } = require('../utils/week')
const { hourIn, todayIn, weekdayIn, zoneOf } = require('../utils/time')

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

  const content = await completeChat({
    system: SYSTEM_PROMPT,
    prompt: buildPrompt({
      teamName: team.name,
      week,
      standups,
      stats,
      previousBlockers
    }),
    maxTokens: 1800
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
      }
    } catch (err) {
      console.error('EOD summary cron error:', err)
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