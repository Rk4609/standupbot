const Attendance = require('../models/Attendance')
const Leave = require('../models/Leave')
const Payslip = require('../models/Payslip')
const Team = require('../models/Team')
const User = require('../models/User')
const { canUse } = require('../services/roleService')
const { sendCsv } = require('../utils/csv')
const { readDay } = require('../utils/attendancePolicy')
const { balanceFor } = require('../utils/leavePolicy')
const { monthBounds } = require('../utils/payPolicy')
const { addDays, todayIn, zoneOf } = require('../utils/time')
const { isOffDay } = require('../services/settingsService')

/**
 * Downloads of what a lead can already see on the page, as CSV.
 *
 * Each export uses the same scope as its page — an admin everybody, a
 * manager the team they lead — and pay only ever appears for a role that
 * holds it.
 */

const isAdmin = (user) => user.role === 'admin'
const day = (date) => (date ? new Date(date).toISOString().slice(0, 10) : '')

/** The people in scope, with their team's name. */
const peopleInScope = async (user) => {
  if (isAdmin(user)) {
    return User.find({}).populate('team', 'name').sort({ name: 1 }).lean()
  }
  const teams = await Team.find({ manager: user._id }).select('_id').lean()
  if (teams.length === 0) return null
  return User.find({ team: { $in: teams.map(t => t._id) } }).populate('team', 'name').sort({ name: 1 }).lean()
}

const noTeam = (res) => res.status(400).json({ message: 'You are not managing any team!' })

