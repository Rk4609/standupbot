const mongoose = require('mongoose')

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

  // Older standups also carry `work`, the project hours from the timesheet
  // that has since been dropped for attendance. Left out of the schema so it
  // is neither read nor written, and left in the database untouched.

  // Answers to a team's own questions, keyed by the template question's key.
  // The three core questions stay in their own fields above, because the
  // blocker board, the analytics and the weekly report all read them directly.
  answers:   { type: Map, of: String, default: undefined }
}, { timestamps: true })

/**
 * One person, one day.
 *
 * The controller checks for an existing standup before creating one, which
 * two quick submissions can both pass. The database is the only place that
 * can actually hold this, and the index that enforces it is the same one
 * every per-person query wants: submit, the profile, the employee
 * drill-down and the analytics all filter on user and then date.
 */
standupSchema.index({ user: 1, date: 1 }, { unique: true })

// The other direction: the end-of-day summary, the weekly report and the team
// views all ask for a team's standups over a range of dates
standupSchema.index({ team: 1, date: 1 })

// Reuse an already-compiled model. The same file can be reached both as CJS
// (require, from the controllers) and as ESM (import, from the tests), which
// would otherwise register the schema twice and throw OverwriteModelError.
module.exports = mongoose.models.Standup || mongoose.model('Standup', standupSchema)