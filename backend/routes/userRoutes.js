const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles } = require('../middleware/roleMiddleware')
const User = require('../models/User')

// GET /api/users — admin ke liye sabhi users
router.get('/', protect, allowRoles('admin'), async (req, res) => {
  const users = await User.find().select('-password').populate('team', 'name')
  res.json(users)
})

module.exports = router