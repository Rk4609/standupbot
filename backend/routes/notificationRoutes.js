const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const Notification = require('../models/Notification')

// GET — sabhi notifications
router.get('/', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user._id
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('sender', 'name')
    res.json(notifications)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET — unread count
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false
    })
    res.json({ count })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ✅ read-all PEHLE hona chahiye — /:id se pehle!
router.put('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true }
    )
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ✅ /:id BAAD mein
router.put('/:id/read', protect, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router