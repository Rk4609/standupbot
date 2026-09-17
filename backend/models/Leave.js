const mongoose = require('mongoose')

/**
 * One request for time off, from asking to the answer.
 *
 * Dates are calendar days as 'YYYY-MM-DD' strings, like a standup's date:
 * a day off has no time in it, and storing midnight in some zone moves it to
 * the day before for half the team.
 */
const TYPES = ['casual', 'sick', 'earned', 'unpaid']
const STATUSES = ['pending', 'approved', 'rejected', 'cancelled']

const leaveSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, default: '' },

  // The team at the time of asking, which is whose manager answers
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },

  type: { type: String, enum: TYPES, required: true },
  from: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  to: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  halfDay: { type: Boolean, default: false },

  // Working days it costs, worked out once when asked — weekends are free
  days: { type: Number, required: true, min: 0.5 },

  reason: { type: String, required: true, trim: true, maxlength: 500 },

  status: { type: String, enum: STATUSES, default: 'pending' },

  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decidedByName: { type: String, default: '' },
  decidedAt: { type: Date, default: null },

  // Required on a rejection, optional on an approval
  note: { type: String, default: '', trim: true, maxlength: 500 }
}, { timestamps: true })

// One person's own list, and the overlap check on asking
leaveSchema.index({ user: 1, from: -1 })
// A manager's queue, and the calendar
leaveSchema.index({ team: 1, status: 1, from: -1 })
leaveSchema.index({ status: 1, from: 1, to: 1 })

module.exports = mongoose.models.Leave || mongoose.model('Leave', leaveSchema)
module.exports.TYPES = TYPES
module.exports.STATUSES = STATUSES
