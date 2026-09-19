const { Readable } = require('stream')
const Expense = require('../models/Expense')
const Team = require('../models/Team')
const User = require('../models/User')
const audit = require('../services/auditService')
const { notify, notifyMany } = require('../services/notifyService')
const { canUse } = require('../services/roleService')
const { cloudinary } = require('../config/cloudinary')
const { ownTeam } = require('../utils/teams')
const { todayIn, zoneOf } = require('../utils/time')

const { paging, PAGE_SIZES } = require('../utils/paging')
const isAdmin = (user) => user.role === 'admin'
const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`

/** Whose claims this person answers: everybody for an admin, their teams for a manager. */
const decidingScope = async (user) => {
  if (!(await canUse(user, 'expense-approvals'))) return null
  if (isAdmin(user)) return {}
  if (user.role !== 'manager') return null
  const teams = await Team.find({ manager: user._id }).select('_id').lean()
  return { team: { $in: teams.map(t => t._id) } }
}

const mayDecide = async (user, expense) => {
  if (String(expense.user) === String(user._id)) return false
  const scope = await decidingScope(user)
  if (!scope) return false
  if (!scope.team) return true
  return scope.team.$in.some(id => String(id) === String(expense.team))
}

/** The team's manager, or the admins when there is none or it is the manager's own claim. */
const approversFor = async (user, team) => {
  if (team) {
    const row = await Team.findById(team).select('manager').lean()
    if (row?.manager && String(row.manager) !== String(user._id)) return [row.manager]
  }
  const admins = await User.find({ role: 'admin' }).select('_id').lean()
  return admins.map(a => a._id).filter(id => String(id) !== String(user._id))
}

// POST /api/expenses/receipt — upload a photo or PDF of the bill first
const uploadReceipt = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Attach a photo or PDF of the receipt' })
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'standupbot/receipts', resource_type: 'auto' },
        (error, uploaded) => (error ? reject(error) : resolve(uploaded))
      )
      Readable.from(req.file.buffer).pipe(stream)
    })
    res.status(201).json({ url: result.secure_url, name: req.file.originalname.slice(0, 200) })
  } catch (err) {
    console.error('Receipt upload error:', err.message)
    res.status(502).json({ message: 'The receipt could not be uploaded' })
  }
}

// GET /api/expenses/mine
const myExpenses = async (req, res) => {
  try {
    const rows = await Expense.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100).lean()
    const sum = (status) => rows.filter(r => status.includes(r.status)).reduce((n, r) => n + r.amount, 0)
    res.json({
      expenses: rows,
      totals: { waiting: sum(['pending']), approved: sum(['approved']), paid: sum(['paid']) },
      categories: Expense.CATEGORIES,
      today: todayIn(zoneOf(req.user))
    })
  } catch (err) {
    console.error('My expenses error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/expenses — claim something back
const claimExpense = async (req, res) => {
  try {
    const { category, amount, spentOn, description, receipt } = req.body
    if (spentOn > todayIn(zoneOf(req.user))) {
      return res.status(400).json({ message: 'That date has not happened yet' })
    }

    const team = await ownTeam(req.user)
    const expense = await Expense.create({
      user: req.user._id,
      userName: req.user.name,
      team,
      category,
      amount,
      spentOn,
      description,
      receipt: receipt || {}
    })

    await notifyMany(req.app.get('io'), await approversFor(req.user, team), {
      sender: req.user._id,
      type: 'expense_submitted',
      message: `${req.user.name} claimed ${rupees(amount)} for ${category}: ${description.slice(0, 60)}`,
      link: '/expense-approvals'
    })

    res.status(201).json({ expense })
  } catch (err) {
    console.error('Claim expense error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/expenses/:id/cancel — take back one still waiting
const cancelExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, user: req.user._id })
    if (!expense) return res.status(404).json({ message: 'No such claim' })
    if (expense.status !== 'pending') return res.status(400).json({ message: `That claim is already ${expense.status}` })
    expense.status = 'cancelled'
    await expense.save()
    res.json({ expense })
  } catch (err) {
    console.error('Cancel expense error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/expenses/team?status=&page=
const teamExpenses = async (req, res) => {
  try {
    const scope = await decidingScope(req.user)
    if (!scope) return res.status(403).json({ message: 'Your role does not answer expense claims' })

    const base = { ...scope, user: { $ne: req.user._id } }
    const filter = { ...base }
    if (Expense.STATUSES.includes(req.query.status)) filter.status = req.query.status
    const { page, limit, skip } = paging(req.query, 20)

    const [rows, total, waiting] = await Promise.all([
      Expense.find(filter).populate('team', 'name').sort({ status: 1, createdAt: -1 })
        .skip(skip).limit(limit).lean(),
      Expense.countDocuments(filter),
      Expense.aggregate([{ $match: { ...base, status: 'pending' } }, { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: '$amount' } } }])
    ])

    res.json({
      expenses: rows.map(r => ({ ...r, canDecide: r.status === 'pending' })),
      pending: { count: waiting[0]?.n || 0, amount: waiting[0]?.amount || 0 },
      statuses: Expense.STATUSES,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      limit,
      pageSizes: PAGE_SIZES,
      total
    })
  } catch (err) {
    console.error('Team expenses error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

const decide = (verdict) => async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
    if (!expense) return res.status(404).json({ message: 'No such claim' })
    if (!(await mayDecide(req.user, expense))) {
      return res.status(403).json({ message: String(expense.user) === String(req.user._id)
        ? 'Somebody else has to approve your own claim'
        : 'That claim is not yours to answer' })
    }
    if (expense.status !== 'pending') return res.status(400).json({ message: `That claim is already ${expense.status}` })

    const note = String(req.body.note || '').trim()
    if (verdict === 'rejected' && note.length < 3) return res.status(400).json({ message: 'Say why — they paid for it' })

    Object.assign(expense, { status: verdict, decidedBy: req.user._id, decidedByName: req.user.name, decidedAt: new Date(), note })
    await expense.save()

    await audit.record({
      action: verdict === 'approved' ? 'expense.approved' : 'expense.rejected',
      actor: req.user,
      subject: { _id: expense.user, name: expense.userName },
      team: expense.team,
      entityType: 'Expense',
      entityId: expense._id,
      note: `${rupees(expense.amount)} · ${expense.category}${note ? ` · ${note}` : ''}`
    })

    await notify(req.app.get('io'), {
      recipient: expense.user,
      sender: req.user._id,
      type: 'expense_decided',
      message: verdict === 'approved'
        ? `Your claim for ${rupees(expense.amount)} was approved — it comes with your next payslip`
        : `Your claim for ${rupees(expense.amount)} was not approved: ${note.slice(0, 60)}`,
      link: '/expenses'
    })

    res.json({ message: `${expense.userName}'s claim ${verdict}`, expense })
  } catch (err) {
    console.error('Decide expense error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = {
  uploadReceipt, myExpenses, claimExpense, cancelExpense, teamExpenses,
  approveExpense: decide('approved'), rejectExpense: decide('rejected')
}
