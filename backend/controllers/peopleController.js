const User = require('../models/User')
const audit = require('../services/auditService')
const { canUse } = require('../services/roleService')
const { ownTeam } = require('../utils/teams')

const PAGE_SIZES = [10, 25, 50, 100]
const DEFAULT_LIMIT = 25

/** Everything but the parts nobody outside the account should ever read. */
const SAFE = '-password -resetPasswordToken -resetPasswordExpire'

/** The fields anybody with people records may write. */
const PERSONAL = ['name', 'phone', 'dob']
const ADDRESS = ['line1', 'city', 'state', 'pincode', 'country']
const EMPLOYMENT = [
  'employeeId', 'position', 'department', 'type',
  'joinedOn', 'startsOn', 'endsOn', 'experienceYears'
]

/**
 * An admin sees the whole workspace; a manager sees their own team.
 *
 * The same rule every other lead-facing screen follows, and the reason it is
 * not "everyone with the module": a records page that quietly widened who a
 * manager can read would be the most expensive mistake in the app.
 */
const scopeFor = async (user) => {
  if (user.role === 'admin') return {}

  const team = await ownTeam(user)
  if (!team) return null
  return { team }
}

const asDate = (value) => {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

// GET /api/people — the directory
const listPeople = async (req, res) => {
  try {
    const scope = await scopeFor(req.user)
    if (!scope) {
      return res.status(400).json({ message: 'You do not run a team yet' })
    }

    const maySeePay = await canUse(req.user, 'pay')

    const limit = PAGE_SIZES.includes(Number(req.query.limit))
      ? Number(req.query.limit)
      : DEFAULT_LIMIT
    const page = Math.max(1, Number(req.query.page) || 1)

    const filter = { ...scope }

    if (req.query.type) filter['employment.type'] = req.query.type
    if (req.query.role) filter.role = req.query.role
    if (req.query.team) filter.team = req.query.team

    const search = (req.query.search || '').trim()
    if (search) {
      // Escaped: a name with a bracket in it should search, not throw
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const rx = new RegExp(safe, 'i')
      filter.$or = [
        { name: rx },
        { email: rx },
        { 'employment.position': rx },
        { 'employment.employeeId': rx }
      ]
    }

    const total = await User.countDocuments(filter)
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const safePage = Math.min(page, totalPages)

    const people = await User.find(filter)
      .select(maySeePay ? SAFE : `${SAFE} -salary`)
      .populate('team', 'name')
      .sort({ name: 1 })
      .skip((safePage - 1) * limit)
      .limit(limit)
      .lean()

    // Who is on a clock: an internship or probation that ends inside a month
    const soon = new Date()
    soon.setDate(soon.getDate() + 30)

    const ending = await User.find({
      ...scope,
      'employment.type': { $in: ['intern', 'probation'] },
      'employment.endsOn': { $ne: null, $lte: soon }
    })
      .select('name employment.endsOn employment.type')
      .sort({ 'employment.endsOn': 1 })
      .limit(10)
      .lean()

    const teams = req.user.role === 'admin'
      ? await require('../models/Team').find().select('name').sort({ name: 1 }).lean()
      : []

    res.json({
      people,
      ending,
      teams,
      maySeePay,
      pageSizes: PAGE_SIZES,
      total,
      page: safePage,
      limit,
      totalPages
    })
  } catch (err) {
    console.error('List people error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

/** The record, if this reader is allowed it. */
const reachable = async (reader, id) => {
  const scope = await scopeFor(reader)
  if (!scope) return { error: 'You do not run a team yet', status: 400 }

  const person = await User.findOne({ _id: id, ...scope })
  if (!person) return { error: 'No such person', status: 404 }

  return { person }
}

// GET /api/people/:id
const getPerson = async (req, res) => {
  try {
    const { person, error, status } = await reachable(req.user, req.params.id)
    if (error) return res.status(status).json({ message: error })

    const maySeePay = await canUse(req.user, 'pay')
    const record = person.toObject()

    delete record.password
    delete record.resetPasswordToken
    delete record.resetPasswordExpire
    if (!maySeePay) delete record.salary

    res.json({ person: record, maySeePay })
  } catch (err) {
    console.error('Get person error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// PATCH /api/people/:id — the record, not the account
const updatePerson = async (req, res) => {
  try {
    const { person, error, status } = await reachable(req.user, req.params.id)
    if (error) return res.status(status).json({ message: error })

    const before = person.toObject()
    const changes = []

    const note = (field, from, to) => {
      const a = from === null || from === undefined ? '' : String(from)
      const b = to === null || to === undefined ? '' : String(to)
      if (a !== b) changes.push({ field, from: a, to: b })
    }

    for (const field of PERSONAL) {
      if (req.body[field] === undefined) continue
      const value = field === 'dob' ? asDate(req.body[field]) : req.body[field]
      note(field, before[field], value)
      person[field] = value
    }

    if (req.body.address) {
      for (const field of ADDRESS) {
        if (req.body.address[field] === undefined) continue
        note(`address.${field}`, before.address?.[field], req.body.address[field])
        person.address[field] = req.body.address[field]
      }
    }

    if (req.body.employment) {
      for (const field of EMPLOYMENT) {
        if (req.body.employment[field] === undefined) continue
        const raw = req.body.employment[field]
        const value = ['joinedOn', 'startsOn', 'endsOn'].includes(field) ? asDate(raw) : raw
        note(`employment.${field}`, before.employment?.[field], value)
        person.employment[field] = value
      }
    }

    // Pay is its own permission. A manager editing a record must not be able
    // to set a salary by sending the field anyway.
    if (req.body.salary !== undefined) {
      if (!(await canUse(req.user, 'pay'))) {
        return res.status(403).json({ message: 'Your role does not include pay details' })
      }
      for (const field of ['amount', 'currency', 'period', 'reviewedOn']) {
        if (req.body.salary[field] === undefined) continue
        const raw = req.body.salary[field]
        const value = field === 'reviewedOn' ? asDate(raw) : raw
        note(`salary.${field}`, before.salary?.[field], value)
        person.salary[field] = value
      }
    }

    if (changes.length === 0) {
      return res.json({ message: 'Nothing changed', person: person.toObject() })
    }

    await person.save()

    await audit.record({
      action: 'user.record_updated',
      actor: req.user,
      subject: person,
      team: person.team || null,
      entityType: 'User',
      entityId: person._id,
      // Pay is recorded as having moved, not as what it moved to: the audit
      // trail is readable by more people than the figure itself
      changes: changes.map(c => (
        c.field.startsWith('salary.') ? { field: c.field, from: '•••', to: '•••' } : c
      ))
    })

    const record = person.toObject()
    delete record.password
    if (!(await canUse(req.user, 'pay'))) delete record.salary

    res.json({ message: `${person.name}'s record updated`, person: record })
  } catch (err) {
    console.error('Update person error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = { listPeople, getPerson, updatePerson, PERSONAL, ADDRESS, EMPLOYMENT }
