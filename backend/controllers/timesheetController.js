const Project = require('../models/Project')
const Standup = require('../models/Standup')
const Team = require('../models/Team')
const Timesheet = require('../models/Timesheet')
const User = require('../models/User')
const audit = require('../services/auditService')
const { resolveWeek, mondayOf, toISODate } = require('../utils/week')
const { addDays } = require('../utils/time')

const round = (n) => Number((n || 0).toFixed(2))

/** The Mon-Fri dates of a week, so a grid always has five columns. */
const weekDates = (weekStart) =>
  Array.from({ length: 5 }, (_, i) => addDays(weekStart, i))

/** Resolve a requested week to its Monday, defaulting to this one. */
const resolveWeekStart = (raw) => {
  if (!raw) return resolveWeek().weekStart
  return toISODate(mondayOf(new Date(`${raw}T00:00:00.000Z`)))
}

/**
 * One person's week: the hours they booked, by project and by day.
 *
 * Built from the standups rather than stored, because that is where the hours
 * were entered. The Timesheet row only carries what happened to the week.
 */
const buildWeek = async (userId, weekStart) => {
  const dates = weekDates(weekStart)

  const standups = await Standup.find({
    user: userId,
    date: { $in: dates }
  })
    .populate('work.project', 'name code client billable')
    .lean()

  const byDate = new Map(standups.map(s => [s.date, s]))

  // project id -> { project, perDay: { date: hours }, total }
  const rows = new Map()

  for (const date of dates) {
    for (const entry of byDate.get(date)?.work || []) {
      const project = entry.project
      // A project deleted outright would leave a dangling id; projects are
      // archived instead, so this is belt and braces
      const key = String(project?._id || 'unknown')

      if (!rows.has(key)) {
        rows.set(key, {
          project: project?._id || null,
          name: project?.name || 'Removed project',
          code: project?.code || '',
          client: project?.client || '',
          billable: project?.billable !== false,
          perDay: {},
          total: 0
        })
      }

      const row = rows.get(key)
      row.perDay[date] = round((row.perDay[date] || 0) + entry.hours)
      row.total = round(row.total + entry.hours)
    }
  }

  const lines = [...rows.values()].sort((a, b) => b.total - a.total)

  const perDayTotals = Object.fromEntries(
    dates.map(d => [d, round(lines.reduce((sum, l) => sum + (l.perDay[d] || 0), 0))])
  )

  return {
    dates,
    lines,
    perDayTotals,
    totalHours: round(lines.reduce((sum, l) => sum + l.total, 0)),
    billableHours: round(
      lines.filter(l => l.billable).reduce((sum, l) => sum + l.total, 0)
    ),
    daysSubmitted: dates.filter(d => byDate.has(d)).length
  }
}

/** The stored status for a week, or a draft if nobody has touched it. */
const statusFor = async (userId, weekStart) => {
  const sheet = await Timesheet.findOne({ user: userId, weekStart })
    .populate('reviewedBy', 'name')
    .lean()

  if (!sheet) {
    return { status: 'draft', submittedAt: null, reviewedAt: null, note: '', reviewedBy: null }
  }

  return {
    status: sheet.status,
    submittedAt: sheet.submittedAt,
    reviewedAt: sheet.reviewedAt,
    reviewedBy: sheet.reviewedBy?.name || null,
    note: sheet.note,
    // What it added up to when it was submitted, so a later edit is visible
    submittedTotal: sheet.totalHours
  }
}

