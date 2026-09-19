const mongoose = require('mongoose')

/**
 * One person's review in one cycle.
 *
 * Two halves: what they say about themselves, and what their manager says.
 * Each side sees the other's half only when it is finished: the manager
 * after the self-review is in, the employee once the review is shared.
 */
const AREAS = ['quality', 'delivery', 'teamwork', 'ownership', 'communication']
const STATUSES = ['self', 'manager', 'shared', 'acknowledged']

const ratings = () => Object.fromEntries(AREAS.map(a => [a, { type: Number, min: 1, max: 5, default: null }]))

const reviewSchema = new mongoose.Schema({
  cycle: { type: mongoose.Schema.Types.ObjectId, ref: 'ReviewCycle', required: true },
  cycleName: { type: String, default: '' },
  from: { type: String, required: true },
  to: { type: String, required: true },

  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  employeeName: { type: String, default: '' },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  // Their team's manager; null means any admin writes it
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewerName: { type: String, default: '' },

  status: { type: String, enum: STATUSES, default: 'self' },

  self: {
    ratings: ratings(),
    wins: { type: String, default: '', maxlength: 2000 },
    improve: { type: String, default: '', maxlength: 2000 },
    submittedAt: { type: Date, default: null }
  },

  manager: {
    ratings: ratings(),
    strengths: { type: String, default: '', maxlength: 2000 },
    growth: { type: String, default: '', maxlength: 2000 },
    overall: { type: Number, min: 1, max: 5, default: null },
    writtenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    writtenByName: { type: String, default: '' },
    sharedAt: { type: Date, default: null }
  },

  acknowledgedAt: { type: Date, default: null },
  employeeComment: { type: String, default: '', maxlength: 1000 }
}, { timestamps: true })

reviewSchema.index({ cycle: 1, employee: 1 }, { unique: true })
reviewSchema.index({ employee: 1, createdAt: -1 })
reviewSchema.index({ reviewer: 1, cycle: 1 })

module.exports = mongoose.models.Review || mongoose.model('Review', reviewSchema)
module.exports.AREAS = AREAS
module.exports.STATUSES = STATUSES
