const Attendance = require('../models/Attendance')
const Leave = require('../models/Leave')
const Team = require('../models/Team')
const User = require('../models/User')
const audit = require('../services/auditService')
const { canUse } = require('../services/roleService')
const { ownTeam } = require('../utils/teams')
const { addDays, instantIn, isWeekend, todayIn, zoneOf } = require('../utils/time')
const { readDay, policyForClient } = require('../utils/attendancePolicy')

const isAdmin = (user) => user.role === 'admin'

const monthBounds = (month) => {
  const first = `${month}-01`
  const last = addDays(`${addDays(first, 32).slice(0, 7)}-01`, -1)
  return { first, last }
}

const eachDay = (first, last) => {
  const days = []
  for (let day = first; day <= last; day = addDays(day, 1)) days.push(day)
  return days
}

/** The approved leave covering a day, if any. */
const leaveOn = (leaves, day) => leaves.find(l => l.from <= day && l.to >= day)

/**
 * What a day was, for one person.
 *
 * A working day with nothing on it only counts as absent once attendance was
 * being kept for them — the days before their first check-in are simply not
 * recorded, not days they missed.
 */
const dayFor = ({ day, record, leave, today, since }) => {
  if (record) return record.state
  if (leave && !leave.halfDay) return 'leave'
  if (isWeekend(day)) return 'weekend'
  if (day > today) return 'upcoming'
  if (day === today) return 'not-in'
  if (!since || day < since) return 'untracked'
  return 'absent'
}

