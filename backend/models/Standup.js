const mongoose = require('mongoose')

/**
 * Where a day's hours went.
 *
 * Kept on the standup rather than in a table of its own: this is the same
 * act of reporting, entered at the same moment, and splitting it would mean a
 * person could file a standup and a timesheet that disagree about the day.
 */
const workEntrySchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  hours: { type: Number, required: true, min: 0.25, max: 24 },
  note: { type: String, default: '', trim: true, maxlength: 500 }
}, { _id: false })

const standupSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  team:      { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null }, // ← required hata diya
  // Not required any more: a template may mark "yesterday" optional, and a
  // team that does not ask it should not be forced to store an empty answer
  // under a required field
  yesterday: { type: String, default: '' },
  today:     { type: String, required: true },
  blockers:  { type: String, default: 'None' },
  hasBlocker:{ type: Boolean, default: false },
  mood:      { type: String, enum: ['great','good','okay','bad','stressed'], default: 'good' },
  date:      { type: String, required: true },

  // Where the day went, when the team tracks time. Empty for a team that
  // does not, which is every team until a lead turns it on.
  work:      { type: [workEntrySchema], default: [] },

  // Answers to a team's own questions, keyed by the template question's key.
  // The three core questions stay in their own fields above, because the
  // blocker board, the analytics and the retro all read them directly.
  answers:   { type: Map, of: String, default: undefined }
}, { timestamps: true })

// Reuse an already-compiled model. The same file can be reached both as CJS
// (require, from the controllers) and as ESM (import, from the tests), which
// would otherwise register the schema twice and throw OverwriteModelError.
module.exports = mongoose.models.Standup || mongoose.model('Standup', standupSchema)