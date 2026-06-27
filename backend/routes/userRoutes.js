const express = require('express')
const router = express.Router()
const { Readable } = require('stream')
const { protect } = require('../middleware/authMiddleware')
const { allowRoles } = require('../middleware/roleMiddleware')
const { upload, cloudinary } = require('../config/cloudinary')
const User = require('../models/User')
const Standup = require('../models/Standup')

// GET /api/users — admin ke liye sabhi users
router.get('/', protect, allowRoles('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password').populate('team', 'name')
    res.json(users)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/users/profile
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('team', 'name')

    const totalStandups = await Standup.countDocuments({ user: req.user._id })

    const last7 = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      last7.push(d.toISOString().split('T')[0])
    }

    const recentDates = await Standup.find({
      user: req.user._id,
      date: { $in: last7 }
    }).select('date')

    const submittedDates = recentDates.map(s => s.date)

    res.json({ ...user.toObject(), totalStandups, submittedDates })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/users/profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { name } = req.body
    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Name required hai' })
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name: name.trim() },
      { new: true }
    ).select('-password')
    res.json(user)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/users/change-password
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both passwords required' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password min 6 characters hona chahiye' })
    }

    const user = await User.findById(req.user._id)
    const isMatch = await user.matchPassword(currentPassword)
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password galat hai' })
    }

    user.password = newPassword
    await user.save()

    res.json({ message: 'Password changed successfully!' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/users/avatar
router.post('/avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Image required hai' })
    }

    // ✅ Buffer → Stream → Cloudinary
    const uploadToCloudinary = () => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'standupbot/avatars',
            transformation: [
              { width: 200, height: 200, crop: 'fill', gravity: 'face' }
            ],
            resource_type: 'image'
          },
          (error, result) => {
            if (error) reject(error)
            else resolve(result)
          }
        )

        const readable = new Readable()
        readable.push(req.file.buffer)
        readable.push(null)
        readable.pipe(uploadStream)
      })
    }

    const result = await uploadToCloudinary()

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: result.secure_url },
      { new: true }
    ).select('-password')

    res.json({ avatar: user.avatar, message: 'Avatar updated! ✅' })

  } catch (err) {
    console.error('Avatar upload error:', err.message)
    res.status(500).json({ message: err.message || 'Avatar upload failed' })
  }
})

module.exports = router