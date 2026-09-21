const mongoose = require('mongoose')

/**
 * The questions a team is asked each day.
 *
 * Three questions have their own column on a standup rather than living in
 * the answers map, because the rest of the app reads them directly.
 *
 * Two of those cannot be removed: `today`, because a standup with no plan in
 * it is not a standup, and `blockers`, because it is what the blocker board
 * and the alerts are built on. `yesterday` is the team's choice — plenty of
 * teams find it redundant when yesterday's plan is already on the page above.
 *
 * Anything else a team wants to ask is a free question, and its answers live
 * in the standup's `answers` map.
 */
const CORE_KEYS = ['yesterday', 'today', 'blockers']

/** The questions a template cannot drop. */
const REQUIRED_KEYS = ['today', 'blockers']

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

/**
 * What a team is asked when it has not written its own.
 *
 * "What did you do yesterday" is not here. The answer is usually what the
 * person said they would do the day before, which the app already has and
 * shows, so asking again mostly collects it twice. A team that wants it can
 * add it back.
 */
const DEFAULT_QUESTIONS = [
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
module.exports.REQUIRED_KEYS = REQUIRED_KEYS
module.exports.DEFAULT_QUESTIONS = DEFAULT_QUESTIONS
module.exports.defaultTemplate = defaultTemplate
