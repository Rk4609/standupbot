const Attendance = require('../models/Attendance')
const Leave = require('../models/Leave')
const Payslip = require('../models/Payslip')
const User = require('../models/User')
const audit = require('../services/auditService')
const { notifyMany } = require('../services/notifyService')
const { canUse } = require('../services/roleService')
const { addDays, todayIn, zoneOf } = require('../utils/time')
const { isOffDay } = require('../services/settingsService')
const { computeSlip, monthBounds, monthlyOf } = require('../utils/payPolicy')

const MONTH = /^\d{4}-\d{2}$/

const weekdaysBetween = (from, to) => {
  const days = []
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (!isOffDay(day)) days.push(day)
  }
  return days
}

const monthLabel = (month) =>
  new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString('en-IN', {
    month: 'long', year: 'numeric', timeZone: 'UTC'
  })

/** Everybody with a salary on record, in the shape a slip copies. */
const payablePeople = () =>
  User.find({ 'salary.amount': { $gt: 0 } })
    .select('name email role team salary employment')
    .populate('team', 'name')
    .sort({ name: 1 })
    .lean()

/**
 * The days each person is not paid for in a month.
 *
 * Unpaid leave counts wherever it falls in the month. An absence only counts
 * on a working day that is over, once attendance was being kept for that
 * person, and not under any approved leave — somebody on sick leave is not
 * absent. Days before a mid-month joining are not paid either.
 */
const unpaidDays = async (people, month, today) => {
  const ids = people.map(p => p._id)
  const { first, last } = monthBounds(month)
  const lastOver = last < today ? last : addDays(today, -1)

  const [rows, leaves, starts] = await Promise.all([
    Attendance.find({ user: { $in: ids }, date: { $gte: first, $lte: last } }).select('user date').lean(),
    Leave.find({ user: { $in: ids }, status: 'approved', from: { $lte: last }, to: { $gte: first } })
      .select('user type from to halfDay').lean(),
    Attendance.aggregate([
      { $match: { user: { $in: ids } } },
      { $group: { _id: '$user', since: { $min: '$date' } } }
    ])
  ])

  const sinceOf = new Map(starts.map(s => [String(s._id), s.since]))
  const monthDays = weekdaysBetween(first, last)

  return new Map(people.map(person => {
    const id = String(person._id)
    const theirLeave = leaves.filter(l => String(l.user) === id)
    const recorded = new Set(rows.filter(r => String(r.user) === id).map(r => r.date))

    const unpaidLeaveDays = theirLeave
      .filter(l => l.type === 'unpaid')
      .reduce((n, l) => n + monthDays.filter(d => d >= l.from && d <= l.to).length * (l.halfDay ? 0.5 : 1), 0)

    const joined = person.employment?.joinedOn
      ? new Date(person.employment.joinedOn).toISOString().slice(0, 10)
      : null
    const notJoinedDays = joined ? monthDays.filter(d => d < joined).length : 0

    const since = sinceOf.get(id)
    const absentDays = since
      ? monthDays.filter(d =>
          d <= lastOver &&
          d >= since &&
          (!joined || d >= joined) &&
          !recorded.has(d) &&
          !theirLeave.some(l => !l.halfDay && l.from <= d && l.to >= d)
        ).length
      : 0

    return [id, { unpaidLeaveDays, absentDays, notJoinedDays }]
  }))
}

const slipFor = (person, month, days) => ({
  user: person._id,
  month,
  employee: {
    name: person.name,
    email: person.email,
    employeeId: person.employment?.employeeId || '',
    position: person.employment?.position || '',
    department: person.employment?.department || '',
    team: person.team?.name || '',
    joinedOn: person.employment?.joinedOn || null
  },
  ...computeSlip({ salary: person.salary, month, ...days })
})

