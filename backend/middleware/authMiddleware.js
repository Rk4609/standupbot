const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { sessionAllows } = require('../services/sessionService')

const protect = async (req, res, next) => {
  let token = req.headers.authorization?.startsWith('Bearer')
    ? req.headers.authorization.split(' ')[1]
    : null

  if (!token) return res.status(401).json({ message: 'Not authorized' })

  let user
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    // A second-step challenge is not a session
    if (decoded.purpose) throw new Error('not a session token')
    user = await User.findById(decoded.id).select('-password +tokensValidAfter')
    if (user && !(await sessionAllows(decoded, user))) {
      return res.status(401).json({ message: 'This session was signed out' })
    }
    req.sessionId = decoded.sid || null
  } catch {
    return res.status(401).json({ message: 'Token invalid' })
  }

  // ✅ Token valid hai par user DB se delete ho chuka hai
  if (!user) {
    return res.status(401).json({ message: 'User no longer exists' })
  }

  req.user = user
  next()
}

module.exports = { protect }
