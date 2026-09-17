/**
 * Fill this month's attendance, up to now.
 *
 *   node scripts/seed-attendance.js          # only people with no attendance yet
 *   node scripts/seed-attendance.js --force  # remove all attendance and start again
 *
 * Most people come in a little before ten and leave around seven; some are
 * late now and then, the odd day is missed or cut short, and approved leave is
 * respected. Today depends on the hour: before ten few are in, after seven
 * most have left. Values come from a hash of the account and the day, so a
 * second run gives the same month.
 */
require('dotenv').config()
const crypto = require('crypto')
const mongoose = require('mongoose')
const connectDB = require('../config/db')
const Attendance = require('../models/Attendance')
const Leave = require('../models/Leave')
const Team = require('../models/Team')
const User = require('../models/User')
const { addDays, instantIn, isValidTimezone, isWeekend, minuteOfDayIn, todayIn } = require('../utils/time')
const { hhmm } = require('../utils/attendancePolicy')

const roll = (...parts) =>
  crypto.createHash('sha1').update(parts.join(':')).digest().readUInt32BE(0)

/** A time between two clock minutes, from a roll. */
const between = (from, to, r) => from + (r % Math.max(1, to - from))

const main = async () => {
  await connectDB()
  const force = process.argv.includes('--force')

  if (force) {
    const { deletedCount } = await Attendance.deleteMany({})
    console.log(`Removed ${deletedCount} attendance days`)
  }

  const [people, teams] = await Promise.all([
    User.find({ role: { $in: ['employee', 'manager'] } }).select('name team timezone').lean(),
    Team.find().select('manager').lean()
  ])

  let created = 0

  for (const person of people) {
    if (!force && await Attendance.exists({ user: person._id })) continue

    // Demo accounts mostly never chose a zone; the office is in India
    const tz = isValidTimezone(person.timezone) && person.timezone ? person.timezone : 'Asia/Kolkata'
    const today = todayIn(tz)
    const nowMinute = minuteOfDayIn(tz)
    const team = person.team || teams.find(t => String(t.manager) === String(person._id))?._id || null
    const id = String(person._id)

    const leaves = await Leave.find({ user: person._id, status: 'approved' }).select('from to halfDay').lean()
    const offOn = (day) => leaves.find(l => !l.halfDay && l.from <= day && l.to >= day)

    const rows = []
    for (let day = `${today.slice(0, 7)}-01`; day <= today; day = addDays(day, 1)) {
      if (isWeekend(day) || offOn(day)) continue

      const r = roll(id, day)
      const kind = r % 100

      // About one working day in twenty-five is simply missed
      if (kind < 4 && day !== today) continue

      const late = kind >= 4 && kind < 18
      const inAt = late ? between(10 * 60 + 17, 10 * 60 + 58, r >> 8) : between(9 * 60 + 30, 10 * 60 + 13, r >> 8)
      let outAt = between(17 * 60 + 50, 19 * 60 + 35, r >> 16)
      if (kind >= 18 && kind < 21) outAt = between(13 * 60 + 10, 13 * 60 + 50, r >> 16) // half day
      const forgot = kind === 21

      if (day === today) {
        if (nowMinute < inAt) continue // not in yet
        rows.push({ day, inAt, outAt: nowMinute >= outAt ? outAt : null })
      } else {
        rows.push({ day, inAt, outAt: forgot ? null : outAt })
      }
    }

    if (rows.length === 0) continue

    await Attendance.insertMany(rows.map(row => ({
      user: person._id,
      userName: person.name,
      team,
      date: row.day,
      timezone: tz,
      checkIn: instantIn(tz, row.day, hhmm(row.inAt)),
      checkOut: row.outAt === null ? null : instantIn(tz, row.day, hhmm(row.outAt))
    })), { ordered: false }).catch(err => {
      if (err.code !== 11000) throw err
    })
    created += rows.length
  }

  const today = todayIn('Asia/Kolkata')
  const inToday = await Attendance.countDocuments({ date: today })
  console.log(`Created ${created} attendance days · ${inToday} checked in today (${today})`)

  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await mongoose.disconnect()
  process.exit(1)
})
