const User = require('../models/User')
const Team = require('../models/Team')
const Standup = require('../models/Standup')
const { isWeekend, lastNDates, zoneOf } = require('../utils/time')

/** Mood as a number so it can be averaged and trended. */
const MOOD_SCORE = { great: 5, good: 4, okay: 3, bad: 2, stressed: 1 }
const MOODS = Object.keys(MOOD_SCORE)

/** Sum mood as a score inside an aggregation. */
const moodScoreExpr = {
  $sum: {
    $switch: {
      branches: MOODS.map(m => ({ case: { $eq: ['$mood', m] }, then: MOOD_SCORE[m] })),
      default: 0
    }
  }
}

const resolveDays = (raw) => ([7, 30, 90].includes(Number(raw)) ? Number(raw) : 30)

/** Admin sees everyone; a manager sees their own team. */
const resolveScope = async (user) => {
  if (user.role === 'admin') return {}

  const team = await Team.findOne({ manager: user._id })
  if (!team) return null
  return { team: team._id }
}

/**
 * Why someone is flagged, in words a manager can act on.
 *
 * Each rule is deliberately concrete: "at risk" with no reason attached is
 * noise, and a manager cannot do anything with a score.
 */
const assessRisk = (person, workingDays) => {
  const reasons = []

  if (workingDays > 0 && person.submissions / workingDays < 0.5) {
    reasons.push(`submitted on ${person.submissions} of ${workingDays} working days`)
  }
  if (person.avgMood !== null && person.avgMood <= 2.5) {
    reasons.push('mood has been low')
  }
  if (
    person.recentMood !== null &&
    person.avgMood !== null &&
    person.recentMood < person.avgMood - 0.75
  ) {
    reasons.push('mood is trending down')
  }
  if (person.openBlockerDays >= 3) {
    reasons.push(`last blocker was ${person.openBlockerDays} days ago`)
  }

  return reasons
}

