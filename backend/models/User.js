  const mongoose = require('mongoose')
  const bcrypt = require('bcryptjs')
  const { isValidTimezone } = require('../utils/time')

  const userSchema = new mongoose.Schema({
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role:     { type: String, enum: ['admin', 'manager', 'employee'], default: 'employee' },

    // The named role somebody was given, when it is not simply one of the
    // three. `role` above stays the authority the server enforces — a named
    // role carries its own `base` and is only ever assigned together with it,
    // so every existing check keeps working and cannot be widened from here.
    accessRole: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
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

    /* who they are outside work ------------------------------------- */

    dob: { type: Date, default: null },
    phone: { type: String, default: '', trim: true, maxlength: 30 },

    address: {
      line1: { type: String, default: '', trim: true, maxlength: 200 },
      city: { type: String, default: '', trim: true, maxlength: 80 },
      state: { type: String, default: '', trim: true, maxlength: 80 },
      // Kept as text, not a number: leading zeros are real in half the world
      pincode: { type: String, default: '', trim: true, maxlength: 12 },
      country: { type: String, default: '', trim: true, maxlength: 80 }
    },

    /* what they do here ---------------------------------------------- */

    employment: {
      employeeId: { type: String, default: '', trim: true, maxlength: 24 },
      position: { type: String, default: '', trim: true, maxlength: 80 },
      department: { type: String, default: '', trim: true, maxlength: 80 },

      // An intern and a permanent hire are the same person to every other
      // part of this app; the difference is a date somebody has to watch
      type: {
        type: String,
        enum: ['intern', 'probation', 'full-time', 'contract'],
        default: 'full-time'
      },

      joinedOn: { type: Date, default: null },

      // Only meaningful while `type` is intern or probation, and the reason
      // this exists at all: somebody has to be told before it runs out
      startsOn: { type: Date, default: null },
      endsOn: { type: Date, default: null },

      // Years brought in from elsewhere. What they have done here is the
      // joining date, which does not need storing twice.
      experienceYears: { type: Number, default: 0, min: 0, max: 60 }
    },

    /* what they are paid --------------------------------------------- */

    // Its own field rather than part of `employment` so it can be left out
    // of a query in one word. Every reader that is not allowed pay details
    // selects '-salary', and the roles module decides who that is.
    salary: {
      amount: { type: Number, default: null, min: 0 },
      currency: { type: String, default: 'INR', trim: true, maxlength: 8 },
      period: { type: String, enum: ['month', 'year'], default: 'year' },
      reviewedOn: { type: Date, default: null }
    },

    // Two-step sign-in. The secret is stored encrypted (utils/totp) and none
    // of it is read unless asked for, so no profile or list can carry it.
    twoFactor: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, default: null, select: false },
      pendingSecret: { type: String, default: null, select: false },
      recovery: { type: [String], default: [], select: false },
      enabledAt: { type: Date, default: null }
    },

    // Tokens issued before this were signed out ("sign out everywhere")
    tokensValidAfter: { type: Date, default: null, select: false },

    // Forgot password fields
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpire: { type: Date, default: null }
  }, { timestamps: true })

  // The employees list pages through one team, ordered by name. Email is
  // already unique, which indexes it for sign-in.
  userSchema.index({ team: 1, name: 1 })

  // The hourly reminder round walks every employee
  userSchema.index({ role: 1 })

  // People records: filtered by what somebody is, and by whose internship
  // is running out next
  userSchema.index({ 'employment.type': 1, 'employment.endsOn': 1 })

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