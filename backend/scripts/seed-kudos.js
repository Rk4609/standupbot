/**
 * Give each team a few weeks of thank-yous.
 *
 *   node scripts/seed-kudos.js
 *
 * Only runs when there are no kudos at all, so it never adds to real ones.
 * Written straight to the database: nobody is notified.
 */
require('dotenv').config()
const crypto = require('crypto')
const mongoose = require('mongoose')
const connectDB = require('../config/db')
const Kudos = require('../models/Kudos')
const Team = require('../models/Team')
const User = require('../models/User')

const MESSAGES = {
  teamwork: ['Great pairing on the checkout bug today', 'Thanks for jumping in on the release', 'Made the handover painless'],
  helpful: ['Thanks for unblocking my API keys', 'Your review comments saved me a day', 'Thanks for walking me through the pipeline'],
  ownership: ['Took the flaky test and just fixed it', 'Owned the incident from start to finish', 'Chased the client for the missing specs'],
  quality: ['Lovely clean PR, easy to review', 'The new docs are really clear', 'Caught the edge case before it shipped'],
  'extra-mile': ['Stayed late to get the demo ready', 'Came in on Saturday to fix production', 'Wrote the runbook nobody asked for']
}
const VALUES = Object.keys(MESSAGES)

const roll = (...parts) => crypto.createHash('sha1').update(parts.join(':')).digest().readUInt32BE(0)

const main = async () => {
  await connectDB()
  if (await Kudos.exists({})) {
    console.log('Kudos already exist — leaving them alone')
    return mongoose.disconnect()
  }

  const teams = await Team.find().select('name members manager').lean()
  const rows = []

  for (const team of teams) {
    const ids = [...(team.members || []), team.manager].filter(Boolean)
    const people = await User.find({ _id: { $in: ids } }).select('name').lean()
    if (people.length < 2) continue

    const count = Math.min(24, people.length * 2)
    for (let i = 0; i < count; i++) {
      const from = people[roll(team._id, i, 'from') % people.length]
      let to = people[roll(team._id, i, 'to') % people.length]
      if (String(to._id) === String(from._id)) to = people[(people.indexOf(to) + 1) % people.length]

      const value = VALUES[roll(team._id, i, 'value') % VALUES.length]
      const message = MESSAGES[value][roll(team._id, i, 'msg') % MESSAGES[value].length]
      const createdAt = new Date(Date.now() - (roll(team._id, i, 'when') % (21 * 24)) * 3600_000)
      const cheers = people
        .filter(p => String(p._id) !== String(from._id) && roll(team._id, i, p._id) % 3 === 0)
        .map(p => p._id)

      rows.push({
        from: from._id, fromName: from.name, to: to._id, toName: to.name,
        team: team._id, value, message, cheers, createdAt, updatedAt: createdAt
      })
    }
  }

  await Kudos.collection.insertMany(rows)
  console.log(`Created ${rows.length} kudos across ${teams.length} teams`)
  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await mongoose.disconnect()
  process.exit(1)
})
