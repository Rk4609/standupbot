const cron = require('node-cron')
const User = require('../models/User')
const Standup = require('../models/Standup')
const Team = require('../models/Team')
const { sendReminderEmail, sendManagerSummary } = require('./emailService')

const startCronJobs = () => {
  console.log('✅ Cron jobs registered!')

  // ⏰ Morning Reminder — Every day at 9:00 AM IST (Mon-Fri)
  cron.schedule('30 3 * * 1-5', async () => {
    console.log('⏰ Morning reminder cron running...')
    try {
      const today = new Date().toISOString().split('T')[0]
      const members = await User.find({ role: 'member' })

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

}

module.exports = { startCronJobs }