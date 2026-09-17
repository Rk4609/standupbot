const DailyBrief = require('../models/DailyBrief')
const Team = require('../models/Team')
const User = require('../models/User')
const { completeChat, DEFAULT_MODEL } = require('../services/groqService')
const { collectFacts } = require('../utils/briefFacts')
const { todayIn, zoneOf } = require('../utils/time')

const isAdmin = (user) => user.role === 'admin'

const SYSTEM_PROMPT =
  'You write a short morning brief for a team lead. You only use the facts you are given, ' +
  'never invent names, numbers or causes, and you say plainly when there is nothing to worry about.'

/**
 * Which people a brief covers, and what it is called.
 *
 * A manager's brief is one of the teams they lead — the first, unless they
 * ask for another. An admin's is one team if they ask, otherwise everybody.
 */
const resolveScope = async (user, teamId) => {
  const teams = isAdmin(user)
    ? await Team.find().select('name members manager').sort({ name: 1 }).lean()
    : await Team.find({ manager: user._id }).select('name members manager').sort({ name: 1 }).lean()

  const team = teamId
    ? teams.find(t => String(t._id) === String(teamId))
    : (isAdmin(user) ? null : teams[0])

  if (teamId && !team) return { error: 'That is not a team you lead' }
  if (!isAdmin(user) && !team) return { error: 'You do not lead a team yet', teams: [] }

  const people = team
    ? await User.find({ _id: { $in: team.members || [] } }).select('name').sort({ name: 1 }).lean()
    : await User.find({ role: { $in: ['employee', 'manager'] } }).select('name').sort({ name: 1 }).lean()

  return {
    scope: team ? `team:${team._id}` : 'all',
    title: team ? team.name : 'Everybody',
    people,
    teams: teams.map(t => ({ _id: t._id, name: t.name })),
    team: team ? { _id: team._id, name: team.name } : null
  }
}

/** The prompt: the facts, and exactly what to write from them. */
const buildPrompt = ({ title, facts }) => `Team: ${title}
Date: ${facts.date}${facts.workday ? '' : ' (a weekend)'}

Facts, worked out from the team's standups, attendance and leave:
${JSON.stringify(facts)}

What the fields mean: "stuck" is a blocker carried for "days" standups in a row. "lowMood" is two or more bad or stressed moods in the last three standups. "missingOften" missed "missed" of their last "of" working-day standups. "lateOften" was late on "days" days in the last two weeks. "notIn" has not checked in. "noCheckout" never checked out on the last working day.

Write the brief in this shape, in lightweight markdown, under 220 words:

**Headline**
One sentence on how the team is doing today.

**Needs your attention**
Up to five bullets, most urgent first. Each names the person, says what the fact is, and suggests one concrete thing the lead could do. Write "Nothing needs you today." if there is nothing.

**Today at a glance**
Three short bullets: standups, attendance, leave.

${facts.goodNews?.length ? `
**Good news**
One or two bullets from "goodNews".
` : ''}
Use only these facts. Do not add names that are not in them. Refer to people by name and never guess whether somebody is he or she.`

/** Work the brief out and keep it. Used by the page and the morning job. */
const writeBrief = async ({ scope, title, people, date, today, actor = null }) => {
  const facts = await collectFacts({ people, date, today })
  const summary = await completeChat({
    system: SYSTEM_PROMPT,
    prompt: buildPrompt({ title, facts }),
    maxTokens: 1200,
    temperature: 0.4
  })

  if (!summary.trim()) throw new Error('The model returned an empty brief')

  return DailyBrief.findOneAndUpdate(
    { scope, date },
    {
      $set: {
        title,
        facts,
        summary: summary.trim(),
        model: DEFAULT_MODEL,
        generatedAt: new Date(),
        generatedBy: actor?._id || null,
        generatedByName: actor?.name || ''
      }
    },
    { upsert: true, new: true }
  ).lean()
}

// GET /api/brief?date=&team= — today's facts, and the written brief if there is one
const getBrief = async (req, res) => {
  try {
    const today = todayIn(zoneOf(req.user))
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : today

    const scope = await resolveScope(req.user, req.query.team)
    if (scope.error) return res.status(scope.teams ? 200 : 403).json({ message: scope.error, noTeam: Boolean(scope.teams) })

    const [facts, stored] = await Promise.all([
      collectFacts({ people: scope.people, date, today }),
      DailyBrief.findOne({ scope: scope.scope, date }).lean()
    ])

    res.json({
      date,
      today,
      title: scope.title,
      team: scope.team,
      teams: scope.teams,
      // Only an admin has a brief across every team
      canSeeAll: isAdmin(req.user),
      facts,
      brief: stored
        ? {
            summary: stored.summary,
            generatedAt: stored.generatedAt,
            generatedByName: stored.generatedByName,
            model: stored.model
          }
        : null,
      aiAvailable: Boolean(process.env.GROQ_API_KEY)
    })
  } catch (err) {
    console.error('Brief error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/brief — write (or rewrite) the brief now
const generateBrief = async (req, res) => {
  try {
    const today = todayIn(zoneOf(req.user))
    const date = req.body.date || today
    if (date > today) return res.status(400).json({ message: 'That day has not happened yet' })

    const scope = await resolveScope(req.user, req.body.team)
    if (scope.error) return res.status(403).json({ message: scope.error })

    const stored = await writeBrief({ ...scope, date, today, actor: req.user })

    res.json({
      brief: {
        summary: stored.summary,
        generatedAt: stored.generatedAt,
        generatedByName: stored.generatedByName,
        model: stored.model
      },
      facts: stored.facts
    })
  } catch (err) {
    console.error('Generate brief error:', err.message)
    res.status(502).json({ message: `The brief could not be written: ${err.message}` })
  }
}

module.exports = { getBrief, generateBrief, writeBrief, buildPrompt, resolveScope, SYSTEM_PROMPT }
