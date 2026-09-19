const mongoose = require('mongoose')

/**
 * Money somebody spent for work and wants back.
 *
 * Asked for with a receipt, answered by their manager, and paid on the next
 * payroll: the payslip it went out on is recorded here, so it is paid once.
 */
const CATEGORIES = ['travel', 'food', 'stay', 'equipment', 'internet', 'other']
const STATUSES = ['pending', 'approved', 'rejected', 'paid', 'cancelled']

const expenseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, default: '' },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },

  category: { type: String, enum: CATEGORIES, required: true },
  amount: { type: Number, required: true, min: 1, max: 1_000_000 },
  currency: { type: String, default: 'INR' },
  spentOn: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  description: { type: String, required: true, trim: true, maxlength: 300 },

  receipt: {
    url: { type: String, default: '', maxlength: 500 },
    name: { type: String, default: '', maxlength: 200 }
  },

  status: { type: String, enum: STATUSES, default: 'pending' },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decidedByName: { type: String, default: '' },
  decidedAt: { type: Date, default: null },
  note: { type: String, default: '', trim: true, maxlength: 300 },

  // Set when a payslip carrying it is published
  paidIn: { type: mongoose.Schema.Types.ObjectId, ref: 'Payslip', default: null },
  paidMonth: { type: String, default: '' }
}, { timestamps: true })

expenseSchema.index({ user: 1, createdAt: -1 })
expenseSchema.index({ team: 1, status: 1, createdAt: -1 })
expenseSchema.index({ user: 1, status: 1 })

module.exports = mongoose.models.Expense || mongoose.model('Expense', expenseSchema)
module.exports.CATEGORIES = CATEGORIES
module.exports.STATUSES = STATUSES
