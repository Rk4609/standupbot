const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: [
      'standup_submitted',
      'blocker_added',
      'reminder',
      // The help desk: somebody reported something, or somebody answered
      'support_raised',
      'support_replied',
      'support_closed',
      // Hiring: one waiting on a decision, and the decision itself
      'hiring_submitted',
      'hiring_decided',
      // Leave: somebody asked for time off, and the answer
      'leave_requested',
      'leave_decided',
      // Payroll: this month's slip is out
      'payslip_ready'
    ],
    required: true
  },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  link: { type: String, default: '/team' }
}, { timestamps: true })

// Reuse an already-compiled model. The same file can be reached both as CJS
// (require, from the controllers) and as ESM (import, from the tests), which
// would otherwise register the schema twice and throw OverwriteModelError.
// The bell: newest first for one person, and an unread count for the badge
notificationSchema.index({ recipient: 1, createdAt: -1 })
notificationSchema.index({ recipient: 1, isRead: 1 })

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema)