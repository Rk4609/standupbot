const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const User = require('../models/User')
const { sendResetPasswordEmail } = require('../services/emailService')

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' })

// POST /api/auth/register — (existing)
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email aur password required hain' })
    }

    const exists = await User.findOne({ email })
    if (exists) {
      return res.status(400).json({ message: 'Email already registered hai' })
    }

    const validRoles = ['manager', 'member']
    const userRole = validRoles.includes(role) ? role : 'member'

    if (role === 'admin') {
      return res.status(403).json({
        message: 'Admin account directly create nahi ho sakta'
      })
    }

    const user = await User.create({ name, email, password, role: userRole })

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      streak: user.streak || 0,
      token: generateToken(user._id)
    })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/auth/login — (existing)
const login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email aur password required hain' })
    }

    const user = await User.findOne({ email })
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email ya password' })
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      streak: user.streak || 0,
      token: generateToken(user._id)
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ message: err.message })
  }
}

// ✅ POST /api/auth/forgot-password — Reset link bhejo
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ message: 'Email required hai' })
    }

    const user = await User.findOne({ email })

    // Security — user exist nahi karta toh bhi same message do
    if (!user) {
      return res.json({
        message: 'Agar yeh email registered hai, toh reset link bhej diya gaya hai'
      })
    }

    // ✅ Random token generate karo
    const resetToken = crypto.randomBytes(32).toString('hex')

    // Token ko hash karke DB mein store karo (security)
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex')

    user.resetPasswordToken = hashedToken
    user.resetPasswordExpire = Date.now() + 60 * 60 * 1000 // 1 hour
    await user.save()

    // ✅ Reset URL banao — plain token URL mein jayega
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`

    await sendResetPasswordEmail(user.email, user.name, resetUrl)

    res.json({
      message: 'Agar yeh email registered hai, toh reset link bhej diya gaya hai'
    })
  } catch (err) {
    console.error('Forgot password error:', err)
    res.status(500).json({ message: 'Email bhejne mein error aaya' })
  }
}

// ✅ PUT /api/auth/reset-password/:token — Naya password set karo
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params
    const { password } = req.body

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password min 6 characters hona chahiye' })
    }

    // Token hash karo aur match karo
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex')

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() } // Expire nahi hona chahiye
    })

    if (!user) {
      return res.status(400).json({
        message: 'Reset link invalid ya expire ho chuka hai. Dobara try karo.'
      })
    }

    // ✅ Password update karo
    user.password = password
    user.resetPasswordToken = null
    user.resetPasswordExpire = null
    await user.save()

    res.json({ message: 'Password successfully reset ho gaya! Login karo.' })
  } catch (err) {
    console.error('Reset password error:', err)
    res.status(500).json({ message: err.message })
  }
}

// ✅ GET /api/auth/verify-reset-token/:token — Token valid hai check karo
const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex')

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    })

    if (!user) {
      return res.status(400).json({ valid: false, message: 'Link is expired' })
    }

    res.json({ valid: true, email: user.email })
  } catch (err) {
    res.status(500).json({ valid: false, message: err.message })
  }
}

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  verifyResetToken
}