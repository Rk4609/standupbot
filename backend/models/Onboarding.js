const mongoose = require('mongoose')
const { OWNERS } = require('../utils/onboardingPlan')

/**
 * Somebody's first weeks, as a checklist three people work through.
 *
 * One per person. It is made when a hire is approved, or started by hand for
 * somebody who joined before this existed, and it is finished when the last
 * task is ticked.
 */
const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  owner: { type: String, enum: OWNERS, required: true },
  dueOn: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },

  done: { type: Boolean, default: false },
  doneBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  doneByName: { type: String, default: '' },
  doneAt: { type: Date, default: null },

  note: { type: String, default: '', trim: true, maxlength: 300 }
})

const onboardingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  userName: { type: String, default: '' },
  position: { type: String, default: '' },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },

  startsOn: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },

  tasks: { type: [taskSchema], default: [] },

  status: { type: String, enum: ['active', 'complete'], default: 'active' },
  completedAt: { type: Date, default: null },

  // The hire it came from, when it came from one
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', default: null },
  startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  startedByName: { type: String, default: '' }
}, { timestamps: true })

onboardingSchema.index({ status: 1, startsOn: -1 })
onboardingSchema.index({ team: 1, status: 1 })

module.exports = mongoose.models.Onboarding || mongoose.model('Onboarding', onboardingSchema)