// GET /api/exports/employees
const exportEmployees = async (req, res) => {
  try {
    const people = await peopleInScope(req.user)
    if (!people) return noTeam(res)
    const pay = await canUse(req.user, 'pay')

    const header = [
      'Name', 'Email', 'Role', 'Team', 'Employee ID', 'Position', 'Department', 'Type',
      'Joined', 'Experience (years)', 'Phone', 'City',
      ...(pay ? ['Salary', 'Currency', 'Per'] : [])
    ]
    const rows = people.map(p => [
      p.name, p.email, p.role, p.team?.name || '', p.employment?.employeeId || '', p.employment?.position || '',
      p.employment?.department || '', p.employment?.type || '', day(p.employment?.joinedOn),
      p.employment?.experienceYears ?? '', p.phone || '', p.address?.city || '',
      ...(pay ? [p.salary?.amount ?? '', p.salary?.currency || '', p.salary?.period || ''] : [])
    ])

    sendCsv(res, `employees-${todayIn(zoneOf(req.user))}.csv`, header, rows)
  } catch (err) {
    console.error('Export employees error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/exports/attendance?month=YYYY-MM — every working day, per person
const exportAttendance = async (req, res) => {
  try {
    const people = await peopleInScope(req.user)
    if (!people) return noTeam(res)
    const today = todayIn(zoneOf(req.user))
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : today.slice(0, 7)
    const { first, last } = monthBounds(month)
    const ids = people.map(p => p._id)

    const [rows, leaves, starts] = await Promise.all([
      Attendance.find({ user: { $in: ids }, date: { $gte: first, $lte: last } }).lean(),
      Leave.find({ user: { $in: ids }, status: 'approved', from: { $lte: last }, to: { $gte: first } }).lean(),
      Attendance.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: '$user', since: { $min: '$date' } } }])
    ])
    const since = new Map(starts.map(s => [String(s._id), s.since]))

    const out = []
    for (const person of people) {
      const id = String(person._id)
      for (let d = first; d <= last && d <= today; d = addDays(d, 1)) {
        const row = rows.find(r => String(r.user) === id && r.date === d)
        const leave = leaves.find(l => String(l.user) === id && l.from <= d && l.to >= d)
        if (!row && (isOffDay(d) || (!leave && (!since.get(id) || d < since.get(id) || d === today)))) continue

        const read = row ? readDay(row, { today, halfDayLeave: Boolean(leave?.halfDay) }) : null
        const state = read ? read.state : leave ? `${leave.type} leave${leave.halfDay ? ' (half)' : ''}` : 'absent'
        out.push([
          person.name, person.email, person.team?.name || '', d, state,
          read?.inAt || '', read?.outAt || '',
          read?.minutes != null ? (read.minutes / 60).toFixed(2) : '',
          read?.late ? read.lateBy : '',
          read?.corrected ? `Corrected by ${read.corrected.byName}: ${read.corrected.reason}` : ''
        ])
      }
    }

    sendCsv(res, `attendance-${month}.csv`,
      ['Name', 'Email', 'Team', 'Date', 'State', 'In', 'Out', 'Hours', 'Late (min)', 'Note'], out)
  } catch (err) {
    console.error('Export attendance error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/exports/leave?year=YYYY&view=requests|balances
const exportLeave = async (req, res) => {
  try {
    const people = await peopleInScope(req.user)
    if (!people) return noTeam(res)
    const today = todayIn(zoneOf(req.user))
    const year = /^\d{4}$/.test(req.query.year || '') ? req.query.year : today.slice(0, 4)
    const requests = await Leave.find({ user: { $in: people.map(p => p._id) }, from: { $regex: `^${year}-` } })
      .sort({ from: 1 }).lean()

    if (req.query.view === 'balances') {
      const header = ['Name', 'Email', 'Team']
      const types = ['casual', 'sick', 'earned', 'unpaid']
      for (const t of types) header.push(`${t} used`, `${t} waiting`, `${t} left`)
      const rows = people.map(p => {
        const balance = balanceFor(requests.filter(r => String(r.user) === String(p._id)), year)
        return [p.name, p.email, p.team?.name || '', ...types.flatMap(t => {
          const b = balance.find(x => x.type === t)
          return [b.used, b.pending, b.remaining === null ? 'no limit' : b.remaining]
        })]
      })
      return sendCsv(res, `leave-balances-${year}.csv`, header, rows)
    }

    const byId = new Map(people.map(p => [String(p._id), p]))
    const rows = requests.map(r => [
      r.userName, byId.get(String(r.user))?.email || '', byId.get(String(r.user))?.team?.name || '',
      r.type, r.from, r.to, r.halfDay ? 'yes' : '', r.days, r.status, r.reason, r.decidedByName, r.note
    ])
    sendCsv(res, `leave-requests-${year}.csv`,
      ['Name', 'Email', 'Team', 'Type', 'From', 'To', 'Half day', 'Days', 'Status', 'Reason', 'Decided by', 'Note'], rows)
  } catch (err) {
    console.error('Export leave error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/exports/payroll?month=YYYY-MM — the month's slips, for pay only
const exportPayroll = async (req, res) => {
  try {
    const today = todayIn(zoneOf(req.user))
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : today.slice(0, 7)
    const slips = await Payslip.find({ month }).sort({ 'employee.name': 1 }).lean()

    const rows = slips.map(s => {
      const earn = (label) => s.earnings.find(e => e.label === label)?.amount ?? 0
      const take = (label) => s.deductions.find(d => d.label === label)?.amount ?? 0
      return [
        s.employee.name, s.employee.email, s.employee.employeeId, s.employee.position, s.employee.team,
        s.status, s.currency, s.workingDays, s.paidDays, s.lossOfPayDays,
        earn('Basic'), earn('House rent allowance'), earn('Special allowance'), s.gross,
        take('Provident fund'), take('Professional tax'), take('Loss of pay'), s.totalDeductions, s.net
      ]
    })
    sendCsv(res, `payroll-${month}.csv`, [
      'Name', 'Email', 'Employee ID', 'Position', 'Team', 'Status', 'Currency', 'Working days', 'Paid days', 'LOP days',
      'Basic', 'HRA', 'Special allowance', 'Gross', 'Provident fund', 'Professional tax', 'Loss of pay', 'Total deductions', 'Net pay'
    ], rows)
  } catch (err) {
    console.error('Export payroll error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = { exportEmployees, exportAttendance, exportLeave, exportPayroll }
