/**
 * Give existing accounts a timezone.
 *
 * Everyone who signed up before the timezone field has a blank one, which
 * every reader treats as UTC. That matches how their past standups were
 * filed, so nothing moves — but the daily reminder now fires at 9am in each
 * person's own zone, and 9am UTC is the middle of the afternoon in India.
 *
 * Run this once with the zone your people are actually in:
 *
 *   node scripts/set-timezone.js Asia/Kolkata
 *   node scripts/set-timezone.js Asia/Kolkata --force   (also overwrite set zones)
 *
 * Accounts that already chose a zone are left alone unless --force is given.
 */
require('dotenv').config()
const mongoose = require('mongoose')
const connectDB = require('../config/db')
const User = require('../models/User')
const { isValidTimezone } = require('../utils/time')

const run = async () => {
  const zone = process.argv[2]
  const force = process.argv.includes('--force')

  if (!zone) {
    console.error('Usage: node scripts/set-timezone.js <IANA zone> [--force]')
    console.error('Example: node scripts/set-timezone.js Asia/Kolkata')
    process.exit(1)
  }

  if (!isValidTimezone(zone)) {
    console.error(`"${zone}" is not a zone this server recognises.`)
    console.error('Use a region-qualified name such as Asia/Kolkata or Europe/London.')
    process.exit(1)
  }

  await connectDB()

  const filter = force ? {} : { $or: [{ timezone: '' }, { timezone: null }, { timezone: { $exists: false } }] }

  const affected = await User.countDocuments(filter)
  if (affected === 0) {
    console.log('Every account already has a timezone. Nothing to do.')
    await mongoose.disconnect()
    return
  }

  const res = await User.updateMany(filter, { $set: { timezone: zone } })
  console.log(`Set ${res.modifiedCount} of ${affected} accounts to ${zone}.`)
  console.log('Their standups will now be filed against that clock, and the')
  console.log('daily reminder will reach them at 9am there.')

  await mongoose.disconnect()
}

run().catch(async (err) => {
  console.error('Migration failed:', err.message)
  await mongoose.disconnect()
  process.exit(1)
})
