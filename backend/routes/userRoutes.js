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

// const express = require('express')
// const router = express.Router()
// const { protect } = require('../middleware/authMiddleware')
// const { allowRoles } = require('../middleware/roleMiddleware')
// const { upload } = require('../config/cloudinary')
// const User = require('../models/User')
// const Standup = require('../models/Standup')

// // GET /api/users — admin ke liye sabhi users
// router.get('/', protect, allowRoles('admin'), async (req, res) => {
//   try {
//     const users = await User.find().select('-password').populate('team', 'name')
//     res.json(users)
//   } catch (err) {
//     res.status(500).json({ message: err.message })
//   }
// })

// // GET /api/users/profile — apna profile dekho
// router.get('/profile', protect, async (req, res) => {
//   try {
//     const user = await User.findById(req.user._id)
//       .select('-password')
//       .populate('team', 'name')

//     // Total standups count
//     const totalStandups = await Standup.countDocuments({ user: req.user._id })

//     // Best streak ever — sabse zyada streak
//     const allStandups = await Standup.find({ user: req.user._id })
//       .sort({ date: 1 })

//     // Last 7 days submissions
//     const last7 = []
//     for (let i = 6; i >= 0; i--) {
//       const d = new Date()
//       d.setDate(d.getDate() - i)
//       last7.push(d.toISOString().split('T')[0])
//     }
//     const recentDates = await Standup.find({
//       user: req.user._id,
//       date: { $in: last7 }
//     }).select('date')
//     const submittedDates = recentDates.map(s => s.date)

//     res.json({
//       ...user.toObject(),
//       totalStandups,
//       submittedDates
//     })
//   } catch (err) {
//     res.status(500).json({ message: err.message })
//   }
// })

// // PUT /api/users/profile — profile update karo
// router.put('/profile', protect, async (req, res) => {
//   try {
//     const { name } = req.body
//     if (!name || name.trim() === '') {
//       return res.status(400).json({ message: 'Name required hai' })
//     }

//     const user = await User.findByIdAndUpdate(
//       req.user._id,
//       { name: name.trim() },
//       { new: true }
//     ).select('-password')

//     res.json(user)
//   } catch (err) {
//     res.status(500).json({ message: err.message })
//   }
// })

// // PUT /api/users/change-password — password change karo
// router.put('/change-password', protect, async (req, res) => {
//   try {
//     const { currentPassword, newPassword } = req.body

//     if (!currentPassword || !newPassword) {
//       return res.status(400).json({ message: 'Both passwords required' })
//     }

//     if (newPassword.length < 6) {
//       return res.status(400).json({ message: 'New password min 6 characters hona chahiye' })
//     }

//     const user = await User.findById(req.user._id)
//     const isMatch = await user.matchPassword(currentPassword)
//     if (!isMatch) {
//       return res.status(400).json({ message: 'Current password galat hai' })
//     }

//     user.password = newPassword
//     await user.save()

//     res.json({ message: 'Password changed successfully!' })
//   } catch (err) {
//     res.status(500).json({ message: err.message })
//   }
// })

// // POST /api/users/avatar — avatar upload karo
// router.post('/avatar', protect, upload.single('avatar'), async (req, res) => {
//   try {
//     console.log('Avatar upload request received')
//     console.log('File:', req.file)
//     console.log('Cloudinary config:', {
//       cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//       api_key: process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET',
//       api_secret: process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET'
//     })
//     if (!req.file) {
//       return res.status(400).json({ message: 'Image required hai' })
//     }

//     const user = await User.findByIdAndUpdate(
//       req.user._id,
//       { avatar: req.file.path },
//       { new: true }
//     ).select('-password')

//     res.json({ avatar: user.avatar, message: 'Avatar updated! ✅' })
//   } catch (err) {
//     console.error('Avatar upload error:', err)
//     res.status(500).json({ message: err.message })
//   }
// })



// module.exports = router