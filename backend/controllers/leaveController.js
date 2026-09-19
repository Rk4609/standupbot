const Leave = require('../models/Leave')
const Team = require('../models/Team')
const User = require('../models/User')
const audit = require('../services/auditService')
const { notify, notifyMany } = require('../services/notifyService')
const { canUse } = require('../services/roleService')
const { ownTeam } = require('../utils/teams')
const { addDays, daysBetween, todayIn, zoneOf } = require('../utils/time')
const { allowances, MAX_SPAN_DAYS, workingDays, balanceFor } = require('../utils/leavePolicy')
const { settings } = require('../services/settingsService')

const PAGE_SIZES = [10, 20, 50]
const DEFAULT_LIMIT = 20

const isAdmin = (user) => user.role === 'admin'

/** How far back somebody can ask: a sick day is often written up afterwards. */
const BACKDATE_DAYS = 30

const TYPE_LABEL = { casual: 'Casual', sick: 'Sick', earned: 'Earned', unpaid: 'Unpaid' }

/** One day, or the first and last, for a notification line. */
const span = (leave) =>
  leave.from === leave.to ? leave.from : `${leave.from} to ${leave.to}`

const dayWord = (n) => `${n} ${n === 1 ? 'day' : 'days'}`

/** Teams this person manages. */
const managedTeams = async (user) =>
  (await Team.find({ manager: user._id }).select('_id').lean()).map(t => t._id)

/**
 * Whose requests this person answers: everybody for an admin, the teams they
 * lead for a manager, nobody otherwise.
 */
const decidingScope = async (user) => {
  if (!(await canUse(user, 'leaves'))) return null
  if (isAdmin(user)) return {}
  if (user.role !== 'manager') return null
  return { team: { $in: await managedTeams(user) } }
}

/** May this person answer that request? Never their own. */
const mayDecide = async (user, leave) => {
  if (String(leave.user) === String(user._id)) return false
  const scope = await decidingScope(user)
  if (!scope) return false
  if (!scope.team) return true
  return scope.team.$in.some(id => String(id) === String(leave.team))
}

/**
 * Who hears about a new request: the team's manager, or the admins when the
 * team has none — or when the person asking is that manager.
 */
const approversFor = async (user, team) => {
  if (team) {
    const row = await Team.findById(team).select('manager').lean()
    if (row?.manager && String(row.manager) !== String(user._id)) return [row.manager]
  }
  const admins = await User.find({ role: 'admin' }).select('_id').lean()
  return admins.map(a => a._id).filter(id => String(id) !== String(user._id))
}

const yearOf = (req) => {
  const asked = Number(req.query.year)
  return Number.isInteger(asked) && asked > 2000 && asked < 2100
    ? asked
    : Number(todayIn(zoneOf(req.user)).slice(0, 4))
}