// GET /api/analytics/overview?days=30
const getOverview = async (req, res) => {
  try {
    const scope = await resolveScope(req.user)
    if (!scope) {
      return res.status(400).json({ message: 'You are not managing any team!' })
    }

    const days = resolveDays(req.query.days)
    const dates = lastNDates(days, zoneOf(req.user))
    const from = dates[0]
    const to = dates[dates.length - 1]
    const workingDays = dates.filter(d => !isWeekend(d)).length

    const roster = await User.find(scope)
      .select('name email avatar role team streak')
      .populate('team', 'name')
      .lean()

    const ids = roster.map(u => u._id)
    const match = { user: { $in: ids }, date: { $gte: from, $lte: to } }

    // Trailing week, to spot a decline against the person's own average
    const recentFrom = dates[Math.max(0, dates.length - 7)]

    // Four shapes of the same window: by day for the trends, by person for the
    // table, by mood for the distribution, and the trailing week for drift.
    const [byDay, byPerson, byMood, byRecent] = await Promise.all([
      Standup.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$date',
            submissions: { $sum: 1 },
            blockers: { $sum: { $cond: ['$hasBlocker', 1, 0] } },
            moodScore: moodScoreExpr
          }
        }
      ]),
      Standup.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$user',
            submissions: { $sum: 1 },
            blockers: { $sum: { $cond: ['$hasBlocker', 1, 0] } },
            lastDate: { $max: '$date' },
            lastBlockerDate: { $max: { $cond: ['$hasBlocker', '$date', null] } },
            moodScore: moodScoreExpr
          }
        }
      ]),
      Standup.aggregate([
        { $match: match },
        { $group: { _id: '$mood', n: { $sum: 1 } } }
      ]),
      Standup.aggregate([
        { $match: { user: { $in: ids }, date: { $gte: recentFrom, $lte: to } } },
        { $group: { _id: '$user', n: { $sum: 1 }, moodScore: moodScoreExpr } }
      ])
    ])

    const dayBy = new Map(byDay.map(d => [d._id, d]))
    const personBy = new Map(byPerson.map(p => [String(p._id), p]))
    const recentBy = new Map(byRecent.map(r => [String(r._id), r]))

    const rosterSize = roster.length

    const daily = dates.map(date => {
      const d = dayBy.get(date)
      const weekend = isWeekend(date)
      return {
        date,
        weekend,
        submissions: d?.submissions || 0,
        // Nobody is expected to submit at the weekend, so counting those days
        // would drag every participation figure down
        expected: weekend ? 0 : rosterSize,
        blockers: d?.blockers || 0,
        avgMood: d?.submissions ? Number((d.moodScore / d.submissions).toFixed(2)) : null
      }
    })

    const daysSince = (iso) =>
      iso
        ? Math.round(
            (new Date(`${to}T00:00:00.000Z`) - new Date(`${iso}T00:00:00.000Z`)) / 86_400_000
          )
        : 0

    const people = roster.map(u => {
      const p = personBy.get(String(u._id))
      const r = recentBy.get(String(u._id))
      const submissions = p?.submissions || 0

      const person = {
        _id: u._id,
        name: u.name,
        email: u.email,
        avatar: u.avatar || '',
        role: u.role,
        team: u.team?.name || null,
        streak: u.streak || 0,
        submissions,
        rate: workingDays ? Math.round((submissions / workingDays) * 100) : 0,
        blockers: p?.blockers || 0,
        lastDate: p?.lastDate || null,
        avgMood: submissions ? Number((p.moodScore / submissions).toFixed(2)) : null,
        recentMood: r?.n ? Number((r.moodScore / r.n).toFixed(2)) : null,
        openBlockerDays: daysSince(p?.lastBlockerDate)
      }

      person.risks = assessRisk(person, workingDays)
      return person
    })

    const submissions = daily.reduce((a, d) => a + d.submissions, 0)
    const expected = workingDays * rosterSize

    const moodTotals = Object.fromEntries(MOODS.map(m => [m, 0]))
    for (const m of byMood) if (m._id in moodTotals) moodTotals[m._id] = m.n

    const scored = people.filter(p => p.avgMood !== null)

    res.json({
      range: { from, to, days, workingDays },
      headline: {
        submissions,
        expected,
        participationRate: expected ? Math.round((submissions / expected) * 100) : 0,
        activePeople: people.filter(p => p.submissions > 0).length,
        rosterSize,
        blockersRaised: daily.reduce((a, d) => a + d.blockers, 0),
        avgMood: scored.length
          ? Number((scored.reduce((a, p) => a + p.avgMood, 0) / scored.length).toFixed(2))
          : null
      },
      daily,
      moodTotals,
      people: people.sort((a, b) => b.submissions - a.submissions),
      atRisk: people
        .filter(p => p.risks.length > 0)
        .sort((a, b) => b.risks.length - a.risks.length)
    })
  } catch (err) {
    console.error('Analytics overview error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

/** RFC 4180: quote every field and double any quote inside it. */
const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

// GET /api/analytics/export?days=30
const exportStandups = async (req, res) => {
  try {
    const scope = await resolveScope(req.user)
    if (!scope) {
      return res.status(400).json({ message: 'You are not managing any team!' })
    }

    const days = resolveDays(req.query.days)
    const dates = lastNDates(days, zoneOf(req.user))
    const from = dates[0]
    const to = dates[dates.length - 1]

    const roster = await User.find(scope).select('_id').lean()

    const standups = await Standup.find({
      user: { $in: roster.map(u => u._id) },
      date: { $gte: from, $lte: to }
    })
      .populate('user', 'name email')
      .populate('team', 'name')
      .sort({ date: -1 })
      .lean()

    // Teams can add their own questions, and an export that silently dropped
    // those answers would be missing exactly the part that team cares about.
    // The columns come from the data rather than from the current template,
    // so answers to a question since removed still come out.
    const extraKeys = [
      ...new Set(standups.flatMap(s => Object.keys(s.answers || {})))
    ].sort()

    const header = [
      'Date',
      'Name',
      'Email',
      'Team',
      'Mood',
      'Accomplished yesterday',
      'Plan for today',
      'Has blocker',
      'Blocker',
      ...extraKeys
    ]

    const rows = standups.map(s => [
      s.date,
      s.user?.name,
      s.user?.email,
      s.team?.name,
      s.mood,
      s.yesterday,
      s.today,
      s.hasBlocker ? 'yes' : 'no',
      s.hasBlocker ? s.blockers : '',
      ...extraKeys.map(k => s.answers?.[k] || '')
    ])

    // A BOM so Excel reads it as UTF-8, and CRLF line endings because that is
    // what Excel expects from a .csv
    const csv =
      '﻿' +
      [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="standups-${from}-to-${to}.csv"`
    )
    res.send(csv)
  } catch (err) {
    console.error('Analytics export error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = { getOverview, exportStandups }
