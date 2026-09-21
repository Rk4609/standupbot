const mongoose = require('mongoose')

/**
 * Somebody a manager wants to bring in, before they are an account.
 *
 * A candidate is not a User: half of them never join, and an account that
 * exists "pending approval" would show up in the roster, the standup
 * reminders and the attendance counts from the day it was created. This is
 * the same shape as a person's record, held to one side until an admin says
 * yes — at which point it becomes one, in a single step, with nothing
 * retyped.
 */
const STATUSES = ['pending', 'approved', 'rejected']
const TYPES = ['intern', 'probation', 'full-time', 'contract']

const candidateSchema = new mongoose.Schema({
  /* who they are */
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
  phone: { type: String, default: '', trim: true, maxlength: 30 },
  dob: { type: Date, default: null },

  address: {
    line1: { type: String, default: '', trim: true, maxlength: 200 },
    city: { type: String, default: '', trim: true, maxlength: 80 },
    state: { type: String, default: '', trim: true, maxlength: 80 },
    pincode: { type: String, default: '', trim: true, maxlength: 12 },
    country: { type: String, default: '', trim: true, maxlength: 80 }
  },

  /* what they would do */
  position: { type: String, required: true, trim: true, maxlength: 80 },
  department: { type: String, default: '', trim: true, maxlength: 80 },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  type: { type: String, enum: TYPES, default: 'full-time' },

  joiningOn: { type: Date, default: null },
  startsOn: { type: Date, default: null },
  endsOn: { type: Date, default: null },
  experienceYears: { type: Number, default: 0, min: 0, max: 60 },

  // What was agreed, if it was. Read and written only by somebody whose role
  // includes pay, the same rule the records screen follows.
  expectedSalary: {
    amount: { type: Number, default: null, min: 0 },
    currency: { type: String, default: 'INR', trim: true, maxlength: 8 },
    period: { type: String, enum: ['month', 'year'], default: 'year' }
  },

  // Optional on purpose: a CV is often a link in a message, and a hire should
  // not wait on a file upload
  cv: {
    url: { type: String, default: '', trim: true, maxlength: 500 },
    name: { type: String, default: '', trim: true, maxlength: 200 }
  },

  notes: { type: String, default: '', trim: true, maxlength: 2000 },

  /* the decision */
  status: { type: String, enum: STATUSES, default: 'pending' },

  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  submittedByName: { type: String, default: '' },

  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decidedByName: { type: String, default: '' },
  decidedAt: { type: Date, default: null },

  // Required on a rejection: "no" without a reason is a conversation the
  // manager has to start from nothing
  reason: { type: String, default: '', trim: true, maxlength: 1000 },

  // The account this became, so an approved row links to a real person
  createdUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true })

// The queue: what is waiting, newest first. And one manager's own list.
candidateSchema.index({ status: 1, createdAt: -1 })
candidateSchema.index({ submittedBy: 1, createdAt: -1 })

module.exports = mongoose.models.Candidate || mongoose.model('Candidate', candidateSchema)
module.exports.STATUSES = STATUSES
module.exports.TYPES = TYPES
