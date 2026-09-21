/**
 * Fill in this week's standups (Mon-Fri) for a handful of employees, so the
 * weekly report has something substantial to work with.
 *
 *   node scripts/fill-week-standups.js           # 10 employees, current week
 *   node scripts/fill-week-standups.js 20        # 20 employees
 *   node scripts/fill-week-standups.js 10 AIML   # only from one team
 *
 * Existing standups are left alone — a person already has at most one per day,
 * and the app enforces the same rule.
 */
require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../models/User')
const Team = require('../models/Team')
const Standup = require('../models/Standup')
const { resolveWeek, previousWeek } = require('../utils/week')

const COUNT = Number(process.argv[2]) || 10
const TEAM_NAME = process.argv[3] || null

/** Themed work so the report can group it, rather than ten unrelated lines. */
const THREADS = [
  {
    shipped: [
      'Finished the checkout validation and covered it with tests',
      'Fixed the double-charge edge case on retries',
      'Split the payments module out of the monolith',
      'Added idempotency keys to the charge endpoint',
      'Wrote the reconciliation job for failed payments'
    ],
    planned: [
      'Start on refunds handling',
      'Add the webhook signature check',
      'Load-test the payments path',
      'Document the retry semantics',
      'Pair on the settlement report'
    ]
  },
  {
    shipped: [
      'Rebuilt the orders table with virtual scrolling',
      'Cut the dashboard bundle by 180KB',
      'Shipped the empty and error states across settings',
      'Fixed the layout break on tablets',
      'Migrated the last class components to hooks'
    ],
    planned: [
      'Start the saved-views feature',
      'Audit the remaining accessibility issues',
      'Wire up the new filter chips',
      'Clean up the legacy CSS',
      'Add skeletons to the slower pages'
    ]
  },
  {
    shipped: [
      'Set up the staging environment end to end',
      'Moved CI to the new runners, builds are ~3 min faster',
      'Added structured logging to the API',
      'Fixed the nightly backup that was silently failing',
      'Rotated the expiring service credentials'
    ],
    planned: [
      'Add alerting on the error rate',
      'Write the on-call runbook',
      'Trial the new deploy pipeline',
      'Clean up unused infrastructure',
      'Review the security scan findings'
    ]
  }
]

/**
 * Deliberately reuse blockers from last week for some people, so a blocker
 * that runs on from one week into the next shows up the way it does for real.
 */
const RECURRING = [
  'Waiting on API credentials from the platform team',
  'Blocked on the staging database being down'
]
const FRESH = [
  'Need a design review before I can continue',
  'Waiting for the security sign-off',
  'Dependent on the upstream service fix',
  'Test environment keeps losing its seed data',
  'Need access to the production logs to debug this'
]

const MOODS = ['great', 'good', 'good', 'good', 'okay', 'okay', 'bad', 'stressed']

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)]

/** Mon-Fri of the given week, as UTC ISO dates. */
const weekdays = (week) => {
  const start = new Date(`${week.weekStart}T00:00:00.000Z`)
  return Array.from({ length: 5 }, (_, i) =>
    new Date(start.getTime() + i * 86_400_000).toISOString().split('T')[0]
  )
}

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set')

  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to', mongoose.connection.host)

  const week = resolveWeek(new Date())
  const prev = previousWeek(new Date())
  const dates = weekdays(week)
  console.log(`Week: ${week.weekLabel}  (${dates.join(', ')})`)

  // Who to fill
  const filter = { role: 'employee' }
  if (TEAM_NAME) {
    const team = await Team.findOne({ name: TEAM_NAME })
    if (!team) throw new Error(`No team called "${TEAM_NAME}"`)
    filter.team = team._id
    console.log(`Team filter: ${team.name}`)
  }

  const employees = await User.find(filter).limit(COUNT).select('name team').lean()
  if (employees.length === 0) throw new Error('No employees matched')
  console.log(`Filling ${employees.length} employees\n`)

  // What already exists, so we only add the gaps
  const existing = await Standup.find({
    user: { $in: employees.map(e => e._id) },
    date: { $in: dates }
  }).select('user date').lean()

  const taken = new Set(existing.map(s => `${s.user}:${s.date}`))

  // Blockers carried over from last week, to seed genuine repeats
  const lastWeekBlockers = await Standup.find({
    user: { $in: employees.map(e => e._id) },
    date: { $gte: prev.weekStart, $lte: prev.weekEnd },
    hasBlocker: true
  }).select('user blockers').lean()

  const carriedBy = new Map()
  for (const s of lastWeekBlockers) carriedBy.set(String(s.user), s.blockers)

  const docs = []
  for (const [i, emp] of employees.entries()) {
    const thread = THREADS[i % THREADS.length]
    // A repeat blocker for roughly every third person
    const carried = i % 3 === 0 ? carriedBy.get(String(emp._id)) || rand(RECURRING) : null

    for (const [d, date] of dates.entries()) {
      if (taken.has(`${emp._id}:${date}`)) continue

      // A couple of people miss a day or two, like a real week
      if (i % 7 === 0 && d === 2) continue
      if (i % 11 === 0 && d === 4) continue

      const hasBlocker = carried ? d >= 2 : Math.random() < 0.15

      docs.push({
        user: emp._id,
        team: emp.team || null,
        yesterday: rand(thread.shipped),
        today: rand(thread.planned),
        blockers: hasBlocker ? carried || rand(FRESH) : 'None',
        hasBlocker,
        mood: rand(MOODS),
        date
      })
    }
  }

  if (docs.length === 0) {
    console.log('Everyone already has a full week — nothing to add.')
  } else {
    await Standup.insertMany(docs, { ordered: false })
    console.log(`Added ${docs.length} standups (${docs.filter(d => d.hasBlocker).length} with blockers).`)
  }

  // Report what the weekly report will now see
  const total = await Standup.countDocuments({ date: { $in: dates } })
  const people = await Standup.distinct('user', { date: { $in: dates } })
  console.log(`\nThis week now has ${total} standups from ${people.length} people.`)
  console.log('Open /reports and hit Write the report.')

  await mongoose.disconnect()
}

run().catch(err => {
  console.error('Fill failed:', err.message)
  process.exit(1)
})
