const mongoose = require('mongoose')

/**
 * The questions a team is asked each day.
 *
 * Three questions carry meaning elsewhere in the app: `blockers` is what the
 * blocker board and the alerts read, and `today` and `yesterday` are what the
 * retro and the export summarise. Those keep their keys and can be reworded,
 * reordered or made optional — but not removed, because dropping them would
 * quietly blind half the product rather than customise it.
 *
 * Anything else a team wants to ask is a free question, and its answers live
 * in the standup's `answers` map.
 */
const CORE_KEYS = ['yesterday', 'today', 'blockers']

const questionSchema = new mongoose.Schema({
  // Stable identifier: answers are keyed by it, so renaming a label must not
  // orphan the answers already given
  key: {
    type: String,
    required: true,
    match: [/^[a-z][a-z0-9_]{0,39}$/, 'must be lowercase letters, digits and underscores']
  },
  label: { type: String, required: true, trim: true, maxlength: 160 },
  placeholder: { type: String, default: '', trim: true, maxlength: 160 },
  type: { type: String, enum: ['short', 'long'], default: 'long' },
  required: { type: Boolean, default: false }
}, { _id: false })

const templateSchema = new mongoose.Schema({
  // One per team. Null is the instance-wide fallback for anyone with no team.
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null,
    unique: true,
    sparse: true
  },
  name: { type: String, default: 'Daily standup', trim: true, maxlength: 80 },
  questions: { type: [questionSchema], default: [] },
  askMood: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true })

/** The classic three, used when a team has not written its own. */
const DEFAULT_QUESTIONS = [
  {
    key: 'yesterday',
    label: 'What did you accomplish yesterday?',
    placeholder: 'Describe the tasks you completed…',
    type: 'long',
    required: true
  },
  {
    key: 'today',
    label: 'What are you working on today?',
    placeholder: 'Share your plan for today…',
    type: 'long',
    required: true
  },
  {
    key: 'blockers',
    label: 'Any blockers or impediments?',
    placeholder: 'Anything slowing you down? Let your team know…',
    type: 'long',
    required: false
  }
]

const defaultTemplate = (team = null) => ({
  team,
  name: 'Daily standup',
  questions: DEFAULT_QUESTIONS.map(q => ({ ...q })),
  askMood: true
})

module.exports = mongoose.models.StandupTemplate ||
  mongoose.model('StandupTemplate', templateSchema)
module.exports.CORE_KEYS = CORE_KEYS
module.exports.DEFAULT_QUESTIONS = DEFAULT_QUESTIONS
module.exports.defaultTemplate = defaultTemplate
