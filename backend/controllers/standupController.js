const Standup = require('../models/Standup')
const User = require('../models/User')
const Team = require('../models/Team')
const Notification = require('../models/Notification')

// ✅ Helper
const getTeamId = async (user) => {
  if (user.role === 'member' && user.team) return user.team
  if (user.role === 'manager') {
    const team = await Team.findOne({ manager: user._id })
    return team?._id || null
  }
  return null // admin
}

// POST /api/standups
const submitStandup = async (req, res) => {
  try {
    const { yesterday, today, blockers, mood } = req.body
    const today_date = new Date().toISOString().split('T')[0]

    if (!yesterday || !today) {
      return res.status(400).json({ message: 'Yesterday and Today fields are required' })
    }

    const exists = await Standup.findOne({ user: req.user._id, date: today_date })
    if (exists) {
      return res.status(400).json({ message: "Today's standup is already submitted!" })
    }

    const hasBlocker = blockers && blockers.trim() !== '' && blockers.toLowerCase() !== 'none'

    const standup = await Standup.create({
      user: req.user._id,
      team: req.user.team || null,
      yesterday,
      today,
      blockers: blockers || 'None',
      hasBlocker,
      mood: mood || 'good',
      date: today_date
    })

    if (req.user.team) {
      const team = await Team.findById(req.user.team).populate('manager')
      if (team?.manager) {
        const io = req.app.get('io')

        const notification = await Notification.create({
          recipient: team.manager._id,
          sender: req.user._id,
          type: 'standup_submitted',
          message: `${req.user.name} submitted their daily standup`,
          link: '/team'
        })

        io.to(team.manager._id.toString()).emit('new-notification', {
          _id: notification._id,
          message: notification.message,
          type: notification.type,
          isRead: false,
          createdAt: notification.createdAt,
          link: notification.link
        })

        if (hasBlocker) {
          const blockerNotif = await Notification.create({
            recipient: team.manager._id,
            sender: req.user._id,
            type: 'blocker_added',
            message: `🚨 ${req.user.name} has a blocker: ${blockers}`,
            link: '/blockers'
          })

          io.to(team.manager._id.toString()).emit('new-notification', {
            _id: blockerNotif._id,
            message: blockerNotif.message,
            type: blockerNotif.type,
            isRead: false,
            createdAt: blockerNotif.createdAt,
            link: blockerNotif.link
          })
        }
      }
    }

    const user = await User.findById(req.user._id)
    const yesterday_date = new Date()
    yesterday_date.setDate(yesterday_date.getDate() - 1)
    const lastDate = user.lastSubmission?.toISOString().split('T')[0]
    const yesterdayStr = yesterday_date.toISOString().split('T')[0]
    const newStreak = lastDate === yesterdayStr ? (user.streak || 0) + 1 : 1

    await User.updateOne(
      { _id: req.user._id },
      { streak: newStreak, lastSubmission: new Date() }
    )

    res.status(201).json(standup)
  } catch (err) {
    console.error('Standup submit error:', err)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/standups/my
const getMyStandups = async (req, res) => {
  try {
    const standups = await Standup.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30)
    res.json(standups)
  } catch (err) {
    console.error('Get standups error:', err)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/standups/team
const getTeamStandups = async (req, res) => {
  try {
    const filter = {}

    if (req.user.role === 'admin') {
      console.log('Admin — showing all standups')
    } else {
      const teamId = await getTeamId(req.user)
      if (!teamId) {
        return res.status(400).json({ message: 'You are not part of any team!' })
      }
      filter.team = teamId
    }

    const { date } = req.query
    if (date) filter.date = date

    const standups = await Standup.find(filter)
      .populate('user', 'name email streak')
      .sort({ createdAt: -1 })
    res.json(standups)
  } catch (err) {
    console.error('Team standups error:', err)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/standups/blockers
const getBlockers = async (req, res) => {
  try {
    const filter = { hasBlocker: true }

    if (req.user.role !== 'admin') {
      const teamId = await getTeamId(req.user)
      if (teamId) filter.team = teamId
    }

    const standups = await Standup.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(20)
    res.json(standups)
  } catch (err) {
    console.error('Blockers error:', err)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/standups/stats
const getTeamStats = async (req, res) => {
  try {
    const last7 = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      last7.push(d.toISOString().split('T')[0])
    }

    const filter = {}

    if (req.user.role === 'admin') {
      console.log('Admin — showing all stats')
    } else {
      const teamId = await getTeamId(req.user)
      if (teamId) filter.team = teamId
      console.log('Resolved teamId:', teamId)
    }

    const stats = await Promise.all(last7.map(async (date) => {
      const count = await Standup.countDocuments({ ...filter, date })
      console.log(`Date: ${date} → Count: ${count}`)
      return { date, count }
    }))

    res.json(stats)
  } catch (err) {
    console.error('Stats error:', err)
    res.status(500).json({ message: err.message })
  }
}

//  PUT /api/standups/:id/blocker — Blocker edit karo (admin)
const updateBlocker = async (req, res) => {
  try {
    const { blockers } = req.body

    const standup = await Standup.findById(req.params.id)
    if (!standup) {
      return res.status(404).json({ message: 'Standup not found' })
    }

    const hasBlocker = blockers && blockers.trim() !== '' && blockers.toLowerCase() !== 'none'

    standup.blockers = blockers || 'None'
    standup.hasBlocker = hasBlocker
    await standup.save()

    res.json({ message: 'Blocker updated successfully', standup })
  } catch (err) {
    console.error('Update blocker error:', err)
    res.status(500).json({ message: err.message })
  }
}

//  DELETE /api/standups/:id — Standup delete karo (admin)
const deleteBlocker = async (req, res) => {
  try {
    const standup = await Standup.findById(req.params.id)
    if (!standup) {
      return res.status(404).json({ message: 'Standup not found' })
    }

    await Standup.findByIdAndDelete(req.params.id)
    res.json({ message: 'Standup deleted successfully' })
  } catch (err) {
    console.error('Delete standup error:', err)
    res.status(500).json({ message: err.message })
  }
}

module.exports = {
  submitStandup,
  getMyStandups,
  getTeamStandups,
  getBlockers,
  getTeamStats,
  updateBlocker,
  deleteBlocker
}