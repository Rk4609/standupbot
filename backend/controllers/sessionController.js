const Session = require('../models/Session')
const { revoke, revokeAllExcept } = require('../services/sessionService')

// GET /api/sessions — where I am signed in
const listSessions = async (req, res) => {
  try {
    const rows = await Session.find({ user: req.user._id, revokedAt: null, expiresAt: { $gt: new Date() } })
      .sort({ lastSeenAt: -1 })
      .lean()
    res.json({
      sessions: rows.map(s => ({
        _id: s._id,
        device: s.device,
        ip: s.ip,
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
        current: String(s._id) === String(req.sessionId)
      })),
      // Signed in before sessions were tracked: not listed, still ended by "everywhere"
      untracked: !req.sessionId
    })
  } catch (err) {
    console.error('List sessions error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// DELETE /api/sessions/:id — sign one device out
const endSession = async (req, res) => {
  try {
    const count = await revoke({ _id: req.params.id, user: req.user._id })
    if (!count) return res.status(404).json({ message: 'No such session' })
    res.json({ message: 'Signed out on that device', current: String(req.params.id) === String(req.sessionId) })
  } catch (err) {
    console.error('End session error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/sessions/others — sign out everywhere but here
const endOthers = async (req, res) => {
  try {
    const count = await revokeAllExcept(req.user._id, req.sessionId)
    res.json({ message: count ? `Signed out on ${count} other ${count === 1 ? 'device' : 'devices'}` : 'No other devices were signed in', count })
  } catch (err) {
    console.error('End other sessions error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = { listSessions, endSession, endOthers }
