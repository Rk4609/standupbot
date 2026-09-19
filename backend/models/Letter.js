const mongoose = require('mongoose')

/**
 * An HR letter: asked for by somebody, or issued to them directly.
 *
 * Everything printed on it is copied in when it is issued — the person's
 * details, the company's, and the wording — so a letter issued last year
 * reads the same after a promotion or a new address. The code lets a bank or
 * a next employer check it is real without signing in.
 */
const TYPES = ['employment', 'salary', 'experience', 'relieving']
const STATUSES = ['requested', 'issued', 'declined', 'cancelled']

const letterSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, default: '' },
  type: { type: String, enum: TYPES, required: true },
  status: { type: String, enum: STATUSES, default: 'requested' },

  purpose: { type: String, default: '', trim: true, maxlength: 200 },
  addressedTo: { type: String, default: '', trim: true, maxlength: 200 },
  requestedAt: { type: Date, default: null },

  // Set on issue
  number: { type: String, default: undefined },
  code: { type: String, default: undefined },
  issuedOn: { type: String, default: '' },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  issuedByName: { type: String, default: '' },
  title: { type: String, default: '' },
  body: { type: [String], default: [] },
  company: {
    name: String,
    address: String,
    email: String,
    phone: String,
    signatory: String,
    signatoryTitle: String
  },

  note: { type: String, default: '', trim: true, maxlength: 300 }
}, { timestamps: true })

letterSchema.index({ number: 1 }, { unique: true, sparse: true })
letterSchema.index({ code: 1 }, { unique: true, sparse: true })
letterSchema.index({ user: 1, createdAt: -1 })
letterSchema.index({ status: 1, createdAt: -1 })

module.exports = mongoose.models.Letter || mongoose.model('Letter', letterSchema)
module.exports.TYPES = TYPES
module.exports.STATUSES = STATUSES
