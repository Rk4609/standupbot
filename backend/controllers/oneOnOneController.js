const OneOnOne = require('../models/OneOnOne')
const Team = require('../models/Team')
const User = require('../models/User')
const { notify } = require('../services/notifyService')
const { canUse } = require('../services/roleService')
const { todayIn, zoneOf } = require('../utils/time')

const same = (a, b) => a != null && b != null && String(a) === String(b)

/** Which side of this 1:1 the reader is on, or null. */
const sideOf = (meeting, user) =>
  same(meeting.manager, user._id) ? 'manager' : same(meeting.employee, user._id) ? 'employee' : null

/** The private note is the manager's alone. */
const shape = (meeting, side) => {
  const out = { ...meeting, side }
  if (side !== 'manager') delete out.privateNote
  return out
}

/** The people a manager holds 1:1s with: their teams, everybody for an admin. */
const peopleFor = async (user) => {
  if (!(await canUse(user, 'team-reviews'))) return []
  if (user.role === 'admin') {
    return User.find({ _id: { $ne: user._id } }).select('name').sort({ name: 1 }).lean()
  }
  if (user.role !== 'manager') return []
  const teams = await Team.find({ manager: user._id }).select('members').lean()
  const ids = teams.flatMap(t => t.members || []).filter(id => !same(id, user._id))
  return User.find({ _id: { $in: ids } }).select('name').sort({ name: 1 }).lean()
}

const load = async (req, res) => {
  const meeting = await OneOnOne.findById(req.params.id)
  if (!meeting) {
    res.status(404).json({ message: 'No such 1:1' })
    return {}
  }
  const side = sideOf(meeting, req.user)
  if (!side) {
    res.status(403).json({ message: 'That 1:1 is not yours' })
    return {}
  }
  return { meeting, side }
}

// GET /api/one-on-ones — mine, from either side, with whom I can hold one
const listOneOnOnes = async (req, res) => {
  try {
    const [rows, people] = await Promise.all([
      OneOnOne.find({ $or: [{ manager: req.user._id }, { employee: req.user._id }] })
        .sort({ date: -1, time: -1 }).limit(60).lean(),
      peopleFor(req.user)
    ])
    const today = todayIn(zoneOf(req.user))
    res.json({
      oneOnOnes: rows.map(r => shape(r, sideOf(r, req.user))),
      people,
      today
    })
  } catch (err) {
    console.error('List 1:1s error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/one-on-ones/:id
const getOneOnOne = async (req, res) => {
  try {
    const { meeting, side } = await load(req, res)
    if (!meeting) return
    res.json({ oneOnOne: shape(meeting.toObject(), side) })
  } catch (err) {
    console.error('Get 1:1 error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/one-on-ones — a manager books one; open actions from the last carry over
const scheduleOneOnOne = async (req, res) => {
  try {
    const { employee, date, time } = req.body
    const people = await peopleFor(req.user)
    const person = people.find(p => same(p._id, employee))
    if (!person) return res.status(403).json({ message: 'You hold 1:1s with your own team' })

    const last = await OneOnOne.findOne({ manager: req.user._id, employee }).sort({ date: -1 }).lean()
    const carried = (last?.items || [])
      .filter(i => i.kind === 'action' && !i.done)
      .map(i => ({ kind: 'action', text: i.text, by: i.by, owner: i.owner, carried: true }))

    const meeting = await OneOnOne.create({
      manager: req.user._id,
      managerName: req.user.name,
      employee,
      employeeName: person.name,
      date,
      time: time || '',
      items: carried
    })

    await notify(req.app.get('io'), {
      recipient: employee,
      sender: req.user._id,
      type: 'oneonone_scheduled',
      message: `${req.user.name} set up a 1:1 with you on ${date}${time ? ` at ${time}` : ''} — add what you want to talk about`,
      link: `/one-on-ones/${meeting._id}`
    })

    res.status(201).json({ oneOnOne: shape(meeting.toObject(), 'manager') })
  } catch (err) {
    console.error('Schedule 1:1 error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/one-on-ones/:id/items — a talking point or an action, from either side
const addItem = async (req, res) => {
  try {
    const { meeting, side } = await load(req, res)
    if (!meeting) return
    const { kind, text, owner } = req.body
    meeting.items.push({ kind, text, by: side, owner: kind === 'action' ? (owner || side) : '' })
    await meeting.save()
    res.status(201).json({ oneOnOne: shape(meeting.toObject(), side) })
  } catch (err) {
    console.error('Add 1:1 item error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// PATCH /api/one-on-ones/:id/items/:itemId — tick it off, or not
const toggleItem = async (req, res) => {
  try {
    const { meeting, side } = await load(req, res)
    if (!meeting) return
    const item = meeting.items.id(req.params.itemId)
    if (!item) return res.status(404).json({ message: 'No such item' })
    item.done = Boolean(req.body.done)
    await meeting.save()
    res.json({ oneOnOne: shape(meeting.toObject(), side) })
  } catch (err) {
    console.error('Toggle 1:1 item error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// DELETE /api/one-on-ones/:id/items/:itemId — whoever added it takes it back
const removeItem = async (req, res) => {
  try {
    const { meeting, side } = await load(req, res)
    if (!meeting) return
    const item = meeting.items.id(req.params.itemId)
    if (!item) return res.status(404).json({ message: 'No such item' })
    if (item.by !== side && side !== 'manager') return res.status(403).json({ message: 'Only who added it can remove it' })
    item.deleteOne()
    await meeting.save()
    res.json({ oneOnOne: shape(meeting.toObject(), side) })
  } catch (err) {
    console.error('Remove 1:1 item error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// PATCH /api/one-on-ones/:id — the manager's notes, and marking it held
const updateOneOnOne = async (req, res) => {
  try {
    const { meeting, side } = await load(req, res)
    if (!meeting) return
    if (side !== 'manager') return res.status(403).json({ message: 'The manager keeps the notes' })

    const { notes, privateNote, done, date, time } = req.body
    if (notes !== undefined) meeting.notes = notes
    if (privateNote !== undefined) meeting.privateNote = privateNote
    if (date !== undefined) meeting.date = date
    if (time !== undefined) meeting.time = time
    if (done !== undefined) {
      meeting.status = done ? 'done' : 'upcoming'
      meeting.doneAt = done ? new Date() : null
    }
    await meeting.save()
    res.json({ oneOnOne: shape(meeting.toObject(), side) })
  } catch (err) {
    console.error('Update 1:1 error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// DELETE /api/one-on-ones/:id — the manager calls off one not yet held
const cancelOneOnOne = async (req, res) => {
  try {
    const { meeting, side } = await load(req, res)
    if (!meeting) return
    if (side !== 'manager') return res.status(403).json({ message: 'Only the manager can call it off' })
    if (meeting.status === 'done') return res.status(400).json({ message: 'It has been held already' })
    await meeting.deleteOne()
    res.json({ message: '1:1 called off' })
  } catch (err) {
    console.error('Cancel 1:1 error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = {
  listOneOnOnes, getOneOnOne, scheduleOneOnOne, addItem, toggleItem, removeItem, updateOneOnOne, cancelOneOnOne
}
