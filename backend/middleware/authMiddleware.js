const jwt = require('jsonwebtoken')
const User = require('../models/User')

const protect = async (req, res, next) => {
  let token = req.headers.authorization?.startsWith('Bearer')
    ? req.headers.authorization.split(' ')[1]
    : null

  if (!token) return res.status(401).json({ message: 'Not authorized' })

  let user
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    user = await User.findById(decoded.id).select('-password')
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