// GET /api/timesheets/me?weekStart=
const getMyWeek = async (req, res) => {
  try {
    const weekStart = resolveWeekStart(req.query.weekStart)
    const week = resolveWeek(new Date(`${weekStart}T00:00:00.000Z`))

    const [grid, state] = await Promise.all([
      buildWeek(req.user._id, weekStart),
      statusFor(req.user._id, weekStart)
    ])

    res.json({ week, ...grid, ...state })
  } catch (err) {
    console.error('My timesheet error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/timesheets/submit
const submitWeek = async (req, res) => {
  try {
    const weekStart = resolveWeekStart(req.body.weekStart)
    const grid = await buildWeek(req.user._id, weekStart)

    if (grid.totalHours === 0) {
      return res.status(400).json({
        message: 'There are no hours in this week yet. Add them to your standups first.'
      })
    }

    const existing = await Timesheet.findOne({ user: req.user._id, weekStart })
    if (existing?.status === 'approved') {
      return res.status(400).json({
        message: 'This week is already approved. Ask your manager to reopen it.'
      })
    }

    const sheet = await Timesheet.findOneAndUpdate(
      { user: req.user._id, weekStart },
      {
        user: req.user._id,
        team: req.user.team || null,
        weekStart,
        status: 'submitted',
        // Snapshot, so an edit afterwards cannot quietly change what was sent
        lines: grid.lines.map(l => ({
          project: l.project,
          projectName: l.name,
          hours: l.total
        })),
        totalHours: grid.totalHours,
        submittedAt: new Date(),
        reviewedBy: null,
        reviewedAt: null,
        note: ''
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    res.json({ status: sheet.status, submittedAt: sheet.submittedAt, totalHours: sheet.totalHours })
  } catch (err) {
    console.error('Submit timesheet error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

/** Whose weeks this lead may review. */
const reviewScope = async (user) => {
  if (user.role === 'admin') return {}

  const team = await Team.findOne({ manager: user._id }).select('_id')
  if (!team) return null
  return { team: team._id }
}

// GET /api/timesheets?weekStart= — the team's week, at a glance
const getTeamWeek = async (req, res) => {
  try {
    const scope = await reviewScope(req.user)
    if (!scope) return res.status(400).json({ message: 'You are not managing any team!' })

    const weekStart = resolveWeekStart(req.query.weekStart)
    const week = resolveWeek(new Date(`${weekStart}T00:00:00.000Z`))

    const roster = await User.find(scope)
      .select('name email avatar role')
      .sort({ name: 1 })
      .lean()

    // Two queries for the whole roster, not two per person. This used to
    // build each person's week individually, so opening the page on a team
    // of thirty ran sixty round trips to answer one screen.
    const ids = roster.map(u => u._id)
    const dates = weekDates(weekStart)

    const [totals, sheets] = await Promise.all([
      Standup.aggregate([
        { $match: { user: { $in: ids }, date: { $in: dates } } },
        { $unwind: { path: '$work', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            // From the model rather than a spelled-out collection name, which
            // also keeps the Project import doing something
            from: Project.collection.name,
            localField: 'work.project',
            foreignField: '_id',
            as: 'projectDoc'
          }
        },
        {
          $group: {
            _id: '$user',
            hours: { $sum: { $ifNull: ['$work.hours', 0] } },
            billable: {
              $sum: {
                $cond: [
                  // A project row with no project document left is counted as
                  // billable, matching how the grid treats one
                  { $ne: [{ $arrayElemAt: ['$projectDoc.billable', 0] }, false] },
                  { $ifNull: ['$work.hours', 0] },
                  0
                ]
              }
            },
            days: { $addToSet: '$date' }
          }
        }
      ]),
      Timesheet.find({ user: { $in: ids }, weekStart })
        .populate('reviewedBy', 'name')
        .lean()
    ])

    const totalsBy = new Map(totals.map(t => [String(t._id), t]))
    const sheetBy = new Map(sheets.map(s => [String(s.user), s]))

    const people = roster.map((u) => {
      const t = totalsBy.get(String(u._id))
      const sheet = sheetBy.get(String(u._id))

      const totalHours = round(t?.hours || 0)
      const status = sheet?.status || 'draft'

      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        avatar: u.avatar || '',
        totalHours,
        billableHours: round(t?.billable || 0),
        daysSubmitted: t?.days?.length || 0,
        status,
        submittedAt: sheet?.submittedAt || null,
        reviewedAt: sheet?.reviewedAt || null,
        reviewedBy: sheet?.reviewedBy?.name || null,
        note: sheet?.note || '',
        submittedTotal: sheet?.totalHours,
        // A week edited after submission is the one thing a reviewer must
        // not miss, so it is computed here rather than left to be spotted
        changedSinceSubmit: status !== 'draft' && sheet?.totalHours !== totalHours
      }
    })

    res.json({
      week,
      people,
      totals: {
        hours: round(people.reduce((s, p) => s + p.totalHours, 0)),
        billable: round(people.reduce((s, p) => s + p.billableHours, 0)),
        awaiting: people.filter(p => p.status === 'submitted').length,
        approved: people.filter(p => p.status === 'approved').length
      }
    })
  } catch (err) {
    console.error('Team timesheets error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/timesheets/:userId?weekStart= — one person's grid
const getPersonWeek = async (req, res) => {
  try {
    const scope = await reviewScope(req.user)
    if (!scope) return res.status(400).json({ message: 'You are not managing any team!' })

    const person = await User.findOne({ _id: req.params.userId, ...scope })
      .select('name email avatar')
      .lean()
    if (!person) return res.status(404).json({ message: 'Not on your team' })

    const weekStart = resolveWeekStart(req.query.weekStart)
    const week = resolveWeek(new Date(`${weekStart}T00:00:00.000Z`))

    const [grid, state] = await Promise.all([
      buildWeek(person._id, weekStart),
      statusFor(person._id, weekStart)
    ])

    res.json({ week, person, ...grid, ...state })
  } catch (err) {
    console.error('Person timesheet error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// PATCH /api/timesheets/:userId — approve, send back, or reopen
const reviewWeek = async (req, res) => {
  try {
    const scope = await reviewScope(req.user)
    if (!scope) return res.status(400).json({ message: 'You are not managing any team!' })

    const person = await User.findOne({ _id: req.params.userId, ...scope })
      .select('name')
      .lean()
    if (!person) return res.status(404).json({ message: 'Not on your team' })

    if (String(person._id) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot approve your own week' })
    }

    const weekStart = resolveWeekStart(req.body.weekStart)
    const { action, note = '' } = req.body

    const sheet = await Timesheet.findOne({ user: person._id, weekStart })
    if (!sheet) {
      return res.status(404).json({ message: 'That week has not been submitted yet' })
    }

    const previous = sheet.status

    if (action === 'approve') {
      sheet.status = 'approved'
    } else if (action === 'request_changes') {
      // Sending a week back without saying why leaves the person guessing at
      // what to fix, which is the whole point of sending it back
      if (!note.trim()) {
        return res.status(400).json({ message: 'Say what needs changing' })
      }
      sheet.status = 'changes_requested'
    } else if (action === 'reopen') {
      sheet.status = 'draft'
    }

    sheet.note = note.trim().slice(0, 500)
    sheet.reviewedBy = req.user._id
    sheet.reviewedAt = new Date()
    await sheet.save()

    await audit.record({
      action: 'timesheet.reviewed',
      actor: req.user,
      subject: person,
      team: sheet.team,
      entityType: 'Timesheet',
      entityId: sheet._id,
      changes: [{ field: 'status', from: previous, to: sheet.status }],
      note: `${weekStart}${note.trim() ? ` — ${note.trim()}` : ''}`
    })

    res.json({ status: sheet.status, note: sheet.note, reviewedAt: sheet.reviewedAt })
  } catch (err) {
    console.error('Review timesheet error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = {
  getMyWeek,
  submitWeek,
  getTeamWeek,
  getPersonWeek,
  reviewWeek,
  buildWeek,
  weekDates
}
