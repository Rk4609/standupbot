/**
 * Seed 50 demo employees, spread across the existing teams, each with a few
 * weeks of standups so the roster and dashboards have something to show.
 *
 *   node scripts/seed-employees.js          # create
 *   node scripts/seed-employees.js --clear  # remove everything it created
 *
 * Everything it writes carries `isDemo: true` and a @demo.standupbot.local
 * address, so --clear can remove exactly the seeded rows and nothing else.
 */
require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../models/User')
const Team = require('../models/Team')
const Standup = require('../models/Standup')

const DEMO_DOMAIN = 'demo.standupbot.local'
const COUNT = 50
const WEEKS = 4
const DEFAULT_PASSWORD = 'demo1234'

const FIRST = [
  'Aarav', 'Diya', 'Vihaan', 'Ananya', 'Arjun', 'Ishita', 'Reyansh', 'Saanvi',
  'Kabir', 'Aditi', 'Vivaan', 'Myra', 'Advik', 'Kiara', 'Rudra', 'Anika',
  'Krishna', 'Navya', 'Ayaan', 'Prisha', 'Dhruv', 'Riya', 'Aryan', 'Tara',
  'Ishaan', 'Meera', 'Atharv', 'Sara', 'Shaurya', 'Avni', 'Neel', 'Zoya',
  'Yash', 'Nitya', 'Om', 'Pari', 'Kian', 'Aisha', 'Veer', 'Mahi',
  'Rehan', 'Siya', 'Arnav', 'Ira', 'Laksh', 'Trisha', 'Samar', 'Nikita',
  'Devansh', 'Kavya'
]
const LAST = [
  'Sharma', 'Verma', 'Patel', 'Reddy', 'Nair', 'Iyer', 'Gupta', 'Mehta',
  'Joshi', 'Kulkarni', 'Rao', 'Das', 'Bose', 'Chauhan', 'Malhotra', 'Sethi',
  'Bhat', 'Pillai', 'Kaur', 'Jangid'
]

const SHIPPED = [
  'Finished the invoice export and added tests',
  'Fixed the pagination bug on the orders list',
  'Reviewed two PRs and merged the auth refactor',
  'Wrote the migration for the new schema fields',
  'Cleaned up the dashboard queries, ~40% faster',
  'Shipped the empty states across the settings pages',
  'Paired on the webhook retry logic',
  'Closed out the accessibility issues from the audit',
  'Updated the deployment docs',
  'Investigated the flaky integration test'
]
const PLANNED = [
  'Start the CSV import flow',
  'Finish the search filters and get them reviewed',
  'Break down the reporting epic into tickets',
  'Add rate limiting to the public endpoints',
  'Write the runbook for on-call',
  'Pick up the mobile layout bugs',
  'Set up the staging environment',
  'Refactor the notification service',
  'Draft the API docs for the new endpoints',
  'Work through the backlog of small UI fixes'
]
const BLOCKERS = [
  'Waiting on API credentials from the platform team',
  'Blocked on the staging database being down',
  'Need a design review before I can continue',
  'Waiting for the security sign-off',
  'Dependent on the upstream service fix'
]
const MOODS = ['great', 'good', 'good', 'good', 'okay', 'okay', 'bad', 'stressed']

const pick = (arr, i) => arr[i % arr.length]
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)]

/** Weekday ISO dates going back `weeks` weeks, newest first. */
const workingDays = (weeks) => {
  const dates = []
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  for (let i = 0; i < weeks * 7; i++) {
    const day = new Date(d.getTime() - i * 86_400_000)
    const dow = day.getDay()
    if (dow !== 0 && dow !== 6) dates.push(day.toISOString().split('T')[0])
  }
  return dates
}

const clear = async () => {
  const demoUsers = await User.find({ email: new RegExp(`@${DEMO_DOMAIN}$`) }).select('_id')
  const ids = demoUsers.map(u => u._id)

  const standups = await Standup.deleteMany({ user: { $in: ids } })
  await Team.updateMany({}, { $pull: { members: { $in: ids } } })
  const users = await User.deleteMany({ _id: { $in: ids } })

  console.log(`Removed ${users.deletedCount} demo employees and ${standups.deletedCount} standups.`)
}

const seed = async () => {
  const existing = await User.countDocuments({ email: new RegExp(`@${DEMO_DOMAIN}$`) })
  if (existing > 0) {
    console.log(`${existing} demo employees already exist. Run with --clear first to reseed.`)
    return
  }

  const teams = await Team.find().select('_id name')
  if (teams.length === 0) console.log('No teams found — employees will be created without one.')

  const dates = workingDays(WEEKS)
  const created = []

  for (let i = 0; i < COUNT; i++) {
    const first = pick(FIRST, i)
    const last = pick(LAST, Math.floor(i / 3) + i)
    const team = teams.length ? teams[i % teams.length] : null

    // Each user is saved individually so the model's password hashing hook runs
    const user = await User.create({
      name: `${first} ${last}`,
      email: `${first}.${last}.${i + 1}`.toLowerCase() + `@${DEMO_DOMAIN}`,
      password: DEFAULT_PASSWORD,
      role: 'employee',
      team: team?._id || null
    })

    if (team) await Team.updateOne({ _id: team._id }, { $addToSet: { members: user._id } })
    created.push(user)
  }

  console.log(`Created ${created.length} demo employees.`)

  // Standups: most people submit most days, a few are patchy
  const standups = []
  for (const [i, user] of created.entries()) {
    const reliability = 0.45 + ((i * 37) % 55) / 100 // 0.45 – 0.99, stable per user
    let streak = 0

    for (const date of dates) {
      if (Math.random() > reliability) continue

      const hasBlocker = Math.random() < 0.14
      standups.push({
        user: user._id,
        team: user.team,
        yesterday: rand(SHIPPED),
        today: rand(PLANNED),
        blockers: hasBlocker ? rand(BLOCKERS) : 'None',
        hasBlocker,
        mood: rand(MOODS),
        date
      })
      if (date === dates[streak]) streak++
    }

    await User.updateOne(
      { _id: user._id },
      { streak, lastSubmission: streak ? new Date() : null }
    )
  }

  await Standup.insertMany(standups, { ordered: false })
  console.log(`Created ${standups.length} standups across the last ${WEEKS} weeks.`)
  console.log(`\nAll demo accounts use the password: ${DEFAULT_PASSWORD}`)
}

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set')

  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to', mongoose.connection.host)

  if (process.argv.includes('--clear')) await clear()
  else await seed()

  await mongoose.disconnect()
}

run().catch(err => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
