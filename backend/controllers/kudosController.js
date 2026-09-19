const Kudos = require('../models/Kudos')
const Team = require('../models/Team')
const User = require('../models/User')
const { notify } = require('../services/notifyService')
const { ownTeam } = require('../utils/teams')
const { todayIn, zoneOf } = require('../utils/time')

const { paging, PAGE_SIZES } = require('../utils/paging')
/** Enough to thank a whole team on a good day; not enough to spam one. */
const DAILY_LIMIT = 10
/** Long enough to fix a typo by deleting and saying it again. */
const DELETE_WINDOW_MS = 24 * 60 * 60 * 1000

const isAdmin = (user) => user.role === 'admin'

const VALUE_LABEL = {
  teamwork: 'teamwork',
  ownership: 'ownership',
  helpful: 'being helpful',
  quality: 'quality',
  'extra-mile': 'going the extra mile'
}

/**
 * Whose kudos this person sees: an admin everybody's, anybody else their own
 * team's — plus any they gave or received, wherever those people sit.
 */
const feedScope = async (user) => {
  if (isAdmin(user)) return {}
  const team = await ownTeam(user)
  const mine = [{ from: user._id }, { to: user._id }]
  return { $or: team ? [{ team }, ...mine] : mine }
}

/** Who this person can thank: their team, or anybody for an admin. */
const recipientsFor = async (user, q = '') => {
  const filter = { _id: { $ne: user._id } }
  if (!isAdmin(user)) {
    const team = await ownTeam(user)
    if (!team) return []
    const row = await Team.findById(team).select('members manager').lean()
    filter._id = { $ne: user._id, $in: [...(row?.members || []), row?.manager].filter(Boolean) }
  }
  if (q.trim()) filter.name = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')

  return User.find(filter).select('name avatar employment.position').sort({ name: 1 }).limit(50).lean()
}

const present = (row, user) => ({
  _id: row._id,
  from: { _id: row.from, name: row.fromName },
  to: { _id: row.to, name: row.toName },
  value: row.value,
  message: row.message,
  createdAt: row.createdAt,
  cheers: row.cheers.length,
  cheered: row.cheers.some(id => String(id) === String(user._id)),
  mine: String(row.from) === String(user._id),
  canDelete: isAdmin(user) ||
    (String(row.from) === String(user._id) && Date.now() - new Date(row.createdAt) < DELETE_WINDOW_MS)
})

// GET /api/kudos?page= — the feed, and who is most thanked this month
const listKudos = async (req, res) => {
  try {
    const scope = await feedScope(req.user)
    const { page, limit, skip } = paging(req.query, 20)
    const monthStart = `${todayIn(zoneOf(req.user)).slice(0, 7)}-01`

    const [rows, total, top] = await Promise.all([
      Kudos.find(scope).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Kudos.countDocuments(scope),
      Kudos.aggregate([
        { $match: { ...scope, createdAt: { $gte: new Date(`${monthStart}T00:00:00.000Z`) } } },
        { $group: { _id: '$to', name: { $last: '$toName' }, count: { $sum: 1 } } },
        { $sort: { count: -1, name: 1 } },
        { $limit: 3 }
      ])
    ])

    res.json({
      kudos: rows.map(r => present(r, req.user)),
      top: top.map(t => ({ _id: t._id, name: t.name, count: t.count })),
      values: Kudos.VALUES,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      limit,
      pageSizes: PAGE_SIZES,
      total
    })
  } catch (err) {
    console.error('List kudos error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/kudos/people?q= — who can be thanked
const kudosPeople = async (req, res) => {
  try {
    const people = await recipientsFor(req.user, String(req.query.q || ''))
    res.json({
      people: people.map(p => ({ _id: p._id, name: p.name, avatar: p.avatar || '', position: p.employment?.position || '' }))
    })
  } catch (err) {
    console.error('Kudos people error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/kudos — say thank you
const giveKudos = async (req, res) => {
  try {
    const { to, message, value = 'teamwork' } = req.body

    if (String(to) === String(req.user._id)) {
      return res.status(400).json({ message: 'Kudos are for somebody else' })
    }

    const allowed = await recipientsFor(req.user)
    const recipient = allowed.find(p => String(p._id) === String(to))
    if (!recipient) return res.status(403).json({ message: 'You can thank people on your own team' })

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    if (await Kudos.countDocuments({ from: req.user._id, createdAt: { $gte: since } }) >= DAILY_LIMIT) {
      return res.status(429).json({ message: `That is ${DAILY_LIMIT} today — save some for tomorrow` })
    }

    const kudos = await Kudos.create({
      from: req.user._id,
      fromName: req.user.name,
      to: recipient._id,
      toName: recipient.name,
      team: await ownTeam(await User.findById(recipient._id).select('team role').lean()),
      value,
      message
    })

    await notify(req.app.get('io'), {
      recipient: recipient._id,
      sender: req.user._id,
      type: 'kudos_received',
      message: `${req.user.name} gave you kudos for ${VALUE_LABEL[value]}: “${message.slice(0, 80)}”`,
      link: '/kudos'
    })

    res.status(201).json({ kudos: present(kudos.toObject(), req.user) })
  } catch (err) {
    console.error('Give kudos error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/kudos/:id/cheer — add or take back a cheer
const cheerKudos = async (req, res) => {
  try {
    const scope = await feedScope(req.user)
    const row = await Kudos.findOne({ _id: req.params.id, ...scope })
    if (!row) return res.status(404).json({ message: 'No such kudos' })

    const had = row.cheers.some(id => String(id) === String(req.user._id))
    const update = had ? { $pull: { cheers: req.user._id } } : { $addToSet: { cheers: req.user._id } }
    const updated = await Kudos.findByIdAndUpdate(row._id, update, { new: true }).lean()

    res.json({ kudos: present(updated, req.user) })
  } catch (err) {
    console.error('Cheer kudos error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// DELETE /api/kudos/:id — the author within a day, or an admin
const deleteKudos = async (req, res) => {
  try {
    const row = await Kudos.findById(req.params.id).lean()
    if (!row) return res.status(404).json({ message: 'No such kudos' })
    if (!present(row, req.user).canDelete) {
      return res.status(403).json({ message: 'Only the person who wrote it can remove it, within a day' })
    }
    await Kudos.deleteOne({ _id: row._id })
    res.json({ message: 'Kudos removed' })
  } catch (err) {
    console.error('Delete kudos error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = { listKudos, kudosPeople, giveKudos, cheerKudos, deleteKudos, DAILY_LIMIT }
