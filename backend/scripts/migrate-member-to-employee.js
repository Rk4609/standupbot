/**
 * One-off migration: the `member` role was renamed to `employee`.
 *
 * Mongoose only validates the enum on write, so existing documents keep
 * reading fine — but any save of an untouched user would fail. Run this once
 * against each environment before deploying the rename.
 *
 *   node scripts/migrate-member-to-employee.js
 */
require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../models/User')

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set')

  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to', mongoose.connection.host)

  const before = await User.countDocuments({ role: 'member' })
  console.log(`Users with role "member": ${before}`)

  if (before === 0) {
    console.log('Nothing to migrate.')
  } else {
    // updateMany bypasses the schema enum, which is what we need here —
    // the old value is no longer valid but the documents still hold it.
    const result = await User.collection.updateMany(
      { role: 'member' },
      { $set: { role: 'employee' } }
    )
    console.log(`Updated ${result.modifiedCount} users to "employee".`)
  }

  const counts = await User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }])
  console.log('Roles now:', counts.map(c => `${c._id}=${c.n}`).join(', '))

  await mongoose.disconnect()
}

run().catch(err => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
