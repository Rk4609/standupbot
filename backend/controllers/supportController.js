const SupportTicket = require('../models/SupportTicket')
const User = require('../models/User')
const audit = require('../services/auditService')
const { notify, notifyMany } = require('../services/notifyService')
const { canUse } = require('../services/roleService')
const { ownTeam } = require('../utils/teams')
const { REQUESTABLE, REQUESTABLE_KEYS, labelOf, readField } = require('../utils/requestable')

const { STATUSES, CATEGORIES } = SupportTicket

const { ACCEPTED, PAGE_SIZES } = require('../utils/paging')
const DEFAULT_LIMIT = 20

/** Anyone may read their own; an admin reads everything. */
const canSeeAll = (user) => user.role === 'admin'

/** Who answers. Everyone of them hears about a new report. */
const answerers = async (exceptId) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id').lean()
    return admins.map(a => a._id).filter(id => String(id) !== String(exceptId))
  } catch (err) {
    console.error('Could not list the people who answer:', err.message)
    return []
  }
}

/** One line is all the bell has room for. */
const trim = (text, max = 60) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text

// POST /api/support — raise something
const createTicket = async (req, res) => {
  try {
    const { subject, body, category = 'other', kind = 'issue', request } = req.body

    let change = undefined
    if (kind === 'data-change') {
      if (!request?.field || !REQUESTABLE_KEYS.includes(request.field)) {
        return res.status(400).json({ message: 'That is not a field you can ask to change' })
      }
      if (!String(request.proposed || '').trim()) {
        return res.status(400).json({ message: 'Say what it should be instead' })
      }

      // Snapshot what it holds right now, so the thread still reads correctly
      // after somebody changes it
      const current = readField(req.user.toObject?.() || req.user, request.field)
      change = {
        field: request.field,
        current: current instanceof Date ? current.toISOString().slice(0, 10) : String(current || ''),
        proposed: String(request.proposed).trim()
      }
    }

    const ticket = await SupportTicket.create({
      user: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      team: await ownTeam(req.user),
      subject,
      body,
      category: kind === 'data-change' ? 'data' : category,
      kind,
      ...(change ? { request: change } : {})
    })

    // Before the response, so the bell is already right when the page
    // reloads behind the toast. Neither call throws — a notification that
    // fails must not lose somebody what they wrote.
    await notifyMany(req.app.get('io'), await answerers(req.user._id), {
      sender: req.user._id,
      type: 'support_raised',
      message: `${req.user.name} reported: ${trim(ticket.subject)}`,
      link: '/support'
    })

    res.status(201).json(ticket)
  } catch (err) {
    console.error('Create ticket error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/support/mine — what I have raised
const myTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    res.json({ tickets, categories: CATEGORIES, requestable: REQUESTABLE })
  } catch (err) {
    console.error('My tickets error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/support — everything, for whoever answers
const listTickets = async (req, res) => {
  try {
    if (!canSeeAll(req.user)) {
      return res.status(403).json({ message: 'Only an admin can read every ticket' })
    }

    const limit = ACCEPTED.includes(Number(req.query.limit))
      ? Number(req.query.limit)
      : DEFAULT_LIMIT
    const page = Math.max(1, Number(req.query.page) || 1)

    const filter = {}
    if (STATUSES.includes(req.query.status)) filter.status = req.query.status
    if (CATEGORIES.includes(req.query.category)) filter.category = req.query.category

    const total = await SupportTicket.countDocuments(filter)
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const safePage = Math.min(page, totalPages)

    /**
     * Open first, then answered, then closed.
     *
     * Sorting on the status field itself orders them alphabetically —
     * answered, closed, open — which puts the ones nobody has looked at
     * last, the exact opposite of what this list is for.
     */
    const tickets = await SupportTicket.aggregate([
      { $match: filter },
      {
        $addFields: {
          rank: {
            $switch: {
              branches: [
                { case: { $eq: ['$status', 'open'] }, then: 0 },
                { case: { $eq: ['$status', 'answered'] }, then: 1 }
              ],
              default: 2
            }
          }
        }
      },
      { $sort: { rank: 1, createdAt: -1 } },
      { $skip: (safePage - 1) * limit },
      { $limit: limit },
      { $project: { rank: 0 } }
    ])

    const openCount = await SupportTicket.countDocuments({ status: 'open' })

    res.json({
      tickets,
      openCount,
      statuses: STATUSES,
      categories: CATEGORIES,
      requestable: REQUESTABLE,
      pageSizes: PAGE_SIZES,
      total,
      page: safePage,
      limit,
      totalPages
    })
  } catch (err) {
    console.error('List tickets error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

/** The ticket, if this person is allowed to see it. */
const reachable = async (user, id) => {
  const ticket = await SupportTicket.findById(id)
  if (!ticket) return { error: 'Not found', status: 404 }

  if (!canSeeAll(user) && String(ticket.user) !== String(user._id)) {
    return { error: 'Not found', status: 404 }
  }
  return { ticket }
}

// POST /api/support/:id/reply — answer, or add to your own report
const replyToTicket = async (req, res) => {
  try {
    const { ticket, error, status } = await reachable(req.user, req.params.id)
    if (error) return res.status(status).json({ message: error })

    if (ticket.status === 'closed') {
      return res.status(400).json({ message: 'This one is closed. Raise a new ticket.' })
    }

    ticket.replies.push({
      author: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role,
      body: req.body.body
    })

    // Answered means somebody other than the reporter has spoken. A reporter
    // adding detail to their own report leaves it open, because it is.
    if (canSeeAll(req.user) && String(ticket.user) !== String(req.user._id)) {
      ticket.status = 'answered'
    }

    ticket.lastReplyAt = new Date()
    ticket.lastReplyBy = req.user.name

    await ticket.save()

    const io = req.app.get('io')
    const answering = canSeeAll(req.user) && String(ticket.user) !== String(req.user._id)

    if (answering) {
      await notify(io, {
        recipient: ticket.user,
        sender: req.user._id,
        type: 'support_replied',
        message: `${req.user.name} answered: ${trim(ticket.subject)}`,
        link: '/support'
      })
    } else {
      // The reporter added something. Whoever has to answer needs to know
      // there is more to read, not just that a ticket exists.
      await notifyMany(io, await answerers(req.user._id), {
        sender: req.user._id,
        type: 'support_raised',
        message: `${req.user.name} added to: ${trim(ticket.subject)}`,
        link: '/support'
      })
    }

    res.json(ticket)
  } catch (err) {
    console.error('Reply to ticket error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// PATCH /api/support/:id — close or reopen
const setStatus = async (req, res) => {
  try {
    if (!canSeeAll(req.user)) {
      return res.status(403).json({ message: 'Only an admin can change a ticket' })
    }

    const ticket = await SupportTicket.findById(req.params.id)
    if (!ticket) return res.status(404).json({ message: 'Not found' })

    const was = ticket.status
    ticket.status = req.body.status
    await ticket.save()

    if (was !== ticket.status && String(ticket.user) !== String(req.user._id)) {
      const settled = ticket.status === 'closed'
      await notify(req.app.get('io'), {
        recipient: ticket.user,
        sender: req.user._id,
        type: settled ? 'support_closed' : 'support_replied',
        message: settled
          ? `Closed: ${trim(ticket.subject)}`
          : `Reopened: ${trim(ticket.subject)}`,
        link: '/support'
      })
    }

    res.json(ticket)
  } catch (err) {
    console.error('Set ticket status error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/support/:id/apply — make the change they asked for
const applyRequest = async (req, res) => {
  try {
    if (!canSeeAll(req.user)) {
      return res.status(403).json({ message: 'Only an admin can apply a change' })
    }
    if (!(await canUse(req.user, 'records'))) {
      return res.status(403).json({ message: 'Your role does not include people records' })
    }

    const ticket = await SupportTicket.findById(req.params.id)
    if (!ticket) return res.status(404).json({ message: 'Not found' })

    if (ticket.kind !== 'data-change' || !ticket.request?.field) {
      return res.status(400).json({ message: 'This ticket does not ask for a change' })
    }
    if (ticket.request.appliedAt) {
      return res.status(400).json({ message: 'That change is already in' })
    }
    if (!REQUESTABLE_KEYS.includes(ticket.request.field)) {
      return res.status(400).json({ message: 'That field cannot be changed from here' })
    }

    const person = await User.findById(ticket.user)
    if (!person) return res.status(404).json({ message: 'That account is gone' })

    const { field, proposed } = ticket.request
    const before = readField(person.toObject(), field)

    // A date field is stored as a date, whatever the form sent
    const value = field === 'dob' ? new Date(proposed) : proposed
    if (field === 'dob' && Number.isNaN(value.getTime())) {
      return res.status(400).json({ message: 'That is not a date' })
    }

    person.set(field, value)
    await person.save()

    ticket.request.appliedAt = new Date()
    ticket.request.appliedBy = req.user.name
    ticket.replies.push({
      author: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role,
      body: `Done — ${labelOf(field)} is now “${proposed}”.`
    })
    ticket.status = 'answered'
    ticket.lastReplyAt = new Date()
    ticket.lastReplyBy = req.user.name
    await ticket.save()

    await audit.record({
      action: 'user.record_updated',
      actor: req.user,
      subject: person,
      team: person.team || null,
      entityType: 'User',
      entityId: person._id,
      note: 'Asked for through help & support',
      changes: [{
        field,
        from: before instanceof Date ? before.toISOString().slice(0, 10) : String(before || ''),
        to: proposed
      }]
    })

    await notify(req.app.get('io'), {
      recipient: person._id,
      sender: req.user._id,
      type: 'support_replied',
      message: `${labelOf(field)} updated as you asked`,
      link: '/support'
    })

    res.json(ticket)
  } catch (err) {
    console.error('Apply request error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = {
  createTicket, myTickets, listTickets, replyToTicket, setStatus, applyRequest
}
