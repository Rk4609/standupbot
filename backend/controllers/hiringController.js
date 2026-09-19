const crypto = require('crypto')
const Candidate = require('../models/Candidate')
const Team = require('../models/Team')
const User = require('../models/User')
const audit = require('../services/auditService')
const { notify, notifyMany } = require('../services/notifyService')
const { canUse } = require('../services/roleService')
const { sendMail } = require('../services/emailService')
const { ownTeam } = require('../utils/teams')
const { startOnboarding } = require('../services/onboardingService')

const { ACCEPTED, PAGE_SIZES } = require('../utils/paging')
const DEFAULT_LIMIT = 20

const isAdmin = (user) => user.role === 'admin'

/** Everyone who decides. */
const approvers = async (exceptId) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id').lean()
    return admins.map(a => a._id).filter(id => String(id) !== String(exceptId))
  } catch (err) {
    console.error('Could not list approvers:', err.message)
    return []
  }
}

const asDate = (value) => {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Strip the figure from a copy of the row for somebody without pay. */
const forReader = (row, maySeePay) => {
  if (maySeePay) return row
  const copy = { ...row }
  delete copy.expectedSalary
  return copy
}

/**
 * A password somebody can be told once and change immediately.
 *
 * Not emailed from here on its own: the account is created with it, and the
 * admin sees it once in the response, because a new joiner standing next to
 * you is the common case and waiting on a mail server is not.
 */
const tempPassword = () =>
  `${crypto.randomBytes(4).toString('hex')}-${crypto.randomBytes(2).toString('hex')}`

// POST /api/hiring — a manager puts somebody forward
const submitCandidate = async (req, res) => {
  try {
    const body = req.body

    const taken = await User.findOne({ email: body.email.toLowerCase() }).select('_id').lean()
    if (taken) {
      return res.status(409).json({ message: 'Somebody already has that email here' })
    }

    const waiting = await Candidate.findOne({
      email: body.email.toLowerCase(),
      status: 'pending'
    }).select('_id').lean()
    if (waiting) {
      return res.status(409).json({ message: 'That candidate is already waiting for a decision' })
    }

    // A manager hires onto their own team unless an admin says otherwise
    const team = isAdmin(req.user)
      ? (body.team || null)
      : (body.team && String(body.team) === String(await ownTeam(req.user))
          ? body.team
          : await ownTeam(req.user))

    const maySeePay = await canUse(req.user, 'pay')

    const candidate = await Candidate.create({
      name: body.name,
      email: body.email.toLowerCase(),
      phone: body.phone || '',
      dob: asDate(body.dob),
      address: body.address || {},
      position: body.position,
      department: body.department || '',
      team,
      type: body.type || 'full-time',
      joiningOn: asDate(body.joiningOn),
      startsOn: asDate(body.startsOn),
      endsOn: asDate(body.endsOn),
      experienceYears: body.experienceYears || 0,
      // A manager who cannot see pay cannot propose one either
      expectedSalary: maySeePay && body.expectedSalary ? body.expectedSalary : undefined,
      cv: body.cv || {},
      notes: body.notes || '',
      submittedBy: req.user._id,
      submittedByName: req.user.name
    })

    await audit.record({
      action: 'hiring.submitted',
      actor: req.user,
      team: team || null,
      entityType: 'Candidate',
      entityId: candidate._id,
      note: `${candidate.name} · ${candidate.position}`
    })

    await notifyMany(req.app.get('io'), await approvers(req.user._id), {
      sender: req.user._id,
      type: 'hiring_submitted',
      message: `${req.user.name} put ${candidate.name} forward for ${candidate.position}`,
      link: '/workspace/approvals'
    })

    res.status(201).json(candidate)
  } catch (err) {
    console.error('Submit candidate error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/hiring — what is waiting, and what was decided
const listCandidates = async (req, res) => {
  try {
    const decider = await canUse(req.user, 'approvals')
    const maySeePay = await canUse(req.user, 'pay')

    // Somebody who decides sees every submission; a manager sees their own
    const scope = decider && isAdmin(req.user) ? {} : { submittedBy: req.user._id }

    const limit = ACCEPTED.includes(Number(req.query.limit))
      ? Number(req.query.limit)
      : DEFAULT_LIMIT
    const page = Math.max(1, Number(req.query.page) || 1)

    const filter = { ...scope }
    if (Candidate.STATUSES.includes(req.query.status)) filter.status = req.query.status

    const total = await Candidate.countDocuments(filter)
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const safePage = Math.min(page, totalPages)

    const rows = await Candidate.find(filter)
      .populate('team', 'name')
      .populate('createdUser', 'name email')
      // Waiting first whatever else is on the list: a decided row is history
      .sort({ status: 1, createdAt: -1 })
      .skip((safePage - 1) * limit)
      .limit(limit)
      .lean()

    const [pendingCount, teams] = await Promise.all([
      Candidate.countDocuments({ ...scope, status: 'pending' }),
      isAdmin(req.user)
        ? Team.find().select('name').sort({ name: 1 }).lean()
        : Team.find({ manager: req.user._id }).select('name').lean()
    ])

    res.json({
      candidates: rows.map(r => forReader(r, maySeePay)),
      pendingCount,
      teams,
      statuses: Candidate.STATUSES,
      types: Candidate.TYPES,
      canDecide: decider && isAdmin(req.user),
      maySeePay,
      pageSizes: PAGE_SIZES,
      total,
      page: safePage,
      limit,
      totalPages
    })
  } catch (err) {
    console.error('List candidates error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

/** Only an admin holding the approvals module decides. */
const mayDecide = async (user) => isAdmin(user) && await canUse(user, 'approvals')

// POST /api/hiring/:id/approve — say yes, and make the account
const approveCandidate = async (req, res) => {
  try {
    if (!(await mayDecide(req.user))) {
      return res.status(403).json({ message: 'Only an admin with approvals can decide this' })
    }

    const candidate = await Candidate.findById(req.params.id)
    if (!candidate) return res.status(404).json({ message: 'No such candidate' })
    if (candidate.status !== 'pending') {
      return res.status(400).json({ message: `That one is already ${candidate.status}` })
    }

    // Between submission and approval, somebody may have signed up
    const taken = await User.findOne({ email: candidate.email }).select('_id').lean()
    if (taken) {
      return res.status(409).json({ message: 'An account with that email already exists' })
    }

    const password = tempPassword()
    const maySeePay = await canUse(req.user, 'pay')

    const user = await User.create({
      name: candidate.name,
      email: candidate.email,
      password,
      role: 'employee',
      team: candidate.team || null,
      phone: candidate.phone,
      dob: candidate.dob,
      address: candidate.address,
      employment: {
        position: candidate.position,
        department: candidate.department,
        type: candidate.type,
        joinedOn: candidate.joiningOn,
        startsOn: candidate.startsOn,
        endsOn: candidate.endsOn,
        experienceYears: candidate.experienceYears
      },
      // Only carried over by somebody who is allowed to read it in the first
      // place; otherwise the record starts blank and pay is set later
      salary: maySeePay && candidate.expectedSalary?.amount
        ? {
            amount: candidate.expectedSalary.amount,
            currency: candidate.expectedSalary.currency,
            period: candidate.expectedSalary.period,
            reviewedOn: new Date()
          }
        : undefined
    })

    if (candidate.team) {
      await Team.updateOne({ _id: candidate.team }, { $addToSet: { members: user._id } })
    }

    candidate.status = 'approved'
    candidate.decidedBy = req.user._id
    candidate.decidedByName = req.user.name
    candidate.decidedAt = new Date()
    candidate.reason = req.body.reason || ''
    candidate.createdUser = user._id
    await candidate.save()

    // Their first-weeks checklist, from the day they join. Best effort: the
    // account exists either way, and a checklist can be started by hand.
    try {
      await startOnboarding({
        io: req.app.get('io'),
        user,
        startsOn: (candidate.joiningOn || new Date()).toISOString().slice(0, 10),
        actor: req.user,
        candidate: candidate._id
      })
    } catch (err) {
      console.error('Could not start onboarding:', err.message)
    }

    await audit.record({
      action: 'hiring.approved',
      actor: req.user,
      subject: user,
      team: candidate.team || null,
      entityType: 'Candidate',
      entityId: candidate._id,
      note: `${candidate.position} · account created`
    })

    await notify(req.app.get('io'), {
      recipient: candidate.submittedBy,
      sender: req.user._id,
      type: 'hiring_decided',
      message: `${candidate.name} approved — the account is ready`,
      link: '/workspace/hiring'
    })

    // Best effort: the temporary password is in the response either way
    sendMail({
      to: candidate.email,
      subject: 'Your StandupBot account is ready',
      html: `<p>Hello ${candidate.name},</p>
        <p>Your account is set up. Sign in with <strong>${candidate.email}</strong>
        and the temporary password <strong>${password}</strong>, then change it
        from your profile.</p>`
    }).catch(err => console.error('Welcome mail failed:', err.message))

    res.json({
      message: `${candidate.name} approved — account created`,
      candidate,
      account: { _id: user._id, email: user.email, tempPassword: password }
    })
  } catch (err) {
    console.error('Approve candidate error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/hiring/:id/reject — say no, and say why
const rejectCandidate = async (req, res) => {
  try {
    if (!(await mayDecide(req.user))) {
      return res.status(403).json({ message: 'Only an admin with approvals can decide this' })
    }

    const reason = String(req.body.reason || '').trim()
    if (reason.length < 3) {
      return res.status(400).json({ message: 'Say why — the manager has to act on this' })
    }

    const candidate = await Candidate.findById(req.params.id)
    if (!candidate) return res.status(404).json({ message: 'No such candidate' })
    if (candidate.status !== 'pending') {
      return res.status(400).json({ message: `That one is already ${candidate.status}` })
    }

    candidate.status = 'rejected'
    candidate.decidedBy = req.user._id
    candidate.decidedByName = req.user.name
    candidate.decidedAt = new Date()
    candidate.reason = reason
    await candidate.save()

    await audit.record({
      action: 'hiring.rejected',
      actor: req.user,
      team: candidate.team || null,
      entityType: 'Candidate',
      entityId: candidate._id,
      note: `${candidate.name} · ${reason}`
    })

    await notify(req.app.get('io'), {
      recipient: candidate.submittedBy,
      sender: req.user._id,
      type: 'hiring_decided',
      message: `${candidate.name} was not approved: ${reason.slice(0, 60)}`,
      link: '/workspace/hiring'
    })

    res.json({ message: `${candidate.name} rejected`, candidate })
  } catch (err) {
    console.error('Reject candidate error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// DELETE /api/hiring/:id — withdraw one that has not been decided
const withdrawCandidate = async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id)
    if (!candidate) return res.status(404).json({ message: 'No such candidate' })

    const mine = String(candidate.submittedBy) === String(req.user._id)
    if (!mine && !(await mayDecide(req.user))) {
      return res.status(403).json({ message: 'That is not yours to withdraw' })
    }
    if (candidate.status !== 'pending') {
      return res.status(400).json({ message: 'That one has already been decided' })
    }

    await candidate.deleteOne()
    res.json({ message: `${candidate.name} withdrawn` })
  } catch (err) {
    console.error('Withdraw candidate error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = {
  submitCandidate, listCandidates, approveCandidate, rejectCandidate, withdrawCandidate
}
