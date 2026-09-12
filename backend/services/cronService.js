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

  // ⏰ Morning Reminder — Every day at 9:00 AM IST (Mon-Fri)
  cron.schedule('0 9 * * 1-5', async () => {
    console.log('⏰ Morning reminder cron running...')
    try {
      const today = new Date().toISOString().split('T')[0]
      const members = await User.find({ role: 'employee' })

      for (const member of members) {
        const submitted = await Standup.findOne({
          user: member._id,
          date: today
        })
        if (!submitted) {
          console.log(`Reminder sent to → ${member.email}`)
          await sendReminderEmail(member.email, member.name)
        } else {
          console.log(`${member.name} already submitted — skipping`)
        }
      }
      console.log('✅ Morning reminders completed!')
    } catch (err) {
      console.error('Reminder cron error:', err)
    }
  }, {
    timezone: 'Asia/Kolkata'
  })

  // 📋 EOD Summary — Every day at 6:00 PM IST (Mon-Fri)
  cron.schedule('0 18 * * 1-5', async () => {
    console.log('📋 EOD summary cron running...')
    try {
      const today = new Date().toISOString().split('T')[0]
      const teams = await Team.find().populate('manager', 'name email')

      for (const team of teams) {
        if (!team.manager) continue

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
      console.log('✅ EOD summaries completed!')
    } catch (err) {
      console.error('EOD summary cron error:', err)
    }
  }, {
    timezone: 'Asia/Kolkata'
  })

  // 🗓️ Weekly Retro — Friday 6:30 PM IST, after the EOD summary has gone out
  cron.schedule('30 18 * * 5', async () => {
    console.log('🗓️ Weekly retro cron running...')
    try {
      const week = resolveWeek(new Date())
      const teams = await Team.find().populate('manager', 'name email')

      for (const team of teams) {
        try {
          await runRetroForTeam(team, week)
        } catch (err) {
          // One team's failure must not stop the rest
          console.error(`Retro failed for ${team.name}:`, err.message)
        }
      }
      console.log('✅ Weekly retros completed!')
    } catch (err) {
      console.error('Weekly retro cron error:', err)
    }
  }, {
    timezone: 'Asia/Kolkata'
  })

}

module.exports = { startCronJobs }