// GET /api/leave/mine — my requests this year, and what is left
const myLeave = async (req, res) => {
  try {
    const year = yearOf(req)

    const requests = await Leave.find({ user: req.user._id, from: { $regex: `^${year}-` } })
      .sort({ from: -1 })
      .lean()

    res.json({
      year,
      today: todayIn(zoneOf(req.user)),
      requests,
      balance: balanceFor(requests, year),
      types: Leave.TYPES,
      // So the form counts days the way the server will
      holidays: settings().holidays
    })
  } catch (err) {
    console.error('My leave error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/leave — ask for time off
const requestLeave = async (req, res) => {
  try {
    const { type, from, reason } = req.body
    const halfDay = Boolean(req.body.halfDay)
    const to = halfDay ? from : req.body.to

    if (to < from) {
      return res.status(400).json({ message: 'The last day is before the first' })
    }
    if (daysBetween(from, to) + 1 > MAX_SPAN_DAYS) {
      return res.status(400).json({ message: `Ask for at most ${MAX_SPAN_DAYS} days at a time` })
    }
    if (from.slice(0, 4) !== to.slice(0, 4)) {
      return res.status(400).json({ message: 'Split a request that crosses into the new year' })
    }

    const today = todayIn(zoneOf(req.user))
    if (from < addDays(today, -BACKDATE_DAYS)) {
      return res.status(400).json({ message: `That is more than ${BACKDATE_DAYS} days ago` })
    }

    const days = workingDays(from, to, halfDay)
    if (days === 0) {
      return res.status(400).json({ message: 'Those days are all a weekend — nothing to ask for' })
    }

    // Two requests covering the same day cannot both be right
    const clash = await Leave.findOne({
      user: req.user._id,
      status: { $in: ['pending', 'approved'] },
      from: { $lte: to },
      to: { $gte: from }
    }).lean()
    if (clash) {
      return res.status(409).json({
        message: `You already asked for ${span(clash)} (${clash.status === 'pending' ? 'waiting' : 'approved'})`
      })
    }

    const allowance = allowances()[type]
    if (allowance !== null) {
      const year = from.slice(0, 4)
      const thisYear = await Leave.find({ user: req.user._id, from: { $regex: `^${year}-` } }).lean()
      const left = balanceFor(thisYear, year).find(b => b.type === type).remaining
      if (days > left) {
        return res.status(400).json({
          message: `Only ${dayWord(left)} of ${TYPE_LABEL[type].toLowerCase()} leave left this year`
        })
      }
    }

    const team = await ownTeam(req.user)

    const leave = await Leave.create({
      user: req.user._id,
      userName: req.user.name,
      team,
      type,
      from,
      to,
      halfDay,
      days,
      reason
    })

    await notifyMany(req.app.get('io'), await approversFor(req.user, team), {
      sender: req.user._id,
      type: 'leave_requested',
      message: `${req.user.name} asked for ${TYPE_LABEL[type].toLowerCase()} leave · ${span(leave)} (${dayWord(days)})`,
      link: '/leaves'
    })

    res.status(201).json(leave)
  } catch (err) {
    console.error('Request leave error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/leave/:id/cancel — take a request back
const cancelLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id)
    if (!leave) return res.status(404).json({ message: 'No such request' })
    if (String(leave.user) !== String(req.user._id)) {
      return res.status(403).json({ message: 'That is not yours to cancel' })
    }

    const today = todayIn(zoneOf(req.user))
    const cancellable = leave.status === 'pending' ||
      (leave.status === 'approved' && leave.from > today)
    if (!cancellable) {
      return res.status(400).json({
        message: leave.status === 'approved'
          ? 'That leave has already started — ask your manager instead'
          : `That one is already ${leave.status}`
      })
    }

    const wasApproved = leave.status === 'approved'
    leave.status = 'cancelled'
    await leave.save()

    // Whoever planned around an approved absence needs to know it is off
    if (wasApproved && leave.decidedBy) {
      await notify(req.app.get('io'), {
        recipient: leave.decidedBy,
        sender: req.user._id,
        type: 'leave_decided',
        message: `${req.user.name} cancelled their leave · ${span(leave)}`,
        link: '/leaves'
      })
    }

    res.json({ message: 'Request cancelled', leave })
  } catch (err) {
    console.error('Cancel leave error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/leave/team — requests waiting on me, and what was decided
const teamLeave = async (req, res) => {
  try {
    const scope = await decidingScope(req.user)
    if (!scope) return res.status(403).json({ message: 'Your role does not answer leave requests' })

    const base = { ...scope, user: { $ne: req.user._id } }
    const filter = { ...base }
    if (Leave.STATUSES.includes(req.query.status)) filter.status = req.query.status

    const limit = PAGE_SIZES.includes(Number(req.query.limit)) ? Number(req.query.limit) : DEFAULT_LIMIT
    const page = Math.max(1, Number(req.query.page) || 1)

    const total = await Leave.countDocuments(filter)
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const safePage = Math.min(page, totalPages)

    const today = todayIn(zoneOf(req.user))

    const [rows, pendingCount, away] = await Promise.all([
      Leave.find(filter)
        .populate('team', 'name')
        // Waiting first, soonest first; then history, newest first
        .sort({ status: 1, from: 1 })
        .skip((safePage - 1) * limit)
        .limit(limit)
        .lean(),
      Leave.countDocuments({ ...base, status: 'pending' }),
      Leave.find({ ...scope, status: 'approved', from: { $lte: today }, to: { $gte: today } })
        .select('user userName type halfDay to')
        .sort({ userName: 1 })
        .lean()
    ])

    // What each person has left of the kind they asked for, so a decision is
    // not made blind. One query for the whole page.
    const people = [...new Set(rows.map(r => String(r.user)))]
    const theirs = people.length
      ? await Leave.find({ user: { $in: people } }).select('user type from days status').lean()
      : []

    const requests = rows.map(row => {
      const year = row.from.slice(0, 4)
      const mine = theirs.filter(r => String(r.user) === String(row.user))
      const balance = balanceFor(mine, year).find(b => b.type === row.type)
      return {
        ...row,
        balance: { allowance: balance.allowance, used: balance.used, remaining: balance.remaining },
        canDecide: row.status === 'pending'
      }
    })

    res.json({
      requests,
      pendingCount,
      away,
      today,
      statuses: Leave.STATUSES,
      types: Leave.TYPES,
      pageSizes: PAGE_SIZES,
      total,
      page: safePage,
      limit,
      totalPages
    })
  } catch (err) {
    console.error('Team leave error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

/** Approve and reject share everything but the verdict. */
const decide = (verdict) => async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id)
    if (!leave) return res.status(404).json({ message: 'No such request' })

    if (!(await mayDecide(req.user, leave))) {
      return res.status(403).json({
        message: String(leave.user) === String(req.user._id)
          ? 'Somebody else has to answer your own request'
          : 'That request is not yours to answer'
      })
    }
    if (leave.status !== 'pending') {
      return res.status(400).json({ message: `That one is already ${leave.status}` })
    }

    const note = String(req.body.note || '').trim()
    if (verdict === 'rejected' && note.length < 3) {
      return res.status(400).json({ message: 'Say why — they will want to plan around it' })
    }

    leave.status = verdict
    leave.decidedBy = req.user._id
    leave.decidedByName = req.user.name
    leave.decidedAt = new Date()
    leave.note = note
    await leave.save()

    await audit.record({
      action: verdict === 'approved' ? 'leave.approved' : 'leave.rejected',
      actor: req.user,
      subject: { _id: leave.user, name: leave.userName },
      team: leave.team || null,
      entityType: 'Leave',
      entityId: leave._id,
      note: `${TYPE_LABEL[leave.type]} · ${span(leave)} · ${dayWord(leave.days)}${note ? ` · ${note}` : ''}`
    })

    await notify(req.app.get('io'), {
      recipient: leave.user,
      sender: req.user._id,
      type: 'leave_decided',
      message: verdict === 'approved'
        ? `Your leave for ${span(leave)} was approved`
        : `Your leave for ${span(leave)} was not approved: ${note.slice(0, 60)}`,
      link: '/leave'
    })

    res.json({
      message: `${leave.userName}'s leave ${verdict === 'approved' ? 'approved' : 'rejected'}`,
      leave
    })
  } catch (err) {
    console.error('Decide leave error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/leave/calendar?month=YYYY-MM — who is away, day by day
const calendar = async (req, res) => {
  try {
    const today = todayIn(zoneOf(req.user))
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : today.slice(0, 7)
    const first = `${month}-01`
    const last = addDays(`${addDays(first, 32).slice(0, 7)}-01`, -1)

    /**
     * Somebody who answers requests sees their teams, waiting ones included,
     * so a clash is visible before they approve it. Everybody else sees their
     * own team's approved days — who is away, never why.
     */
    const scope = await decidingScope(req.user)
    const deciding = Boolean(scope)

    let who
    if (deciding) {
      who = isAdmin(req.user) ? {} : { team: { $in: [...scope.team.$in, await ownTeam(req.user)].filter(Boolean) } }
    } else {
      const team = await ownTeam(req.user)
      who = team ? { team } : { user: req.user._id }
    }

    const rows = await Leave.find({
      $or: [
        { ...who, status: 'approved' },
        ...(deciding ? [{ ...who, status: 'pending' }] : []),
        { user: req.user._id, status: 'pending' }
      ],
      from: { $lte: last },
      to: { $gte: first }
    })
      .select('user userName type from to halfDay days status')
      .sort({ from: 1, userName: 1 })
      .lean()

    res.json({
      month,
      first,
      last,
      today,
      entries: rows.map(r => ({ ...r, mine: String(r.user) === String(req.user._id) }))
    })
  } catch (err) {
    console.error('Leave calendar error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = {
  myLeave,
  requestLeave,
  cancelLeave,
  teamLeave,
  approveLeave: decide('approved'),
  rejectLeave: decide('rejected'),
  calendar
}
