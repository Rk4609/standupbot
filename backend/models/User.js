  const mongoose = require('mongoose')
  const bcrypt = require('bcryptjs')
  const { isValidTimezone } = require('../utils/time')

  const userSchema = new mongoose.Schema({
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role:     { type: String, enum: ['admin', 'manager', 'employee'], default: 'employee' },
    team:     { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    streak:   { type: Number, default: 0 },
    lastSubmission: { type: Date, default: null },

    // The calendar day of the last standup, in the user's own zone. The
    // instant in `lastSubmission` cannot answer "was that yesterday?" without
    // knowing where they were, which is exactly what broke streaks.
    lastStandupDate: { type: String, default: null },

    // IANA name, e.g. 'Asia/Kolkata'. Blank means never chosen, and every
    // reader falls back to UTC rather than to the server's own zone.
    timezone: {
      type: String,
      default: '',
      validate: {
        validator: (v) => v === '' || isValidTimezone(v),
        message: (p) => `${p.value} is not a known timezone`
      }
    },
    avatar:   { type: String, default: '' },
    // Forgot password fields
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpire: { type: Date, default: null }
  }, { timestamps: true })

  // async/await
  userSchema.pre('save', async function() {
    if (!this.isModified('password')) return
    // bcrypt is intentionally slow. The test suite hashes hundreds of
    // fixture passwords, so drop the work factor there — production keeps 10.
    const salt = await bcrypt.genSalt(process.env.NODE_ENV === 'test' ? 4 : 10)
    this.password = await bcrypt.hash(this.password, salt)
  })

  userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password)
  }

  // Reuse an already-compiled model. The same file can be reached both as CJS
// (require, from the controllers) and as ESM (import, from the tests), which
// would otherwise register the schema twice and throw OverwriteModelError.
module.exports = mongoose.models.User || mongoose.model('User', userSchema)