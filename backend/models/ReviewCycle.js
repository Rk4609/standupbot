const mongoose = require('mongoose')

/** A review round: the period it looks back on, and when it is due. */
const reviewCycleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  from: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  to: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  dueOn: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: { type: String, default: '' }
}, { timestamps: true })

reviewCycleSchema.index({ createdAt: -1 })

module.exports = mongoose.models.ReviewCycle || mongoose.model('ReviewCycle', reviewCycleSchema)
