/**
 * Seed the time-tracking side: projects, hours on the standups that already
 * exist, and a few weeks of timesheets in every state a manager will meet.
 *
 *   node scripts/seed-timesheets.js          # create
 *   node scripts/seed-timesheets.js --clear  # undo exactly this
 *
 * What --clear removes: the projects named below, every Timesheet row, and
 * the `work` entries on standups. Nothing else is touched — the standups
 * themselves, the users and the teams are left exactly as they were.
 *
 * Hours are attached to standups that already exist rather than invented
 * separately, because that is how the app works: a week's timesheet is built
 * from the days somebody actually reported.
 */
require('dotenv').config()
const mongoose = require('mongoose')
const connectDB = require('../config/db')
const Project = require('../models/Project')
const Standup = require('../models/Standup')
const StandupTemplate = require('../models/StandupTemplate')
const Team = require('../models/Team')
const Timesheet = require('../models/Timesheet')
const User = require('../models/User')
const { mondayOf, toISODate } = require('../utils/week')

/** Client work, one list per team, plus the shared ones everyone books to. */
const CLIENT_PROJECTS = [
  { name: 'Acme Retail — storefront rebuild', code: 'ACME', client: 'Acme Retail' },
  { name: 'Northwind — customer portal', code: 'NWND', client: 'Northwind Logistics' },
  { name: 'Meridian Bank — onboarding flow', code: 'MRDN', client: 'Meridian Bank' },
  { name: 'Kalpana Foods — inventory app', code: 'KLPN', client: 'Kalpana Foods' },
  { name: 'Sunrise Health — patient portal', code: 'SNRS', client: 'Sunrise Health' },
  { name: 'Vertex Labs — data pipeline', code: 'VRTX', client: 'Vertex Labs' }
]

/** Nobody's team and nobody's client, but the week does not add up without them. */
const SHARED_PROJECTS = [
  { name: 'Internal tooling', code: 'INT', client: '', billable: false },
  { name: 'Meetings and planning', code: 'MEET', client: '', billable: false },
  { name: 'Learning and training', code: 'LEARN', client: '', billable: false },
  { name: 'Leave', code: 'LEAVE', client: '', billable: false }
]

const ALL_NAMES = [...CLIENT_PROJECTS, ...SHARED_PROJECTS].map(p => p.name)

/** Deterministic pseudo-random, so re-running gives the same shape. */
const seeded = (n) => {
  const x = Math.sin(n) * 10000
  return x - Math.floor(x)
}

const pick = (list, n) => list[Math.floor(seeded(n) * list.length) % list.length]

const clear = async () => {
  const projects = await Project.find({ name: { $in: ALL_NAMES } }).select('_id').lean()

  const standups = await Standup.updateMany(
    { 'work.0': { $exists: true } },
    { $set: { work: [] } }
  )
  const sheets = await Timesheet.deleteMany({})
  const removed = await Project.deleteMany({ name: { $in: ALL_NAMES } })

  await StandupTemplate.updateMany({}, { $set: { trackTime: false } })

  console.log(`Cleared ${removed.deletedCount} projects (${projects.length} found)`)
  console.log(`Cleared hours from ${standups.modifiedCount} standups`)
  console.log(`Cleared ${sheets.deletedCount} timesheets`)
  console.log('Turned time tracking back off on every template')
}