// GET /api/attendance/me?month=YYYY-MM — my month, and today
const myAttendance = async (req, res) => {
  try {
    const tz = zoneOf(req.user)
    const today = todayIn(tz)
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : today.slice(0, 7)
    const { first, last } = monthBounds(month)

    const [rows, leaves, earliest, todayRow, todayLeave] = await Promise.all([
      Attendance.find({ user: req.user._id, date: { $gte: first, $lte: last } }).lean(),
      Leave.find({ user: req.user._id, status: 'approved', from: { $lte: last }, to: { $gte: first } })
        .select('type from to halfDay days').lean(),
      Attendance.findOne({ user: req.user._id }).sort({ date: 1 }).select('date').lean(),
      Attendance.findOne({ user: req.user._id, date: today }).lean(),
      Leave.findOne({ user: req.user._id, status: 'approved', from: { $lte: today }, to: { $gte: today } })
        .select('type halfDay').lean()
    ])

    const since = earliest?.date || null
    const byDate = new Map(rows.map(r => [r.date, r]))

    const days = eachDay(first, last).map(day => {
      const leave = leaveOn(leaves, day)
      const row = byDate.get(day)
      const record = row ? readDay(row, { today, halfDayLeave: Boolean(leave?.halfDay) }) : null
      return {
        date: day,
        weekend: isWeekend(day),
        state: dayFor({ day, record, leave, today, since }),
        record,
        leave: leave ? { type: leave.type, halfDay: leave.halfDay } : null
      }
    })

    const recorded = days.filter(d => d.record)
    const finished = recorded.filter(d => d.record.minutes !== null)

    const summary = {
      present: recorded.length,
      late: recorded.filter(d => d.record.late).length,
      halfDays: recorded.filter(d => d.state === 'half-day').length,
      noCheckout: recorded.filter(d => d.state === 'no-checkout').length,
      absent: days.filter(d => d.state === 'absent').length,
      leaveDays: days.reduce((n, d) => n + (!d.weekend && d.leave ? (d.leave.halfDay ? 0.5 : 1) : 0), 0),
      averageMinutes: finished.length
        ? Math.round(finished.reduce((n, d) => n + d.record.minutes, 0) / finished.length)
        : null,
      onTime: recorded.length
        ? Math.round(((recorded.length - recorded.filter(d => d.record.late).length) / recorded.length) * 100)
        : null
    }

    res.json({
      month,
      today,
      timezone: tz,
      // A blank zone is read as UTC everywhere; the page says so rather than
      // showing somebody in Pune a clock five and a half hours behind
      timezoneSet: Boolean(req.user.timezone),
      policy: policyForClient(),
      todayRecord: todayRow ? readDay(todayRow, { today, halfDayLeave: Boolean(todayLeave?.halfDay) }) : null,
      todayLeave,
      days,
      summary
    })
  } catch (err) {
    console.error('My attendance error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/attendance/check-in
const checkIn = async (req, res) => {
  try {
    const tz = zoneOf(req.user)
    const today = todayIn(tz)

    if (await Attendance.exists({ user: req.user._id, date: today })) {
      return res.status(409).json({ message: 'You already checked in today' })
    }

    const onLeave = await Leave.findOne({
      user: req.user._id, status: 'approved', halfDay: false, from: { $lte: today }, to: { $gte: today }
    }).lean()
    if (onLeave) {
      return res.status(400).json({ message: 'You are on leave today — cancel it first if you are working' })
    }

    try {
      const row = await Attendance.create({
        user: req.user._id,
        userName: req.user.name,
        team: await ownTeam(req.user),
        date: today,
        timezone: tz,
        checkIn: new Date(),
        note: req.body.note || ''
      })
      const record = readDay(row.toObject(), { today })
      res.status(201).json({
        message: record.late ? `Checked in at ${record.inAt} — ${record.lateBy} min late` : `Checked in at ${record.inAt}`,
        record
      })
    } catch (err) {
      // Two taps at once: the unique index lets exactly one through
      if (err.code === 11000) return res.status(409).json({ message: 'You already checked in today' })
      throw err
    }
  } catch (err) {
    console.error('Check in error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/attendance/check-out
const checkOut = async (req, res) => {
  try {
    const tz = zoneOf(req.user)
    const today = todayIn(tz)

    const row = await Attendance.findOne({ user: req.user._id, date: today })
    if (!row) return res.status(400).json({ message: 'Check in first' })
    if (row.checkOut) return res.status(409).json({ message: 'You already checked out today' })

    row.checkOut = new Date()
    if (req.body.note) row.note = req.body.note
    await row.save()

    const record = readDay(row.toObject(), { today })
    const hours = Math.floor(record.minutes / 60)
    res.json({
      message: `Checked out at ${record.outAt} · ${hours}h ${record.minutes % 60}m today`,
      record
    })
  } catch (err) {
    console.error('Check out error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

/** Everybody this person keeps attendance for: all teams for an admin, their own for a manager. */
const peopleInScope = async (user, teamFilter) => {
  if (!(await canUse(user, 'team-attendance'))) return null

  let teamIds
  if (isAdmin(user)) {
    teamIds = teamFilter ? [teamFilter] : null
  } else if (user.role === 'manager') {
    const managed = (await Team.find({ manager: user._id }).select('_id').lean()).map(t => String(t._id))
    teamIds = teamFilter ? managed.filter(id => id === String(teamFilter)) : managed
  } else {
    return null
  }

  const filter = { _id: { $ne: user._id }, role: { $in: ['employee', 'manager'] } }
  if (teamIds) {
    const teams = await Team.find({ _id: { $in: teamIds } }).select('members manager').lean()
    const ids = teams.flatMap(t => [...(t.members || []), ...(isAdmin(user) && t.manager ? [t.manager] : [])])
    filter._id = { $in: ids, $ne: user._id }
  }

  return User.find(filter).select('name role team avatar employment.position').populate('team', 'name').sort({ name: 1 }).lean()
}

// GET /api/attendance/team?date=YYYY-MM-DD&team=… — one day across the team
const teamAttendance = async (req, res) => {
  try {
    const today = todayIn(zoneOf(req.user))
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : today

    const people = await peopleInScope(req.user, req.query.team)
    if (!people) return res.status(403).json({ message: 'Your role does not keep team attendance' })

    const ids = people.map(p => p._id)
    const { first } = monthBounds(date.slice(0, 7))
    const monthEnd = date < today ? date : today

    const [rows, leaves, monthRows, starts, teams, monthLeaves] = await Promise.all([
      Attendance.find({ user: { $in: ids }, date }).lean(),
      Leave.find({ user: { $in: ids }, status: 'approved', from: { $lte: date }, to: { $gte: date } })
        .select('user type halfDay to').lean(),
      Attendance.find({ user: { $in: ids }, date: { $gte: first, $lte: monthEnd } })
        .select('user date checkIn checkOut timezone').lean(),
      Attendance.aggregate([
        { $match: { user: { $in: ids } } },
        { $group: { _id: '$user', since: { $min: '$date' } } }
      ]),
      isAdmin(req.user)
        ? Team.find().select('name').sort({ name: 1 }).lean()
        : Team.find({ manager: req.user._id }).select('name').sort({ name: 1 }).lean(),
      Leave.find({ user: { $in: ids }, status: 'approved', from: { $lte: monthEnd }, to: { $gte: first } })
        .select('user from to halfDay').lean()
    ])

    // Grouped once, rather than filtering every list for every person
    const group = (list) => {
      const by = new Map()
      for (const item of list) {
        const key = String(item.user)
        if (!by.has(key)) by.set(key, [])
        by.get(key).push(item)
      }
      return by
    }
    const rowsBy = group(rows)
    const leavesBy = group(leaves)
    const monthRowsBy = group(monthRows)
    const monthLeavesBy = group(monthLeaves)

    const sinceOf = new Map(starts.map(s => [String(s._id), s.since]))
    const workdays = eachDay(first, monthEnd).filter(d => !isWeekend(d))

    const list = people.map(person => {
      const id = String(person._id)
      const leave = leavesBy.get(id)?.[0]
      const row = rowsBy.get(id)?.[0]
      const record = row ? readDay(row, { today, halfDayLeave: Boolean(leave?.halfDay) }) : null

      const mine = monthRowsBy.get(id) || []
      const recordedDates = new Set(mine.map(r => r.date))
      const theirLeave = monthLeavesBy.get(id) || []
      const since = sinceOf.get(id)
      const absent = since
        ? workdays.filter(d =>
            d >= since && d < today && !recordedDates.has(d) && !theirLeave.some(l => !l.halfDay && l.from <= d && l.to >= d)
          ).length
        : 0

      return {
        user: {
          _id: person._id,
          name: person.name,
          avatar: person.avatar || '',
          position: person.employment?.position || '',
          team: person.team?.name || ''
        },
        state: dayFor({ day: date, record, leave, today, since }),
        record,
        leave: leave ? { type: leave.type, halfDay: leave.halfDay, to: leave.to } : null,
        month: {
          present: mine.length,
          late: mine.filter(r => readDay(r, { today }).late).length,
          absent
        }
      }
    })

    const count = (fn) => list.filter(fn).length

    res.json({
      date,
      today,
      policy: policyForClient(),
      teams,
      people: list,
      counts: {
        total: list.length,
        in: count(p => p.state === 'working'),
        done: count(p => ['present', 'half-day', 'no-checkout'].includes(p.state)),
        late: count(p => p.record?.late),
        leave: count(p => p.state === 'leave'),
        missing: count(p => ['absent', 'not-in'].includes(p.state))
      }
    })
  } catch (err) {
    console.error('Team attendance error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/attendance/correct — a manager fixes somebody's day
const correctAttendance = async (req, res) => {
  try {
    const { user: userId, date, checkIn: inAt, checkOut: outAt, reason } = req.body

    if (String(userId) === String(req.user._id)) {
      return res.status(403).json({ message: 'Somebody else has to correct your own attendance' })
    }

    const today = todayIn(zoneOf(req.user))
    if (date > today) return res.status(400).json({ message: 'That day has not happened yet' })
    if (outAt && outAt <= inAt) return res.status(400).json({ message: 'Check-out has to be after check-in' })

    const people = await peopleInScope(req.user)
    const person = people?.find(p => String(p._id) === String(userId))
    if (!person) return res.status(403).json({ message: 'That person is not on a team you keep attendance for' })

    const full = await User.findById(userId).select('timezone').lean()
    const tz = zoneOf(full)

    const existing = await Attendance.findOne({ user: userId, date })
    const before = existing ? readDay(existing.toObject(), { today }) : null

    const row = existing || new Attendance({
      user: userId,
      userName: person.name,
      team: person.team?._id || null,
      date,
      timezone: tz
    })
    row.checkIn = instantIn(row.timezone || tz, date, inAt)
    row.checkOut = outAt ? instantIn(row.timezone || tz, date, outAt) : null
    row.corrected = { by: req.user._id, byName: req.user.name, at: new Date(), reason }
    await row.save()

    const after = readDay(row.toObject(), { today })

    await audit.record({
      action: 'attendance.corrected',
      actor: req.user,
      subject: { _id: person._id, name: person.name },
      team: row.team,
      entityType: 'Attendance',
      entityId: row._id,
      changes: [
        { field: 'checkIn', from: before?.inAt || '', to: after.inAt },
        { field: 'checkOut', from: before?.outAt || '', to: after.outAt || '' }
      ].filter(c => c.from !== c.to),
      note: `${date} · ${reason}`
    })

    res.json({ message: `${person.name}'s attendance for ${date} updated`, record: after })
  } catch (err) {
    console.error('Correct attendance error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = { myAttendance, checkIn, checkOut, teamAttendance, correctAttendance }
