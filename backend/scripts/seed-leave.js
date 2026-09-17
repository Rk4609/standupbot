/**
 * Give the workspace a believable year of time off.
 *
 *   node scripts/seed-leave.js          # only people with no leave yet
 *   node scripts/seed-leave.js --force  # remove all leave and start again
 *
 * Each person gets a few days taken earlier in the year, and some of them
 * have something coming up — approved or still waiting — so the calendar,
 * the balances and the approvals queue all have something in them. Like the
 * records seed, values come from a hash of the account's id, so running it
 * twice gives the same workspace.
 */
require('dotenv').config()
const crypto = require('crypto')
const mongoose = require('mongoose')
const connectDB = require('../config/db')
const Leave = require('../models/Leave')
const Team = require('../models/Team')
const User = require('../models/User')
const { addDays, isWeekend, todayIn } = require('../utils/time')
const { workingDays } = require('../utils/leavePolicy')

const REASONS = {
  casual: ['Family function', 'Sister\'s wedding', 'Moving house', 'Bank and passport work', 'Personal errand'],
  sick: ['Fever', 'Viral infection', 'Doctor\'s appointment', 'Migraine'],
  earned: ['Trip to Goa with family', 'Visiting parents in Udaipur', 'Diwali at home', 'Long weekend in the hills'],
  unpaid: ['Exam preparation', 'Extended family visit']
}

/** A stable number from an id, so the same person always gets the same leave. */
const seedOf = (id, salt) =>
  crypto.createHash('sha1').update(`${id}:${salt}`).digest().readUInt32BE(0)

const pick = (list, id, salt) => list[seedOf(id, salt) % list.length]

/** The next working day on or after this one. */
const weekday = (iso) => {
  let day = iso
  while (isWeekend(day)) day = addDays(day, 1)
  return day
}

const main = async () => {
  await connectDB()
  const force = process.argv.includes('--force')

  if (force) {
    const { deletedCount } = await Leave.deleteMany({})
    console.log(`Removed ${deletedCount} leave requests`)
  }

  const today = todayIn('UTC')
  const year = today.slice(0, 4)

  const [people, teams, admin] = await Promise.all([
    User.find({ role: { $in: ['employee', 'manager'] } }).select('name role team').lean(),
    Team.find().select('manager members').lean(),
    User.findOne({ role: 'admin' }).select('name').lean()
  ])

  const teamOf = (person) => {
    if (person.team) return teams.find(t => String(t._id) === String(person.team))
    return teams.find(t => String(t.manager) === String(person._id))
  }

  let created = 0

  for (const person of people) {
    if (!force && await Leave.exists({ user: person._id })) continue

    const team = teamOf(person)
    // The manager answers their team; a manager's own leave goes to the admin
    const deciderId = team?.manager && String(team.manager) !== String(person._id)
      ? team.manager
      : admin?._id
    const decider = deciderId
      ? await User.findById(deciderId).select('name').lean()
      : null

    const id = String(person._id)
    const plans = []

    // Earlier in the year: one or two short absences, already approved
    const earlier = 1 + (seedOf(id, 'count') % 2)
    for (let i = 0; i < earlier; i++) {
      const month = String(2 + ((seedOf(id, `m${i}`) % 6) + i * 3) % 8).padStart(2, '0')
      const from = weekday(`${year}-${month}-${String(3 + (seedOf(id, `d${i}`) % 20)).padStart(2, '0')}`)
      const type = pick(['casual', 'sick', 'earned', 'casual'], id, `t${i}`)
      const length = type === 'earned' ? 3 : 1 + (seedOf(id, `l${i}`) % 2)
      plans.push({ type, from, to: weekday(addDays(from, length - 1)), status: 'approved' })
    }

    // Now and soon: about one in twelve is away this week, a few have
    // something approved or waiting in the next few weeks
    const roll = seedOf(id, 'now') % 12
    if (roll === 0) {
      const from = weekday(addDays(today, -1))
      plans.push({ type: 'sick', from, to: weekday(addDays(from, 1)), status: 'approved' })
    } else if (roll === 1) {
      const from = weekday(addDays(today, 5 + (seedOf(id, 'soon') % 10)))
      plans.push({ type: 'earned', from, to: weekday(addDays(from, 2)), status: 'approved' })
    } else if (roll === 2 || roll === 3) {
      const from = weekday(addDays(today, 3 + (seedOf(id, 'wait') % 14)))
      plans.push({ type: pick(['casual', 'earned'], id, 'wt'), from, to: from, status: 'pending' })
    } else if (roll === 4) {
      const from = weekday(addDays(today, -40))
      plans.push({
        type: 'casual', from, to: from, status: 'rejected',
        note: 'Client demo that day — could you pick another?'
      })
    }

    for (const plan of plans) {
      const days = workingDays(plan.from, plan.to)
      if (!days || !plan.from.startsWith(year) || !plan.to.startsWith(year)) continue

      // Never two requests over the same day
      const clash = await Leave.exists({
        user: person._id,
        status: { $in: ['pending', 'approved'] },
        from: { $lte: plan.to },
        to: { $gte: plan.from }
      })
      if (clash) continue

      const decided = plan.status !== 'pending' && decider
      await Leave.create({
        user: person._id,
        userName: person.name,
        team: team?._id || null,
        type: plan.type,
        from: plan.from,
        to: plan.to,
        days,
        reason: pick(REASONS[plan.type], id, plan.from),
        status: plan.status,
        note: plan.note || '',
        decidedBy: decided ? decider._id : null,
        decidedByName: decided ? decider.name : '',
        decidedAt: decided ? new Date(`${plan.from}T09:00:00.000Z`) : null,
        createdAt: new Date(`${addDays(plan.from, -7)}T09:00:00.000Z`)
      })
      created += 1
    }
  }

  const waiting = await Leave.countDocuments({ status: 'pending' })
  const awayToday = await Leave.countDocuments({ status: 'approved', from: { $lte: today }, to: { $gte: today } })
  console.log(`Created ${created} leave requests · ${waiting} waiting · ${awayToday} away today`)

  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await mongoose.disconnect()
  process.exit(1)
})
