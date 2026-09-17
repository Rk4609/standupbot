const mongoose = require('mongoose')

/**
 * One signed-in browser or phone.
 *
 * The token carries this row's id, so ending the row ends that sign-in on the
 * next request, without waiting for the token to expire.
 */
const sessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  device: { type: String, default: '', maxlength: 120 },
  // Kept short and partial: enough to recognise "the office", not to track anybody
  ip: { type: String, default: '', maxlength: 60 },
  lastSeenAt: { type: Date, default: Date.now },
  revokedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true }
}, { timestamps: true })

sessionSchema.index({ user: 1, revokedAt: 1, lastSeenAt: -1 })
// Gone from the database once the token could not work anyway
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.models.Session || mongoose.model('Session', sessionSchema)
