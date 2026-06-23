const jwt = require('jsonwebtoken')
const User = require('../models/User')

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' })

// POST /api/auth/register
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

    // Role validate karo
    const validRoles = ['admin', 'manager', 'member']
    const userRole = validRoles.includes(role) ? role : 'member'

    const user = await User.create({
      name,
      email,
      password,
      role: userRole
    })

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

// POST /api/auth/login
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

module.exports = { register, login }