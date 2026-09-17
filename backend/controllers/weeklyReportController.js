const WeeklyReport = require('../models/WeeklyReport')
const { completeChat, DEFAULT_MODEL } = require('../services/groqService')
const { resolveScope } = require('./briefController')
const { collectWeekFacts } = require('../utils/weeklyReportFacts')
const { clip } = require('../utils/promptBudget')
const { todayIn, zoneOf } = require('../utils/time')
const { resolveWeek } = require('../utils/week')

const SYSTEM_PROMPT =
  'You write a weekly project status report that a client or a director will read. ' +
  'It is factual, calm and specific. You only use the facts you are given and never invent work, ' +
  'numbers or outcomes. You refer to people by name and never guess whether somebody is he or she.'

/**
 * The facts cut down to what the report is written from.
 *
 * A real team's week — seven projects, eight hundred hours, a note on every
 * entry — came to more than Groq's free tier takes in a minute, and the
 * request was refused. The page still shows everything; the model gets the
 * top projects, a few notes and blockers each, and no per-person table.
 */
const PROMPT_LIMITS = { projects: 6, notes: 4, contributors: 3, blockers: 2, open: 8, plans: 8, text: 110 }

const forPrompt = (facts) => {
  const cut = (text) => clip(text, PROMPT_LIMITS.text)
  return {
    week: facts.week,
    hours: facts.hours,
    standupRate: facts.standups.rate,
    projects: facts.projects.slice(0, PROMPT_LIMITS.projects).map(p => ({
      name: p.name,
      client: p.client || undefined,
      billable: p.billable,
      hours: p.hours,
      people: p.contributors.slice(0, PROMPT_LIMITS.contributors).map(c => `${c.name} ${c.hours}h`),
      notes: p.notes.slice(0, PROMPT_LIMITS.notes).map(n => cut(n.note)),
      blockers: p.blockers.slice(0, PROMPT_LIMITS.blockers).map(b => `${b.name}: ${cut(b.blocker)}`)
    })),
    otherProjects: facts.projects.slice(PROMPT_LIMITS.projects).map(p => `${p.name} ${p.hours}h`),
    openBlockers: facts.openBlockers.slice(0, PROMPT_LIMITS.open).map(b => `${b.name}: ${cut(b.blocker)}`),
    nextWeek: facts.nextWeek.slice(0, PROMPT_LIMITS.plans).map(n => `${n.name}: ${cut(n.plan)}`)
  }
}

/** The week containing `date` ('YYYY-MM-DD'), Monday to Friday. */
const weekOf = (date) => resolveWeek(new Date(`${date}T12:00:00.000Z`))

const buildPrompt = ({ title, facts }) => `Team: ${title}
Week: ${facts.week.label} (${facts.week.start} to ${facts.week.end})

Facts from the team's standups and timesheet entries:
${JSON.stringify(forPrompt(facts))}

"projects" are sorted by hours; "notes" are what people wrote against their hours; "blockers" were raised on a day they worked on that project. "otherProjects" had fewer hours. "openBlockers" were still open on each person's last standup of the week. "nextWeek" is each person's latest stated plan.

Write the report in lightweight markdown, under 400 words, with these headings each on its own line in double asterisks:

**Summary**
Two or three sentences: total hours, the billable share, and the main thing each of the top projects moved forward.

**Project updates**
For each project with hours, most hours first (at most six), a line "**<name>** — <hours>h" followed by one to three bullets on what was done, drawn from its notes, and a bullet on anything that blocked it. Name at most three people per project.

**Risks and blockers**
Bullets from "openBlockers", each with the person and what they are waiting on. Write "No open blockers at the end of the week." if there are none.

**Next week**
Up to five bullets drawn from "nextWeek", grouped by project where the plan names one.

${facts.hours.total === 0 ? 'No hours were logged against projects this week: say so plainly in the summary and base the rest on the standups.\n' : ''}Do not mention moods, lateness or attendance. Use only these facts, in plain words: never quote field names such as "openBlockers".`

const writeReport = async ({ scope, title, people, week, today, actor = null }) => {
  const facts = await collectWeekFacts({ people, week, today })
  const content = await completeChat({
    system: SYSTEM_PROMPT,
    prompt: buildPrompt({ title, facts }),
    maxTokens: 1600,
    temperature: 0.4
  })
  if (!content.trim()) throw new Error('The model returned an empty report')

  return WeeklyReport.findOneAndUpdate(
    { scope, weekStart: week.weekStart },
    {
      $set: {
        title,
        facts,
        content: content.trim(),
        model: DEFAULT_MODEL,
        generatedAt: new Date(),
        generatedBy: actor?._id || null,
        generatedByName: actor?.name || ''
      }
    },
    { upsert: true, new: true }
  ).lean()
}

const present = (stored) => stored && ({
  content: stored.content,
  generatedAt: stored.generatedAt,
  generatedByName: stored.generatedByName,
  model: stored.model
})

// GET /api/reports/weekly?week=YYYY-MM-DD&team=
const getWeeklyReport = async (req, res) => {
  try {
    const today = todayIn(zoneOf(req.user))
    const week = weekOf(req.query.week || today)
    if (week.weekStart > today) return res.status(400).json({ message: 'That week has not started yet' })

    const scope = await resolveScope(req.user, req.query.team)
    if (scope.error) return res.status(scope.teams ? 200 : 403).json({ message: scope.error, noTeam: Boolean(scope.teams) })

    const [facts, stored] = await Promise.all([
      collectWeekFacts({ people: scope.people, week, today }),
      WeeklyReport.findOne({ scope: scope.scope, weekStart: week.weekStart }).lean()
    ])

    res.json({
      today,
      title: scope.title,
      team: scope.team,
      teams: scope.teams,
      canSeeAll: req.user.role === 'admin',
      isCurrentWeek: week.weekStart === weekOf(today).weekStart,
      facts,
      report: present(stored),
      aiAvailable: Boolean(process.env.GROQ_API_KEY)
    })
  } catch (err) {
    console.error('Weekly report error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/reports/weekly — write (or rewrite) the week's report
const generateWeeklyReport = async (req, res) => {
  try {
    const today = todayIn(zoneOf(req.user))
    const week = weekOf(req.body.week || today)
    if (week.weekStart > today) return res.status(400).json({ message: 'That week has not started yet' })

    const scope = await resolveScope(req.user, req.body.team)
    if (scope.error) return res.status(403).json({ message: scope.error })

    const stored = await writeReport({ ...scope, week, today, actor: req.user })
    res.json({ report: present(stored), facts: stored.facts })
  } catch (err) {
    console.error('Generate weekly report error:', err.message)
    res.status(502).json({ message: `The report could not be written: ${err.message}` })
  }
}

module.exports = { getWeeklyReport, generateWeeklyReport, writeReport, buildPrompt, forPrompt, weekOf }