const run = async () => {
  await connectDB()

  if (process.argv.includes('--clear')) {
    await clear()
    await mongoose.disconnect()
    return
  }

  const teams = await Team.find().populate('manager', 'name').lean()
  if (teams.length === 0) {
    console.error('There are no teams yet — nothing to seed against.')
    await mongoose.disconnect()
    process.exit(1)
  }

  /* ---- projects ---------------------------------------------------- */

  await Project.deleteMany({ name: { $in: ALL_NAMES } })

  const shared = await Project.insertMany(
    SHARED_PROJECTS.map(p => ({ ...p, team: null, billable: false, active: true }))
  )

  // Client work is split between the teams, so each has its own to book to
  const byTeam = new Map()
  for (const [i, team] of teams.entries()) {
    const mine = CLIENT_PROJECTS.filter((_, idx) => idx % teams.length === i)
    const created = await Project.insertMany(
      mine.map(p => ({ ...p, team: team._id, billable: true, active: true }))
    )
    byTeam.set(String(team._id), created)
  }

  // One finished engagement, archived, so the "Archived" section is not empty
  const [firstTeam] = teams
  await Project.create({
    name: 'Orbit Media — brand site',
    code: 'ORBT',
    client: 'Orbit Media',
    team: firstTeam._id,
    billable: true,
    active: false
  })
  ALL_NAMES.push('Orbit Media — brand site')

  console.log(`Created ${shared.length} shared and ${CLIENT_PROJECTS.length} client projects, plus 1 archived`)

  /* ---- hours on the standups that already exist -------------------- */

  const users = await User.find().select('_id team').lean()
  const teamOfUser = new Map(users.map(u => [String(u._id), u.team ? String(u.team) : null]))

  // A manager has no `team` field — they are linked as the team's manager
  for (const team of teams) {
    if (team.manager) teamOfUser.set(String(team.manager._id), String(team._id))
  }

  const standups = await Standup.find().select('_id user date').lean()

  const ops = []
  for (const [i, s] of standups.entries()) {
    const teamId = teamOfUser.get(String(s.user))
    const clientPool = byTeam.get(teamId) || byTeam.values().next().value
    if (!clientPool?.length) continue

    const main = pick(clientPool, i * 3 + 1)
    const roll = seeded(i * 7 + 3)

    const entries = []
    if (roll < 0.08) {
      // A day off, so somebody's week is short and the grid shows why
      entries.push({ project: shared[3]._id, hours: 8, note: 'Leave' })
    } else if (roll < 0.3) {
      // Split across two clients
      const second = pick(clientPool, i * 5 + 2)
      entries.push({ project: main._id, hours: 5, note: '' })
      entries.push({
        project: second._id === main._id ? shared[0]._id : second._id,
        hours: 2,
        note: ''
      })
      entries.push({ project: shared[1]._id, hours: 1, note: 'Standup and planning' })
    } else {
      entries.push({ project: main._id, hours: roll < 0.6 ? 6 : 6.5, note: '' })
      entries.push({ project: pick(shared.slice(0, 3), i * 11 + 5)._id, hours: 1.5, note: '' })
    }

    ops.push({ updateOne: { filter: { _id: s._id }, update: { $set: { work: entries } } } })
  }

  for (let i = 0; i < ops.length; i += 500) {
    await Standup.bulkWrite(ops.slice(i, i + 500))
  }
  console.log(`Booked hours on ${ops.length} standups`)

  /* ---- timesheets, one week per state ------------------------------ */

  await Timesheet.deleteMany({})

  const dates = [...new Set(standups.map(s => s.date))].sort()
  const latestMonday = toISODate(mondayOf(new Date(`${dates[dates.length - 1]}T00:00:00.000Z`)))

  const weeks = [0, 1, 2].map(back => {
    const d = new Date(`${latestMonday}T00:00:00.000Z`)
    d.setUTCDate(d.getUTCDate() - back * 7)
    return toISODate(d)
  })

  const people = await User.find({ role: 'employee' }).select('_id team name').lean()
  const managerOf = new Map(teams.map(t => [String(t._id), t.manager?._id || null]))

  // The snapshot carries the name as well as the id, because a project can be
  // renamed and the record of what was approved should not change with it
  const allProjects = await Project.find().select('name').lean()
  const nameOf = new Map(allProjects.map(p => [String(p._id), p.name]))

  const sheets = []
  for (const [w, weekStart] of weeks.entries()) {
    const weekDates = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(`${weekStart}T00:00:00.000Z`)
      d.setUTCDate(d.getUTCDate() + i)
      return toISODate(d)
    })

    for (const [i, person] of people.entries()) {
      const theirs = await Standup.find({
        user: person._id,
        date: { $in: weekDates }
      }).select('work').lean()

      const total = theirs.reduce(
        (sum, s) => sum + (s.work || []).reduce((h, e) => h + e.hours, 0),
        0
      )
      if (total === 0) continue

      // Older weeks are settled; the newest is still moving. Which is what a
      // manager opening this page should actually find.
      const roll = seeded(i * 13 + w * 29)
      const status =
        w === 2 ? 'approved'
          : w === 1 ? (roll < 0.15 ? 'changes_requested' : 'approved')
            : roll < 0.45 ? 'submitted' : roll < 0.7 ? 'draft' : 'approved'

      const lines = new Map()
      for (const s of theirs) {
        for (const e of s.work || []) {
          const key = String(e.project)
          lines.set(key, (lines.get(key) || 0) + e.hours)
        }
      }

      sheets.push({
        user: person._id,
        team: person.team || null,
        weekStart,
        status,
        lines: [...lines.entries()].map(([project, hours]) => ({
          project,
          projectName: nameOf.get(project) || '',
          hours: Number(hours.toFixed(2))
        })),
        totalHours: Number(total.toFixed(2)),
        submittedAt: status === 'draft' ? null : new Date(`${weekStart}T17:00:00.000Z`),
        reviewedBy: status === 'submitted' || status === 'draft'
          ? null
          : managerOf.get(String(person.team)) || null,
        reviewedAt: status === 'submitted' || status === 'draft'
          ? null
          : new Date(`${weekStart}T18:00:00.000Z`),
        note: status === 'changes_requested'
          ? 'Thursday looks light — did the Meridian call get booked anywhere?'
          : ''
      })
    }
  }

  if (sheets.length > 0) await Timesheet.insertMany(sheets)

  const counts = sheets.reduce((acc, s) => ({ ...acc, [s.status]: (acc[s.status] || 0) + 1 }), {})
  console.log(`Created ${sheets.length} timesheets across ${weeks.length} weeks:`)
  for (const [status, n] of Object.entries(counts)) console.log(`  ${status}: ${n}`)

  /* ---- and switch the standup form over ---------------------------- */

  for (const team of teams) {
    await StandupTemplate.findOneAndUpdate(
      { team: team._id },
      { $set: { trackTime: true }, $setOnInsert: { team: team._id, name: 'Daily standup' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
  }
  console.log(`Turned time tracking on for ${teams.length} teams`)

  console.log('\nDone. The standup form now asks where the hours went, and')
  console.log('Timesheets has weeks waiting to be approved.')

  await mongoose.disconnect()
}

run().catch(async (err) => {
  console.error('Seed failed:', err)
  await mongoose.disconnect()
  process.exit(1)
})
