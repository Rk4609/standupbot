const { Readable } = require('stream')
const { cloudinary } = require('../config/cloudinary')
const User = require('../models/User')
const Standup = require('../models/Standup')

// ✅ Helper — last 7 dates (YYYY-MM-DD)
const getLast7Dates = () => {
  const dates = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

// GET /api/users — admin ke liye sabhi users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').populate('team', 'name')
    res.json(users)
  } catch (err) {
    console.error('Get users error:', err)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/users/profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('team', 'name')

    const totalStandups = await Standup.countDocuments({ user: req.user._id })

    const last7 = getLast7Dates()
    const recentDates = await Standup.find({
      user: req.user._id,
      date: { $in: last7 }
    }).select('date')

    const submittedDates = recentDates.map(s => s.date)

    res.json({ ...user.toObject(), totalStandups, submittedDates })
  } catch (err) {
    console.error('Get profile error:', err)
    res.status(500).json({ message: err.message })
  }
}

// PUT /api/users/profile
const updateProfile = async (req, res) => {
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
    console.error('Update profile error:', err)
    res.status(500).json({ message: err.message })
  }
}

// PUT /api/users/change-password
const changePassword = async (req, res) => {
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
    console.error('Change password error:', err)
    res.status(500).json({ message: err.message })
  }
}

// ✅ Buffer → Stream → Cloudinary
const uploadToCloudinary = (buffer) => {
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
    readable.push(buffer)
    readable.push(null)
    readable.pipe(uploadStream)
  })
}

// POST /api/users/avatar
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Image required hai' })
    }

    const result = await uploadToCloudinary(req.file.buffer)

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
}


// PATCH /api/users/:id/role — admin grants manager/admin
const setUserRole = async (req, res) => {
  try {
    const { role } = req.body

    // An admin demoting themselves could leave the instance with no admin at
    // all, and they would lose the page they are standing on.
    if (String(req.user._id) === req.params.id) {
      return res.status(400).json({ message: 'You cannot change your own role' })
    }

    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    if (user.role === role) {
      return res.json({ message: `Already ${role}`, user: sanitise(user) })
    }

    const previous = user.role
    user.role = role
    await user.save()

    console.log(`Role change: ${user.email} ${previous} -> ${role} by ${req.user.email}`)

    res.json({
      message: `${user.name} is now ${role}`,
      user: sanitise(user)
    })
  } catch (err) {
    console.error('Set role error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

/** Never let the hash or reset token leave the server. */
const sanitise = (user) => {
  const { password, resetPasswordToken, resetPasswordExpire, ...rest } = user.toObject()
  return rest
}

module.exports = {
  getAllUsers,
  setUserRole,
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar
}
