const mongoose = require('mongoose')

/**
 * Somebody says something is wrong, and somebody answers.
 *
 * Kept deliberately small: a message, who wrote it, and a thread of replies.
 * The alternative — a full tracker with priorities, labels and assignees —
 * is a product of its own, and nobody fills in five fields to report that a
 * button does nothing.
 */
const STATUSES = ['open', 'answered', 'closed']
const CATEGORIES = ['bug', 'question', 'access', 'data', 'other']

/**
 * Two shapes of ticket. An `issue` is a sentence somebody wrote; a
 * `data-change` also names one field and the value it should hold, which is
 * what lets an admin act on it with a click instead of retyping it into
 * another screen and getting it wrong.
 */
const KINDS = ['issue', 'data-change']

const replySchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Denormalised so a reply still reads correctly after the account is
  // renamed or removed — the same reason the audit trail carries them
  authorName: { type: String, default: '' },
  authorRole: { type: String, default: '' },

  body: { type: String, required: true, trim: true, maxlength: 4000 }
}, { timestamps: { createdAt: true, updatedAt: false } })

const supportTicketSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, default: '' },
  userEmail: { type: String, default: '' },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },

  subject: { type: String, required: true, trim: true, maxlength: 160 },
  body: { type: String, required: true, trim: true, maxlength: 4000 },

  category: { type: String, enum: CATEGORIES, default: 'other' },
  kind: { type: String, enum: KINDS, default: 'issue' },

  // Only on a data-change. `current` is a snapshot taken when it was raised,
  // so a reader can see what it was even after it has been changed.
  request: {
    field: { type: String, default: '' },
    current: { type: String, default: '' },
    proposed: { type: String, default: '' },
    appliedAt: { type: Date, default: null },
    appliedBy: { type: String, default: '' }
  },
  status: { type: String, enum: STATUSES, default: 'open' },

  replies: { type: [replySchema], default: [] },

  // So a reader can tell a new answer from one they have already seen
  lastReplyAt: { type: Date, default: null },
  lastReplyBy: { type: String, default: '' }
}, { timestamps: true })

// The two ways this is read: one person's own, and everything still open
supportTicketSchema.index({ user: 1, createdAt: -1 })
supportTicketSchema.index({ status: 1, createdAt: -1 })

module.exports = mongoose.models.SupportTicket ||
  mongoose.model('SupportTicket', supportTicketSchema)
module.exports.STATUSES = STATUSES
module.exports.CATEGORIES = CATEGORIES
module.exports.KINDS = KINDS
