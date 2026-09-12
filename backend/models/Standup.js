const mongoose = require('mongoose')

const standupSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  team:      { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null }, // ← required hata diya
  yesterday: { type: String, required: true },
  today:     { type: String, required: true },
  blockers:  { type: String, default: 'None' },
  hasBlocker:{ type: Boolean, default: false },
  mood:      { type: String, enum: ['great','good','okay','bad','stressed'], default: 'good' },
  date:      { type: String, required: true }
}, { timestamps: true })

// Reuse an already-compiled model. The same file can be reached both as CJS
// (require, from the controllers) and as ESM (import, from the tests), which
// would otherwise register the schema twice and throw OverwriteModelError.
module.exports = mongoose.models.Standup || mongoose.model('Standup', standupSchema)