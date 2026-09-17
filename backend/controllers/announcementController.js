const Announcement = require('../models/Announcement')
const Team = require('../models/Team')
const User = require('../models/User')
const { notifyMany } = require('../services/notifyService')
const { canUse } = require('../services/roleService')
const { ownTeam } = require('../utils/teams')

const isAdmin = (user) => user.role === 'admin'

/** An admin may post to everybody or any team; a manager to the team they lead. */
const postingScope = async (user) => {
  if (!(await canUse(user, 'announce'))) return null
  if (isAdmin(user)) return { admin: true }
  const team = await Team.findOne({ manager: user._id }).select('_id name').lean()
  return team ? { team } : null
}

const present = (row, user) => {
  const author = String(row.author) === String(user._id)
  return {
    _id: row._id,
    title: row.title,
    body: row.body,
    important: row.important,
    team: row.team ? { _id: row.team, name: row.teamName } : null,
    authorName: row.authorName,
    createdAt: row.createdAt,
    read: row.readBy.some(id => String(id) === String(user._id)),
    // Only whoever posted it, or an admin, sees how many have read it
    ...(author || isAdmin(user)
      ? { readCount: row.readBy.length, audienceCount: row.audienceCount, canDelete: true }
      : { canDelete: false })
  }
}

// GET /api/announcements — what has been said to me, newest first
const listAnnouncements = async (req, res) => {
  try {
    const team = await ownTeam(req.user)
    const filter = isAdmin(req.user) ? {} : { $or: [{ team: null }, ...(team ? [{ team }] : [])] }
    const [rows, scope] = await Promise.all([
      Announcement.find(filter).sort({ important: -1, createdAt: -1 }).limit(30).lean(),
      postingScope(req.user)
    ])
    res.json({
      announcements: rows.map(r => present(r, req.user)),
      canPost: Boolean(scope),
      postTo: scope?.admin ? 'any' : scope?.team ? { _id: scope.team._id, name: scope.team.name } : null,
      teams: scope?.admin ? await Team.find().select('name').sort({ name: 1 }).lean() : []
    })
  } catch (err) {
    console.error('List announcements error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/announcements — say something to everybody, or a team
const postAnnouncement = async (req, res) => {
  try {
    const scope = await postingScope(req.user)
    if (!scope) return res.status(403).json({ message: 'Your role does not post announcements' })

    let team = null
    if (scope.admin) {
      if (req.body.team) team = await Team.findById(req.body.team).select('name members manager').lean()
      if (req.body.team && !team) return res.status(404).json({ message: 'No such team' })
    } else {
      team = await Team.findById(scope.team._id).select('name members manager').lean()
    }

    const audience = team
      ? [...(team.members || []), team.manager].filter(Boolean)
      : (await User.find({}).select('_id').lean()).map(u => u._id)
    const recipients = audience.filter(id => String(id) !== String(req.user._id))

    const row = await Announcement.create({
      title: req.body.title,
      body: req.body.body,
      important: Boolean(req.body.important),
      team: team?._id || null,
      teamName: team?.name || '',
      author: req.user._id,
      authorName: req.user.name,
      // The author has read what they wrote
      readBy: [req.user._id],
      audienceCount: recipients.length
    })

    await notifyMany(req.app.get('io'), recipients, {
      sender: req.user._id,
      type: 'announcement',
      message: `${row.important ? '📣 Important: ' : '📣 '}${row.title}`,
      link: '/dashboard'
    })

    res.status(201).json({ announcement: present(row.toObject(), req.user) })
  } catch (err) {
    console.error('Post announcement error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/announcements/:id/read — "got it"
const markRead = async (req, res) => {
  try {
    const row = await Announcement.findByIdAndUpdate(
      req.params.id, { $addToSet: { readBy: req.user._id } }, { new: true }
    ).lean()
    if (!row) return res.status(404).json({ message: 'No such announcement' })
    res.json({ announcement: present(row, req.user) })
  } catch (err) {
    console.error('Read announcement error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// DELETE /api/announcements/:id — whoever posted it, or an admin
const deleteAnnouncement = async (req, res) => {
  try {
    const row = await Announcement.findById(req.params.id).lean()
    if (!row) return res.status(404).json({ message: 'No such announcement' })
    if (!present(row, req.user).canDelete) return res.status(403).json({ message: 'Not yours to remove' })
    await Announcement.deleteOne({ _id: row._id })
    res.json({ message: 'Announcement removed' })
  } catch (err) {
    console.error('Delete announcement error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = { listAnnouncements, postAnnouncement, markRead, deleteAnnouncement }
