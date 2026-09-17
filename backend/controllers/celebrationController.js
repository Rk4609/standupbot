const Notification = require('../models/Notification')
const Team = require('../models/Team')
const User = require('../models/User')
const { notify } = require('../services/notifyService')
const { ownTeam } = require('../utils/teams')
const { todayIn, zoneOf } = require('../utils/time')
const { upcomingCelebrations } = require('../utils/celebrations')

const WINDOW_DAYS = 7

/**
 * The people whose days this person sees: their own team (manager included),
 * or everybody for an admin. Themselves too — it is nice to see your own
 * birthday is known.
 */
const peopleFor = async (user) => {
  const fields = 'name avatar dob employment.joinedOn employment.position'
  if (user.role === 'admin') {
    return User.find({ role: { $in: ['employee', 'manager', 'admin'] } }).select(fields).lean()
  }
  const team = await ownTeam(user)
  if (!team) return User.find({ _id: user._id }).select(fields).lean()
  const row = await Team.findById(team).select('members manager').lean()
  const ids = [...(row?.members || []), row?.manager, user._id].filter(Boolean)
  return User.find({ _id: { $in: ids } }).select(fields).lean()
}

/** Wishes this person already sent today, so the button can say so. */
const wishedToday = async (user, today) => {
  const since = new Date(`${today}T00:00:00.000Z`)
  since.setUTCHours(since.getUTCHours() - 14) // the earliest any zone's today can start
  const rows = await Notification.find({
    sender: user._id,
    type: 'celebration_wish',
    createdAt: { $gte: since }
  }).select('recipient message').lean()
  return rows
}

// GET /api/celebrations — birthdays and anniversaries in the next week
const listCelebrations = async (req, res) => {
  try {
    const today = todayIn(zoneOf(req.user))
    const [people, sent] = await Promise.all([peopleFor(req.user), wishedToday(req.user, today)])

    const celebrations = upcomingCelebrations(people, today, WINDOW_DAYS).map(c => ({
      user: {
        _id: c.person._id,
        name: c.person.name,
        avatar: c.person.avatar || '',
        position: c.person.employment?.position || ''
      },
      kind: c.kind,
      // Day and month only: never the year somebody was born
      date: c.date,
      inDays: c.inDays,
      years: c.years,
      isMe: String(c.person._id) === String(req.user._id),
      wished: sent.some(n => String(n.recipient) === String(c.person._id) &&
        n.message.includes(c.kind === 'birthday' ? 'birthday' : 'anniversary'))
    }))

    res.json({ today, celebrations })
  } catch (err) {
    console.error('Celebrations error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/celebrations/wish — send a wish on the day
const sendWish = async (req, res) => {
  try {
    const { to, kind } = req.body
    const message = String(req.body.message || '').trim()
    const today = todayIn(zoneOf(req.user))

    if (String(to) === String(req.user._id)) {
      return res.status(400).json({ message: 'That one is for somebody else to send' })
    }

    const people = await peopleFor(req.user)
    const found = upcomingCelebrations(people, today, 0)
      .find(c => String(c.person._id) === String(to) && c.kind === kind)
    if (!found) {
      return res.status(400).json({ message: 'Wishes are sent on the day itself' })
    }

    const sent = await wishedToday(req.user, today)
    const word = kind === 'birthday' ? 'birthday' : 'anniversary'
    if (sent.some(n => String(n.recipient) === String(to) && n.message.includes(word))) {
      return res.status(409).json({ message: 'You already sent a wish today' })
    }

    const greeting = kind === 'birthday'
      ? `${req.user.name} wished you a happy birthday 🎂`
      : `${req.user.name} wished you a happy ${found.years}-year work anniversary 🎉`

    await notify(req.app.get('io'), {
      recipient: to,
      sender: req.user._id,
      type: 'celebration_wish',
      message: message ? `${greeting}: “${message.slice(0, 120)}”` : greeting,
      link: '/dashboard'
    })

    res.status(201).json({ message: `Wish sent to ${found.person.name}` })
  } catch (err) {
    console.error('Wish error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = { listCelebrations, sendWish, peopleFor }
