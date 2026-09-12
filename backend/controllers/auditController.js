const AuditLog = require('../models/AuditLog')
const Team = require('../models/Team')
const User = require('../models/User')

const PAGE_SIZES = [10, 20, 50, 100]
const DEFAULT_LIMIT = 20

/**
 * What this reader is allowed to see.
 *
 * An admin sees everything. A manager sees their own team's activity — which
 * includes entries with no team attached only when the subject is one of
 * their people, since an unscoped filter would leak every other team's edits.
 */
const resolveScope = async (user) => {
  if (user.role === 'admin') return {}

  const team = await Team.findOne({ manager: user._id })
  if (!team) return null

  const members = await User.find({ team: team._id }).select('_id').lean()
  const ids = members.map(m => m._id)

  return { $or: [{ team: team._id }, { subject: { $in: ids } }] }
}

// GET /api/audit?action=&page=&limit=
const listAudit = async (req, res) => {
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
    if (req.query.action) filter.action = req.query.action

    const total = await AuditLog.countDocuments(filter)
    const totalPages = Math.max(1, Math.ceil(total / limit))

    // A page past the end returns the last one rather than nothing, so a
    // filter that shrinks the result does not leave the reader on a blank page
    const safePage = Math.min(page, totalPages)

    const entries = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * limit)
      .limit(limit)
      .lean()

    res.json({
      entries,
      actions: AuditLog.ACTIONS,
      pageSizes: PAGE_SIZES,
      total,
      page: safePage,
      limit,
      totalPages
    })
  } catch (err) {
    console.error('Audit list error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = { listAudit, PAGE_SIZES }
