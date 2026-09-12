const mongoose = require('mongoose')

/**
 * One person's week, and what happened to it.
 *
 * The hours themselves are not stored here — they live on the standups, which
 * is where they were entered, and duplicating them would leave two versions
 * of the same truth to disagree.
 *
 * What is stored is the part the standups cannot answer: whether the week was
 * submitted, who reviewed it and what they said. Plus a snapshot of the
 * totals as they stood at submission, so an edit afterwards cannot silently
 * change what a manager approved — the grid shows both and says they differ.
 */
const STATUSES = ['draft', 'submitted', 'approved', 'changes_requested']

const lineSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  projectName: { type: String, default: '' },
  hours: { type: Number, default: 0 }
}, { _id: false })

const timesheetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },

  // Monday of the week, 'YYYY-MM-DD'
  weekStart: { type: String, required: true },

  status: { type: String, enum: STATUSES, default: 'draft' },

  // What the week added up to when it was submitted
  lines: { type: [lineSchema], default: [] },
  totalHours: { type: Number, default: 0 },

  submittedAt: { type: Date, default: null },

  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },

  // Why it was sent back. Approving without a reason is fine; rejecting
  // without one is not, and the controller enforces that.
  note: { type: String, default: '', maxlength: 500 }
}, { timestamps: true })

timesheetSchema.index({ user: 1, weekStart: 1 }, { unique: true })
timesheetSchema.index({ team: 1, weekStart: 1, status: 1 })

module.exports = mongoose.models.Timesheet || mongoose.model('Timesheet', timesheetSchema)
module.exports.STATUSES = STATUSES
