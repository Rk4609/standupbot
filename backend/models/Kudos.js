const mongoose = require('mongoose')

/**
 * A thank-you from one person to another, said where the team can see it.
 *
 * Kept deliberately small: who, to whom, what for, and which of a handful of
 * values it was. Teammates can add a cheer; nobody can edit what was said.
 */
const VALUES = ['teamwork', 'ownership', 'helpful', 'quality', 'extra-mile']

const kudosSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromName: { type: String, default: '' },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toName: { type: String, default: '' },

  // The recipient's team, which is whose feed this appears in
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },

  value: { type: String, enum: VALUES, default: 'teamwork' },
  message: { type: String, required: true, trim: true, maxlength: 280 },

  cheers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true })

kudosSchema.index({ team: 1, createdAt: -1 })
kudosSchema.index({ to: 1, createdAt: -1 })
kudosSchema.index({ from: 1, createdAt: -1 })

module.exports = mongoose.models.Kudos || mongoose.model('Kudos', kudosSchema)
module.exports.VALUES = VALUES
