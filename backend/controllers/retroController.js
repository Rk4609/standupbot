const Standup = require('../models/Standup')
const Team = require('../models/Team')
const User = require('../models/User')
const Retro = require('../models/Retro')
const { streamChat } = require('../services/groqService')
const { resolveWeek, previousWeek } = require('../utils/week')

const SYSTEM_PROMPT =
  'You are an experienced engineering manager writing a weekly retrospective. ' +
  'Be concrete and reference people by name. Never invent work that is not in the data.'

/** Team scope for the requesting user — null means "everything" (admin). */
const resolveScope = async (user) => {
  if (user.role === 'manager') {
    const team = await Team.findOne({ manager: user._id })
    if (!team) return null
    return { teamId: team._id, teamName: team.name, memberCount: team.members?.length || 0 }
  }

  if (user.role === 'admin') {
    return { teamId: null, teamName: 'All Teams', memberCount: await User.countDocuments({ role: 'employee' }) }
  }

  return null
}

/** Everything the prompt needs about one week. */
const collectWeek = async (teamId, week) => {
  const filter = { date: { $gte: week.weekStart, $lte: week.weekEnd } }
  if (teamId) filter.team = teamId

  const standups = await Standup.find(filter)
    .populate('user', 'name streak')
    .sort({ date: 1 })

  return standups
}

const summarise = (standups, totalMembers) => {
  const byMember = new Map()
  const moodBreakdown = {}

  for (const s of standups) {
    const name = s.user?.name || 'Unknown'
    byMember.set(name, (byMember.get(name) || 0) + 1)
    moodBreakdown[s.mood] = (moodBreakdown[s.mood] || 0) + 1
  }

  const activeMembers = byMember.size
  const expected = Math.max(totalMembers, activeMembers) * 5 // Mon-Fri

  return {
    submissions: standups.length,
    activeMembers,
    totalMembers: Math.max(totalMembers, activeMembers),
    participationRate: expected ? Math.round((standups.length / expected) * 100) : 0,
    blockerCount: standups.filter(s => s.hasBlocker).length,
    moodBreakdown,
    byMember: Object.fromEntries(byMember)
  }
}

const buildPrompt = ({ teamName, week, standups, stats, previousBlockers }) => {
  const work = standups.map(s => ({
    member: s.user?.name || 'Unknown',
    date: s.date,
    shipped: s.yesterday,
    planned: s.today,
    blocker: s.hasBlocker ? s.blockers : null,
    mood: s.mood
  }))

  return `Write the weekly retrospective for this engineering team.

Team: ${teamName}
Week: ${week.weekLabel} (${week.weekStart} to ${week.weekEnd})
Submissions: ${stats.submissions} across ${stats.activeMembers} of ${stats.totalMembers} members
Participation: ${stats.participationRate}% of expected Mon-Fri standups
Blockers raised: ${stats.blockerCount}
Mood counts: ${JSON.stringify(stats.moodBreakdown)}
Submissions per member: ${JSON.stringify(stats.byMember)}

This week's standups:
${JSON.stringify(work, null, 2)}

Blockers raised the PREVIOUS week (use these to spot repeats):
${previousBlockers.length ? JSON.stringify(previousBlockers, null, 2) : 'None recorded.'}

Use these exact section headings, each on its own line wrapped in double asterisks:

**🚀 Shipped this week**
Group the completed work into themes. Name who drove each one.

**🔁 Recurring blockers**
Compare this week's blockers against last week's. Call out anything that appears in both and say how many weeks it has persisted. If nothing repeats, say so plainly.

**📈 Participation**
State the rate, name anyone who submitted every day, and name anyone who missed several days — factually, without judgement.

**😊 Mood & morale**
Read the mood data. Flag any member trending negative.

**⚠️ Watch list for next week**
Risks that are visible in the data.

**🎯 Action items**
Exactly 3 specific, assignable actions for the manager. Each on its own numbered line.

Use bullet points starting with "- ". Keep the whole report under 500 words. Be direct and specific, not generic.`
}

// POST /api/retro/generate — stream a retro and save it when the stream ends
const generateRetro = async (req, res) => {
  try {
    const scope = await resolveScope(req.user)
    if (!scope) {
      return res.status(400).json({ message: 'You are not managing any team!' })
    }

    const week = resolveWeek(req.body?.weekStart ? new Date(req.body.weekStart) : new Date())
    const prev = previousWeek(new Date(week.weekStart))

    const standups = await collectWeek(scope.teamId, week)
    if (standups.length === 0) {
      return res.status(400).json({
        message: `No standups found for ${week.weekLabel}. Nothing to retro yet!`
      })
    }

    const stats = summarise(standups, scope.memberCount)

    const previousBlockers = (await collectWeek(scope.teamId, prev))
      .filter(s => s.hasBlocker)
      .map(s => ({ member: s.user?.name || 'Unknown', blocker: s.blockers }))

    const prompt = buildPrompt({
      teamName: scope.teamName,
      week,
      standups,
      stats,
      previousBlockers
    })

    const content = await streamChat({
      system: SYSTEM_PROMPT,
      prompt,
      res,
      maxTokens: 1800
    })

    // Persist so the page can show past weeks without regenerating
    if (content.trim()) {
      const { byMember, ...persisted } = stats
      await Retro.findOneAndUpdate(
        { team: scope.teamId, weekStart: week.weekStart },
        {
          team: scope.teamId,
          teamName: scope.teamName,
          ...week,
          content,
          stats: persisted,
          generatedBy: req.user._id
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    }

    res.end()
  } catch (err) {
    console.error('Retro generate error:', err.message)
    if (!res.headersSent) {
      res.status(500).json({ message: err.message || 'Retro generation failed' })
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      res.end()
    }
  }
}

// GET /api/retro — past retros, newest first
const listRetros = async (req, res) => {
  try {
    const scope = await resolveScope(req.user)
    if (!scope) {
      return res.status(400).json({ message: 'You are not managing any team!' })
    }

    const retros = await Retro.find({ team: scope.teamId })
      .sort({ weekStart: -1 })
      .limit(12)
      .populate('generatedBy', 'name')

    res.json(retros)
  } catch (err) {
    console.error('List retros error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/retro/current — the current week's saved retro, if any
const getCurrentRetro = async (req, res) => {
  try {
    const scope = await resolveScope(req.user)
    if (!scope) {
      return res.status(400).json({ message: 'You are not managing any team!' })
    }

    const week = resolveWeek(new Date())
    const retro = await Retro.findOne({ team: scope.teamId, weekStart: week.weekStart })

    res.json({ week, retro })
  } catch (err) {
    console.error('Get current retro error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = {
  generateRetro,
  listRetros,
  getCurrentRetro,
  // exported for the cron job
  resolveWeek,
  collectWeek,
  summarise,
  buildPrompt,
  SYSTEM_PROMPT
}
