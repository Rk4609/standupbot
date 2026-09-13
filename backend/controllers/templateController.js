const StandupTemplate = require('../models/StandupTemplate')
const Team = require('../models/Team')
const { ownTeam } = require('../utils/teams')

const { CORE_KEYS, REQUIRED_KEYS, defaultTemplate } = StandupTemplate

/** The team whose template applies to this user, or null for the fallback. */
const teamForUser = (user) => ownTeam(user)

/** The team a manager may edit, or every team for an admin. */
const editableTeam = async (user, requested) => {
  if (user.role === 'admin') {
    if (requested) return { team: requested }
    // An admin with no team of their own edits the instance-wide fallback
    return { team: user.team || null }
  }

  const team = await Team.findOne({ manager: user._id })
  if (!team) return { error: 'You are not managing any team!' }
  if (requested && String(requested) !== String(team._id)) {
    return { error: 'That template belongs to another team' }
  }
  return { team: team._id }
}

/**
 * A team's template, falling back to the instance default and then to the
 * built-in one. Nothing is written on read: a team that never customised
 * anything should not accumulate a row just for opening the form.
 */
const resolveTemplate = async (teamId) => {
  // A stored template with no questions in it would render a form with
  // nothing to fill in. The API cannot save one, but a migration or a script
  // can write one, and an empty form is never the right answer.
  const usable = (t) => (t && t.questions?.length > 0 ? t : null)

  if (teamId) {
    const own = usable(await StandupTemplate.findOne({ team: teamId }).lean())
    if (own) return own
  }

  const fallback = usable(await StandupTemplate.findOne({ team: null }).lean())
  return fallback || defaultTemplate(teamId || null)
}

// GET /api/templates/active — what to ask the signed-in person today
const getActiveTemplate = async (req, res) => {
  try {
    const teamId = await teamForUser(req.user)
    const template = await resolveTemplate(teamId)

    res.json({
      name: template.name,
      questions: template.questions,
      askMood: template.askMood,
      trackTime: Boolean(template.trackTime),
      coreKeys: CORE_KEYS
    })
  } catch (err) {
    console.error('Active template error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/templates — the template a manager edits
const getTemplate = async (req, res) => {
  try {
    const { team, error } = await editableTeam(req.user, req.query.team)
    if (error) return res.status(400).json({ message: error })

    const template = await resolveTemplate(team)
    const custom = Boolean(template._id)

    res.json({
      team: team || null,
      name: template.name,
      questions: template.questions,
      askMood: template.askMood,
      coreKeys: CORE_KEYS,
      requiredKeys: REQUIRED_KEYS,
      // Whether this team has actually written one, or is seeing the default
      custom,
      updatedAt: template.updatedAt || null
    })
  } catch (err) {
    console.error('Get template error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

/**
 * Reject a question list that would break the rest of the app.
 *
 * Only two questions have to stay. Everything else is the team's business,
 * except that keys have to be unique — answers are stored under them, so a
 * duplicate would silently overwrite.
 */
const validateQuestions = (questions) => {
  const keys = questions.map(q => q.key)

  const missing = REQUIRED_KEYS.filter(k => !keys.includes(k))
  if (missing.length > 0) {
    return `These questions cannot be removed: ${missing.join(', ')}. They are what the blocker board and the reports read.`
  }

  const duplicate = keys.find((k, i) => keys.indexOf(k) !== i)
  if (duplicate) return `Two questions share the key "${duplicate}"`

  // A standup with no plan in it is not a standup, and everything downstream
  // assumes there is one
  const plan = questions.find(q => q.key === 'today')
  if (plan && plan.required === false) {
    return 'The question about today has to stay required — it is what a standup is.'
  }

  return null
}

// PUT /api/templates — save a team's questions
const saveTemplate = async (req, res) => {
  try {
    const { team, error } = await editableTeam(req.user, req.body.team)
    if (error) return res.status(400).json({ message: error })

    const { name, questions, askMood, trackTime } = req.body

    const problem = validateQuestions(questions)
    if (problem) return res.status(400).json({ message: problem })

    const template = await StandupTemplate.findOneAndUpdate(
      { team: team || null },
      {
        team: team || null,
        name: name || 'Daily standup',
        questions,
        askMood: askMood !== false,
        trackTime: Boolean(trackTime),
        updatedBy: req.user._id
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    ).lean()

    res.json({
      team: template.team,
      name: template.name,
      questions: template.questions,
      askMood: template.askMood,
      trackTime: Boolean(template.trackTime),
      coreKeys: CORE_KEYS,
      requiredKeys: REQUIRED_KEYS,
      custom: true,
      updatedAt: template.updatedAt
    })
  } catch (err) {
    // A schema violation is the author's mistake, not a server fault
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(err.errors)[0].message })
    }
    console.error('Save template error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// DELETE /api/templates — go back to the default questions
const resetTemplate = async (req, res) => {
  try {
    const { team, error } = await editableTeam(req.user, req.query.team)
    if (error) return res.status(400).json({ message: error })

    await StandupTemplate.deleteOne({ team: team || null })

    const template = await resolveTemplate(team)
    res.json({
      team: team || null,
      name: template.name,
      questions: template.questions,
      askMood: template.askMood,
      trackTime: Boolean(template.trackTime),
      coreKeys: CORE_KEYS,
      requiredKeys: REQUIRED_KEYS,
      custom: Boolean(template._id),
      updatedAt: template.updatedAt || null
    })
  } catch (err) {
    console.error('Reset template error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = {
  getActiveTemplate,
  getTemplate,
  saveTemplate,
  resetTemplate,
  resolveTemplate,
  teamForUser
}
