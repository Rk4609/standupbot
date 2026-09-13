const SupportTicket = require('../models/SupportTicket')
const User = require('../models/User')
const { notify, notifyMany } = require('../services/notifyService')
const { ownTeam } = require('../utils/teams')

const { STATUSES, CATEGORIES } = SupportTicket

const PAGE_SIZES = [10, 20, 50]
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
    const { subject, body, category = 'other' } = req.body

    const ticket = await SupportTicket.create({
      user: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      team: await ownTeam(req.user),
      subject,
      body,
      category
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

    res.json({ tickets, categories: CATEGORIES })
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

    const limit = PAGE_SIZES.includes(Number(req.query.limit))
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

module.exports = { createTicket, myTickets, listTickets, replyToTicket, setStatus }