// GET /api/payslips/mine — my published slips, newest first
const myPayslips = async (req, res) => {
  try {
    const slips = await Payslip.find({ user: req.user._id, status: 'published' })
      .select('month currency gross totalDeductions net publishedAt lossOfPayDays')
      .sort({ month: -1 })
      .lean()
    res.json({ payslips: slips })
  } catch (err) {
    console.error('My payslips error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/payslips/:id — one slip, to its owner once published, or to payroll
const getPayslip = async (req, res) => {
  try {
    const slip = await Payslip.findById(req.params.id).lean()
    const mine = slip && String(slip.user) === String(req.user._id) && slip.status === 'published'

    // Somebody else's slip does not exist, as far as anybody without pay knows
    if (!slip || (!mine && !(await canUse(req.user, 'pay')))) {
      return res.status(404).json({ message: 'No such payslip' })
    }
    res.json({ payslip: slip })
  } catch (err) {
    console.error('Get payslip error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/payslips/run?month=YYYY-MM — a month's payroll, run or not
const payrollMonth = async (req, res) => {
  try {
    const today = todayIn(zoneOf(req.user))
    const month = MONTH.test(req.query.month || '') ? req.query.month : today.slice(0, 7)

    const [people, slips, withoutSalary] = await Promise.all([
      payablePeople(),
      Payslip.find({ month }).select('user status gross totalDeductions net lossOfPayDays publishedAt').lean(),
      User.countDocuments({ $or: [{ 'salary.amount': null }, { 'salary.amount': { $lte: 0 } }] })
    ])

    const days = await unpaidDays(people, month, today)
    const slipOf = new Map(slips.map(s => [String(s.user), s]))

    const rows = people.map(person => {
      const slip = slipOf.get(String(person._id))
      const preview = computeSlip({ salary: person.salary, month, ...days.get(String(person._id)) })
      return {
        user: {
          _id: person._id,
          name: person.name,
          position: person.employment?.position || '',
          team: person.team?.name || ''
        },
        monthly: monthlyOf(person.salary),
        currency: person.salary.currency || 'INR',
        slip: slip
          ? { _id: slip._id, status: slip.status, gross: slip.gross, net: slip.net, lossOfPayDays: slip.lossOfPayDays }
          : null,
        preview: { gross: preview.gross, net: preview.net, lossOfPayDays: preview.lossOfPayDays }
      }
    })

    const sum = (list, key) => list.reduce((n, x) => n + x[key], 0)
    const figures = rows.map(r => r.slip || r.preview)

    res.json({
      month,
      today,
      isFuture: month > today.slice(0, 7),
      rows,
      counts: {
        people: rows.length,
        drafts: slips.filter(s => s.status === 'draft').length,
        published: slips.filter(s => s.status === 'published').length,
        notRun: rows.filter(r => !r.slip).length,
        withoutSalary
      },
      totals: {
        gross: sum(figures, 'gross'),
        net: sum(figures, 'net'),
        deductions: sum(figures, 'gross') - sum(figures, 'net')
      }
    })
  } catch (err) {
    console.error('Payroll month error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/payslips/run — work out this month's slips as drafts
const generatePayroll = async (req, res) => {
  try {
    const today = todayIn(zoneOf(req.user))
    const { month } = req.body
    if (month > today.slice(0, 7)) {
      return res.status(400).json({ message: 'That month has not started yet' })
    }

    const people = await payablePeople()
    const days = await unpaidDays(people, month, today)

    const published = new Set(
      (await Payslip.find({ month, status: 'published' }).select('user').lean()).map(s => String(s.user))
    )

    // A published slip has been read by its owner; it is never quietly redone
    const todo = people.filter(p => !published.has(String(p._id)))

    await Promise.all(todo.map(person =>
      Payslip.updateOne(
        { user: person._id, month },
        {
          $set: {
            ...slipFor(person, month, days.get(String(person._id))),
            status: 'draft',
            generatedBy: req.user._id,
            generatedByName: req.user.name
          }
        },
        { upsert: true }
      )
    ))

    await audit.record({
      action: 'payroll.generated',
      actor: req.user,
      entityType: 'Payslip',
      note: `${month} · ${todo.length} drafts${published.size ? ` · ${published.size} already published` : ''}`
    })

    res.json({
      message: `${todo.length} ${todo.length === 1 ? 'payslip' : 'payslips'} ready to check for ${monthLabel(month)}`,
      drafted: todo.length,
      skipped: published.size
    })
  } catch (err) {
    console.error('Generate payroll error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/payslips/publish — hand the month's drafts to their owners
const publishPayroll = async (req, res) => {
  try {
    const { month } = req.body
    const drafts = await Payslip.find({ month, status: 'draft' }).select('user').lean()
    if (drafts.length === 0) {
      return res.status(400).json({ message: 'Nothing to publish — generate the payslips first' })
    }

    await Payslip.updateMany(
      { _id: { $in: drafts.map(d => d._id) } },
      { $set: { status: 'published', publishedAt: new Date() } }
    )

    await notifyMany(req.app.get('io'), drafts.map(d => d.user), {
      sender: req.user._id,
      type: 'payslip_ready',
      message: `Your payslip for ${monthLabel(month)} is ready`,
      link: '/payslips'
    })

    await audit.record({
      action: 'payroll.published',
      actor: req.user,
      entityType: 'Payslip',
      note: `${month} · ${drafts.length} published`
    })

    res.json({ message: `${drafts.length} payslips published for ${monthLabel(month)}`, published: drafts.length })
  } catch (err) {
    console.error('Publish payroll error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = { myPayslips, getPayslip, payrollMonth, generatePayroll, publishPayroll }
