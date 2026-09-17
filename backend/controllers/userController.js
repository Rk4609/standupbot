const { Readable } = require('stream')
const { cloudinary } = require('../config/cloudinary')
const User = require('../models/User')
const { revokeAllExcept } = require('../services/sessionService')
const Standup = require('../models/Standup')
const { isValidTimezone, lastNDates, zoneOf } = require('../utils/time')
const audit = require('../services/auditService')
const { invalidate, modulesFor, roleFor } = require('../services/roleService')

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

    const last7 = lastNDates(7, zoneOf(req.user))
    const recentDates = await Standup.find({
      user: req.user._id,
      date: { $in: last7 }
    }).select('date')

    const submittedDates = recentDates.map(s => s.date)

    const role = await roleFor(req.user)

    res.json({
      ...user.toObject(),
      totalStandups,
      submittedDates,
      // What the sidebar and the route guard read. Sent with the profile so
      // the first paint is already correct rather than briefly showing rows
      // this person cannot open.
      roleName: role?.name || user.role,
      modules: await modulesFor(req.user)
    })
  } catch (err) {
    console.error('Get profile error:', err)
    res.status(500).json({ message: err.message })
  }
}

// PUT /api/users/profile
const updateProfile = async (req, res) => {
  try {
    const { name, timezone } = req.body
    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Name required hai' })
    }

    const update = { name: name.trim() }

    // Rejecting an unknown zone here is worth the extra check: silently
    // storing one would file every later standup under the wrong day
    if (timezone !== undefined) {
      if (timezone !== '' && !isValidTimezone(timezone)) {
        return res.status(400).json({ message: `${timezone} is not a known timezone` })
      }
      update.timezone = timezone
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      update,
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

    // Every other device has to sign in with the new password
    const signedOut = await revokeAllExcept(user._id, req.sessionId)

    res.json({ message: 'Password changed successfully!', signedOut })
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

    if (user.role === role && !user.accessRole) {
      return res.json({ message: `Already ${role}`, user: sanitise(user) })
    }

    const previous = user.role
    user.role = role
    // The three-way select means one of the three. Somebody moved back to a
    // plain role should not keep a named one whose modules still apply.
    user.accessRole = null
    await user.save()
    invalidate()

    // This used to be a console line only, which Render discards. Granting
    // someone manager or admin is the most consequential thing anyone can do
    // here, so it belongs in a record that outlives the process.
    await audit.record({
      action: 'user.role_changed',
      actor: req.user,
      subject: user,
      team: user.team || null,
      entityType: 'User',
      entityId: user._id,
      changes: [{ field: 'role', from: previous, to: role }]
    })

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
