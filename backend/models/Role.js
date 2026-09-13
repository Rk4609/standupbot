const mongoose = require('mongoose')
const { BASES, DEFAULTS, MODULE_KEYS } = require('../utils/modules')

/**
 * A named set of module access, on top of one of the three authority levels.
 *
 * `base` is what the server enforces — every existing route still asks "is
 * this an admin?" and gets a straight answer, so a role called "Delivery
 * lead" based on `manager` can never reach further than a manager could.
 * `modules` is what that role is actually given inside those limits: it can
 * take things away from a manager, and it can hand a second manager-level
 * role a different slice, without any of it becoming a new authority level.
 *
 * The three built-in roles are the ones every account already had. They stay
 * undeletable because `user.role` still carries one of their keys, and an
 * account whose role does not resolve would have no access to anything.
 */
const roleSchema = new mongoose.Schema({
  // Stable, lowercase, used in URLs and as the built-in link to user.role
  key: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'A role key is lowercase letters, digits and dashes']
  },

  name: { type: String, required: true, trim: true, maxlength: 60 },
  description: { type: String, default: '', trim: true, maxlength: 200 },

  base: { type: String, enum: BASES, default: 'employee' },

  modules: {
    type: [String],
    default: () => DEFAULTS.employee,
    validate: {
      validator: (list) => list.every(key => MODULE_KEYS.includes(key)),
      message: 'That is not a module anybody can be given'
    }
  },

  // The three that shipped with the app. Editable, but never deleted.
  builtIn: { type: Boolean, default: false },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true })

// The roles screen lists built-ins first, then whatever was added
roleSchema.index({ builtIn: -1, name: 1 })

module.exports = mongoose.models.Role || mongoose.model('Role', roleSchema)
