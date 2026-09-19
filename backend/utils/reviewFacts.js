const Standup = require('../models/Standup')
const Kudos = require('../models/Kudos')
const Leave = require('../models/Leave')

/**
 * What the app already knows about somebody's period, for whoever writes
 * their review: so it is written from the record, not from last week.
 */
const reviewFacts = async (userId, from, to) => {
  const start = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T23:59:59Z`)

  const [standups, kudos, leaves] = await Promise.all([
    Standup.find({ user: userId, date: { $gte: from, $lte: to } }).select('hasBlocker mood').lean(),
    Kudos.find({ to: userId, createdAt: { $gte: start, $lte: end } })
      .select('fromName value message createdAt').sort({ createdAt: -1 }).lean(),
    Leave.find({ user: userId, status: 'approved', from: { $lte: to }, to: { $gte: from } }).select('days').lean()
  ])

  const moods = {}
  for (const s of standups) moods[s.mood] = (moods[s.mood] || 0) + 1

  return {
    standups: standups.length,
    blockers: standups.filter(s => s.hasBlocker).length,
    moods,
    kudos: kudos.length,
    recentKudos: kudos.slice(0, 3).map(k => ({ from: k.fromName, value: k.value, message: k.message })),
    leaveDays: leaves.reduce((n, l) => n + l.days, 0)
  }
}

module.exports = { reviewFacts }
