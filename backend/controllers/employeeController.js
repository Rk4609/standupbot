const User = require('../models/User')
const Team = require('../models/Team')
const Standup = require('../models/Standup')

/** Last 7 ISO dates, oldest first. */
const last7Dates = () => {
  const dates = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

/**
 * Which people the caller may see: an admin sees everyone, a manager sees
 * their own team. Returns null when a manager has no team yet.
 */
const resolveScope = async (user) => {
  if (user.role === 'admin') return {}

  const team = await Team.findOne({ manager: user._id })
  if (!team) return null
  return { team: team._id }
}

// GET /api/employees — roster with per-person standup stats
const listEmployees = async (req, res) => {
  try {
    const scope = await resolveScope(req.user)
    if (!scope) {
      return res.status(400).json({ message: 'You are not managing any team!' })
    }

    const users = await User.find(scope)
      .select('-password -resetPasswordToken -resetPasswordExpire')
      .populate('team', 'name')
      .sort({ name: 1 })
      .lean()

    const ids = users.map(u => u._id)
    const week = last7Dates()

    // Two aggregations rather than a query per person — this list is the whole
    // point of the page, so it has to stay flat as the roster grows.
    const [totals, recent] = await Promise.all([
      Standup.aggregate([
        { $match: { user: { $in: ids } } },
        {
          $group: {
            _id: '$user',
            totalStandups: { $sum: 1 },
            blockerCount: { $sum: { $cond: ['$hasBlocker', 1, 0] } },
            lastDate: { $max: '$date' }
          }
        }
      ]),
      Standup.aggregate([
        { $match: { user: { $in: ids }, date: { $in: week } } },
        { $group: { _id: '$user', dates: { $addToSet: '$date' } } }
      ])
    ])

    const totalsBy = new Map(totals.map(t => [String(t._id), t]))
    const recentBy = new Map(recent.map(r => [String(r._id), r.dates]))
    const today = week[week.length - 1]

    const employees = users.map(u => {
      const t = totalsBy.get(String(u._id)) || {}
      const dates = recentBy.get(String(u._id)) || []

      return {
        ...u,
        totalStandups: t.totalStandups || 0,
        blockerCount: t.blockerCount || 0,
        lastDate: t.lastDate || null,
        weekDates: dates,
        weekCount: dates.length,
        submittedToday: dates.includes(today)
      }
    })

    res.json({ week, employees })
  } catch (err) {
    console.error('List employees error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/employees/:id — detail for an expanded row
const getEmployee = async (req, res) => {
  try {
    const scope = await resolveScope(req.user)
    if (!scope) {
      return res.status(400).json({ message: 'You are not managing any team!' })
    }

    const user = await User.findOne({ _id: req.params.id, ...scope })
      .select('-password -resetPasswordToken -resetPasswordExpire')
      .populate('team', 'name')
      .lean()

    if (!user) {
      return res.status(404).json({ message: 'Employee not found' })
    }

    const standups = await Standup.find({ user: user._id })
      .sort({ date: -1 })
      .limit(10)
      .lean()

    const moodBreakdown = {}
    for (const s of await Standup.find({ user: user._id }).select('mood').lean()) {
      moodBreakdown[s.mood] = (moodBreakdown[s.mood] || 0) + 1
    }

    res.json({ user, standups, moodBreakdown })
  } catch (err) {
    console.error('Get employee error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = { listEmployees, getEmployee }
