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

module.exports = mongoose.model('Standup', standupSchema)