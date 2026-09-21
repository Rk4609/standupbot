/**
 * A manager account somebody can actually sign in as, with a team under them.
 *
 *   node scripts/seed-demo-manager.js          # create or top up
 *   node scripts/seed-demo-manager.js --clear  # remove exactly what it made
 *
 * Everything here is additive: a new team, four new accounts and their own
 * standups. Nobody is moved off AIML or MERN, because a demo login is not
 * worth rewriting the history those two teams already have.
 *
 * The password is the same one the other demo accounts use.
 */
require('dotenv').config()
const mongoose = require('mongoose')
const connectDB = require('../config/db')
const Standup = require('../models/Standup')
const Team = require('../models/Team')
const User = require('../models/User')

const PASSWORD = 'demo1234'
const TEAM_NAME = 'Demo squad'

const MANAGER = {
  name: 'Demo Manager',
  email: 'manager.demo@demo.standupbot.local',
  position: 'Engineering manager',
  employeeId: 'EMP-100',
  salary: 2_100_000
}

const PEOPLE = [
  { name: 'Ira Menon', email: 'ira.menon@demo.standupbot.local', position: 'Frontend engineer', type: 'full-time', salary: 1_150_000, experience: 3 },
  { name: 'Yash Kulkarni', email: 'yash.kulkarni@demo.standupbot.local', position: 'Backend engineer', type: 'full-time', salary: 1_280_000, experience: 4.5 },
  { name: 'Riya Das', email: 'riya.das@demo.standupbot.local', position: 'QA engineer', type: 'probation', salary: 720_000, experience: 1 },
  { name: 'Om Prakash', email: 'om.prakash@demo.standupbot.local', position: 'Frontend intern', type: 'intern', salary: 240_000, experience: 0 }
]

const PLANS = [
  'Finish the search filters and get them reviewed',
  'Pair on the export job, then pick up the flaky test',
  'Write the migration and dry-run it against staging',
  'Clear the review comments and cut a release candidate',
  'Take the on-call handover and work through the alerts'
]

const BLOCKERS = [
  'Waiting on staging credentials from the platform team',
  'Blocked on the client signing off the copy'
]

const ALL_EMAILS = [MANAGER.email, ...PEOPLE.map(p => p.email)]

const daysAgo = (n) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}

const isoDaysAgo = (n) => daysAgo(n).toISOString().slice(0, 10)

const clear = async () => {
  const users = await User.find({ email: { $in: ALL_EMAILS } }).select('_id').lean()
  const ids = users.map(u => u._id)

  const standups = await Standup.deleteMany({ user: { $in: ids } })
  const removed = await User.deleteMany({ _id: { $in: ids } })
  const team = await Team.deleteOne({ name: TEAM_NAME })

  console.log(`Removed ${removed.deletedCount} accounts, ${standups.deletedCount} standups`)
  console.log(`Removed ${team.deletedCount} team`)
}

const run = async () => {
  await connectDB()

  if (process.argv.includes('--clear')) {
    await clear()
    await mongoose.disconnect()
    return
  }

  /* ---- the manager and their team ---------------------------------- */

  let manager = await User.findOne({ email: MANAGER.email })
  if (!manager) {
    manager = await User.create({
      name: MANAGER.name,
      email: MANAGER.email,
      password: PASSWORD,
      role: 'manager',
      phone: '+91 90111 22233',
      dob: new Date('1990-02-17'),
      address: {
        line1: '22 Civil Lines', city: 'Jaipur', state: 'Rajasthan',
        pincode: '302006', country: 'India'
      },
      employment: {
        employeeId: MANAGER.employeeId,
        position: MANAGER.position,
        department: 'Engineering',
        type: 'full-time',
        joinedOn: new Date('2024-02-01'),
        experienceYears: 7
      },
      salary: { amount: MANAGER.salary, currency: 'INR', period: 'year', reviewedOn: daysAgo(160) }
    })
  }

  let team = await Team.findOne({ name: TEAM_NAME })
  if (!team) {
    team = await Team.create({ name: TEAM_NAME, manager: manager._id, members: [] })
  } else {
    await Team.updateOne({ _id: team._id }, { manager: manager._id })
  }

  await User.updateOne({ _id: manager._id }, { team: null })

  /* ---- four people under them --------------------------------------- */

  const created = []
  for (const [i, p] of PEOPLE.entries()) {
    let person = await User.findOne({ email: p.email })
    if (!person) {
      const temporary = ['intern', 'probation'].includes(p.type)

      person = await User.create({
        name: p.name,
        email: p.email,
        password: PASSWORD,
        role: 'employee',
        team: team._id,
        phone: `+91 9${String(80000000 + i * 137911).slice(0, 8)}`,
        dob: new Date(1996 + i, (i * 3) % 12, 4 + i),
        address: {
          line1: `${12 + i * 7} Station Road`,
          city: 'Jaipur',
          state: 'Rajasthan',
          pincode: '302006',
          country: 'India'
        },
        employment: {
          employeeId: `EMP-10${i + 1}`,
          position: p.position,
          department: p.position.includes('QA') ? 'Quality' : 'Engineering',
          type: p.type,
          joinedOn: daysAgo(temporary ? 40 + i * 10 : 300 + i * 90),
          startsOn: temporary ? daysAgo(40 + i * 10) : null,
          // An intern who runs out inside the month, so the warning on the
          // records screen has something real to point at
          endsOn: temporary ? daysAgo(-20 - i * 25) : null,
          experienceYears: p.experience
        },
        salary: { amount: p.salary, currency: 'INR', period: 'year', reviewedOn: daysAgo(90) }
      })
      created.push(person)
    }

    await Team.updateOne({ _id: team._id }, { $addToSet: { members: person._id } })
    await User.updateOne({ _id: person._id }, { team: team._id })
  }

  /* ---- a week of standups, so the team screens are not empty --------- */

  const members = await User.find({ email: { $in: PEOPLE.map(p => p.email) } })
    .select('_id').lean()

  const dates = [1, 2, 3, 4, 5]
    .map(isoDaysAgo)
    .filter(d => ![0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay()))

  const docs = []
  for (const [i, person] of members.entries()) {
    for (const [d, date] of dates.entries()) {
      // Somebody misses a day, like a real week
      if (i === 2 && d === 1) continue

      const hasBlocker = i === 0 && d >= 2
      docs.push({
        user: person._id,
        team: team._id,
        yesterday: '',
        today: PLANS[(i + d) % PLANS.length],
        blockers: hasBlocker ? BLOCKERS[i % BLOCKERS.length] : 'None',
        hasBlocker,
        mood: ['great', 'good', 'good', 'okay'][(i + d) % 4],
        date
      })
    }
  }

  let filed = 0
  if (docs.length > 0) {
    const existing = await Standup.find({
      user: { $in: members.map(m => m._id) },
      date: { $in: dates }
    }).select('user date').lean()

    const taken = new Set(existing.map(s => `${s.user}:${s.date}`))
    const fresh = docs.filter(d => !taken.has(`${d.user}:${d.date}`))

    if (fresh.length > 0) await Standup.insertMany(fresh, { ordered: false })
    filed = fresh.length
  }

  console.log(`Manager: ${MANAGER.email} / ${PASSWORD}`)
  console.log(`Team "${TEAM_NAME}" with ${PEOPLE.length} people (${created.length} newly created)`)
  console.log(`Filed ${filed} standups across ${dates.length} weekdays`)

  await mongoose.disconnect()
}

run().catch(async (err) => {
  console.error(err)
  await mongoose.disconnect()
  process.exit(1)
})
