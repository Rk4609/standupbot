const mongoose = require('mongoose')

/**
 * One person's pay for one month, as it was worked out at the time.
 *
 * Everything on the slip is copied in, not looked up: a raise in November
 * must not rewrite what September's slip said, and neither may a changed
 * job title or a leave request cancelled after the month was paid.
 */
const lineSchema = new mongoose.Schema({
  label: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  // A line a person may want explained, e.g. "3 days"
  note: { type: String, default: '' }
}, { _id: false })

const payslipSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },

  employee: {
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    employeeId: { type: String, default: '' },
    position: { type: String, default: '' },
    department: { type: String, default: '' },
    team: { type: String, default: '' },
    joinedOn: { type: Date, default: null }
  },

  currency: { type: String, default: 'INR' },

  workingDays: { type: Number, required: true, min: 0 },
  paidDays: { type: Number, required: true, min: 0 },
  lossOfPayDays: { type: Number, default: 0, min: 0 },
  unpaidLeaveDays: { type: Number, default: 0, min: 0 },
  absentDays: { type: Number, default: 0, min: 0 },
  notJoinedDays: { type: Number, default: 0, min: 0 },

  earnings: { type: [lineSchema], default: [] },
  deductions: { type: [lineSchema], default: [] },

  gross: { type: Number, required: true, min: 0 },
  totalDeductions: { type: Number, required: true, min: 0 },
  net: { type: Number, required: true, min: 0 },

  // Approved expense claims paid back with this slip; on top of net pay,
  // outside gross, so no deduction or tax threshold counts them
  reimbursement: { type: Number, default: 0, min: 0 },
  expenses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Expense' }],

  // A draft is only ever seen by whoever runs payroll; publishing is what
  // puts it in front of the person
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },

  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  generatedByName: { type: String, default: '' },
  publishedAt: { type: Date, default: null }
}, { timestamps: true })

// One slip a month per person, and a month's run
payslipSchema.index({ user: 1, month: 1 }, { unique: true })
payslipSchema.index({ month: 1, status: 1 })

module.exports = mongoose.models.Payslip || mongoose.model('Payslip', payslipSchema)
