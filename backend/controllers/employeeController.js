const User = require('../models/User')
const Team = require('../models/Team')
const Standup = require('../models/Standup')

const PAGE_SIZES = [10, 20, 50, 100]
const DEFAULT_LIMIT = 20

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

/** Treat user input as literal text, not as a pattern. */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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

// GET /api/employees?page=1&limit=20&search=&role=&team=
const listEmployees = async (req, res) => {
  try {
    const scope = await resolveScope(req.user)
    if (!scope) {
      return res.status(400).json({ message: 'You are not managing any team!' })
    }

    const limit = PAGE_SIZES.includes(Number(req.query.limit))
      ? Number(req.query.limit)
      : DEFAULT_LIMIT
    const page = Math.max(1, Number(req.query.page) || 1)

    const filter = { ...scope }

    if (req.query.role && req.query.role !== 'all') {
      filter.role = req.query.role
    }

    if (req.query.team && req.query.team !== 'all') {
      const team = await Team.findOne({ name: req.query.team }).select('_id')
      // An unknown team name must match nothing rather than silently everything
      filter.team = team?._id || null
    }

    if (req.query.search?.trim()) {
      const rx = new RegExp(escapeRegex(req.query.search.trim()), 'i')
      filter.$or = [{ name: rx }, { email: rx }]
    }

    const total = await User.countDocuments(filter)
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const safePage = Math.min(page, totalPages)

    const users = await User.find(filter)
      .select('-password -resetPasswordToken -resetPasswordExpire')
      .populate('team', 'name')
      .sort({ name: 1 })
      .skip((safePage - 1) * limit)
      .limit(limit)
      .lean()

    const ids = users.map(u => u._id)
    const week = last7Dates()

    // Stats are aggregated for this page only — two queries regardless of how
    // large the roster grows.
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

    // Filter options and headline counts describe the whole roster, not the
    // page — otherwise the team dropdown would shrink as you page through.
    const [teamDocs, rosterTotal] = await Promise.all([
      Team.find(scope.team ? { _id: scope.team } : {}).select('name').sort({ name: 1 }).lean(),
      User.countDocuments(scope)
    ])

    res.json({
      week,
      employees,
      teams: teamDocs.map(t => t.name),
      pageSizes: PAGE_SIZES,
      total,
      rosterTotal,
      page: safePage,
      limit,
      totalPages
    })
  } catch (err) {
    console.error('List employees error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/employees/summary — headline counts across the whole roster
const getSummary = async (req, res) => {
  try {
    const scope = await resolveScope(req.user)
    if (!scope) {
      return res.status(400).json({ message: 'You are not managing any team!' })
    }

    const users = await User.find(scope).select('_id').lean()
    const ids = users.map(u => u._id)
    const today = new Date().toISOString().split('T')[0]

    const [submittedToday, withBlockers, teamCount] = await Promise.all([
      Standup.distinct('user', { user: { $in: ids }, date: today }),
      Standup.distinct('user', { user: { $in: ids }, hasBlocker: true }),
      Team.countDocuments(scope.team ? { _id: scope.team } : {})
    ])

    res.json({
      rosterTotal: users.length,
      submittedToday: submittedToday.length,
      withBlockers: withBlockers.length,
      teamCount
    })
  } catch (err) {
    console.error('Employee summary error:', err.message)
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

    const [standups, moods] = await Promise.all([
      Standup.find({ user: user._id }).sort({ date: -1 }).limit(10).lean(),
      Standup.aggregate([
        { $match: { user: user._id } },
        { $group: { _id: '$mood', n: { $sum: 1 } } }
      ])
    ])

    const moodBreakdown = Object.fromEntries(moods.map(m => [m._id, m.n]))

    res.json({ user, standups, moodBreakdown })
  } catch (err) {
    console.error('Get employee error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = { listEmployees, getSummary, getEmployee }
