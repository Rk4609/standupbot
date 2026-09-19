const crypto = require('crypto')
const Letter = require('../models/Letter')
const User = require('../models/User')
const audit = require('../services/auditService')
const { notify, notifyMany } = require('../services/notifyService')
const { canUse } = require('../services/roleService')
const { settings } = require('../services/settingsService')
const { letterText } = require('../utils/letterText')
const { todayIn, zoneOf } = require('../utils/time')

const { paging, PAGE_SIZES } = require('../utils/paging')
const NEEDS_LAST_DAY = ['experience', 'relieving']
const same = (a, b) => a != null && b != null && String(a) === String(b)

/** Issuing is for admins holding letters; a salary figure needs pay as well. */
const mayIssue = async (user, type) => {
  if (user.role !== 'admin' || !(await canUse(user, 'letters'))) return false
  return type !== 'salary' || canUse(user, 'pay')
}

/** Eight letters and digits nobody guesses, printed as ABCD-EFGH. */
const newCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(8)
  const raw = Array.from(bytes, b => alphabet[b % alphabet.length]).join('')
  return `${raw.slice(0, 4)}-${raw.slice(4)}`
}

/** The person's details and wording, fixed into the letter, then numbered and saved. */
const issue = async (letter, { lastDay, actor }) => {
  const person = await User.findById(letter.user).select('name employment salary').lean()
  if (!person) return { error: [404, 'That person is no longer here'] }
  if (letter.type === 'salary' && !(person.salary?.amount > 0)) {
    return { error: [400, `${person.name} has no salary on record to put on a certificate`] }
  }
  if (NEEDS_LAST_DAY.includes(letter.type) && !lastDay) {
    return { error: [400, 'Give the last working day'] }
  }

  const company = { ...settings().company }
  const { title, body } = letterText({
    type: letter.type,
    person: {
      name: person.name,
      employeeId: person.employment?.employeeId,
      position: person.employment?.position,
      department: person.employment?.department,
      joinedOn: person.employment?.joinedOn
    },
    company,
    salary: person.salary,
    lastDay,
    purpose: letter.purpose
  })

  const today = todayIn(zoneOf(actor))
  const year = today.slice(0, 4)
  const prefix = `${company.letterPrefix || 'HR'}/${year}/`
  Object.assign(letter, {
    userName: person.name,
    status: 'issued',
    issuedOn: today,
    issuedBy: actor._id,
    issuedByName: actor.name,
    title,
    body,
    company: {
      name: company.name,
      address: company.address,
      email: company.email,
      phone: company.phone,
      signatory: company.signatory,
      signatoryTitle: company.signatoryTitle
    }
  })

  // Numbered in order within the year; two issued at once retry with the next
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const taken = await Letter.countDocuments({ number: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` } })
    letter.number = `${prefix}${String(taken + 1 + attempt).padStart(4, '0')}`
    letter.code = newCode()
    try {
      await letter.save()
      return { letter }
    } catch (err) {
      if (err.code !== 11000) throw err
    }
  }
  return { error: [409, 'Could not number the letter — try again'] }
}

// GET /api/letters/verify/:code — public: is this letter real?
const verifyLetter = async (req, res) => {
  try {
    const code = String(req.params.code || '').toUpperCase().trim()
    const letter = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)
      ? await Letter.findOne({ code, status: 'issued' }).select('number title userName issuedOn company.name').lean()
      : null
    if (!letter) return res.status(404).json({ valid: false, message: 'No letter has this code' })
    res.json({
      valid: true,
      number: letter.number,
      title: letter.title,
      name: letter.userName,
      issuedOn: letter.issuedOn,
      company: letter.company?.name || ''
    })
  } catch (err) {
    console.error('Verify letter error:', err.message)
    res.status(500).json({ message: 'Could not check that code' })
  }
}

// GET /api/letters/mine
const myLetters = async (req, res) => {
  try {
    const letters = await Letter.find({ user: req.user._id, status: { $ne: 'cancelled' } })
      .select('-body -company').sort({ createdAt: -1 }).limit(50).lean()
    res.json({ letters, types: Letter.TYPES })
  } catch (err) {
    console.error('My letters error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/letters/request — ask HR for one
const requestLetter = async (req, res) => {
  try {
    const { type, purpose, addressedTo } = req.body
    const open = await Letter.findOne({ user: req.user._id, type, status: 'requested' }).lean()
    if (open) return res.status(409).json({ message: 'You have already asked for this one — it is with HR' })

    const letter = await Letter.create({
      user: req.user._id,
      userName: req.user.name,
      type,
      purpose: purpose || '',
      addressedTo: addressedTo || '',
      requestedAt: new Date()
    })

    const admins = await User.find({ role: 'admin', _id: { $ne: req.user._id } }).select('_id').lean()
    await notifyMany(req.app.get('io'), admins.map(a => a._id), {
      sender: req.user._id,
      type: 'letter_requested',
      message: `${req.user.name} asked for a ${type} letter${purpose ? ` — ${purpose.slice(0, 60)}` : ''}`,
      link: '/workspace/letters'
    })

    res.status(201).json({ letter })
  } catch (err) {
    console.error('Request letter error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/letters/:id/cancel — take back a request not yet answered
const cancelRequest = async (req, res) => {
  try {
    const letter = await Letter.findOne({ _id: req.params.id, user: req.user._id })
    if (!letter) return res.status(404).json({ message: 'No such request' })
    if (letter.status !== 'requested') return res.status(400).json({ message: `It is already ${letter.status}` })
    letter.status = 'cancelled'
    await letter.save()
    res.json({ letter })
  } catch (err) {
    console.error('Cancel letter request error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/letters/:id — the owner, or an admin who may issue that kind
const getLetter = async (req, res) => {
  try {
    const letter = await Letter.findById(req.params.id).lean()
    if (!letter) return res.status(404).json({ message: 'No such letter' })
    if (!same(letter.user, req.user._id) && !(await mayIssue(req.user, letter.type))) {
      return res.status(403).json({ message: 'That letter is not yours' })
    }
    res.json({ letter })
  } catch (err) {
    console.error('Get letter error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/letters?status=&page= — requests waiting first
const listLetters = async (req, res) => {
  try {
    const filter = {}
    if (Letter.STATUSES.includes(req.query.status)) filter.status = req.query.status
    else filter.status = { $ne: 'cancelled' }
    // Without pay, salary certificates are not theirs to see
    if (!(await canUse(req.user, 'pay'))) filter.type = { $ne: 'salary' }
    const { page, limit, skip } = paging(req.query, 20)

    const [letters, total, waiting] = await Promise.all([
      Letter.find(filter).select('-body -company').sort({ status: -1, createdAt: -1 })
        .skip(skip).limit(limit).lean(),
      Letter.countDocuments(filter),
      Letter.countDocuments({ ...filter, status: 'requested' })
    ])
    res.json({
      letters,
      waiting,
      types: Letter.TYPES,
      canSalary: await canUse(req.user, 'pay'),
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      limit,
      pageSizes: PAGE_SIZES,
      total
    })
  } catch (err) {
    console.error('List letters error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/letters/people — who a letter can be issued to
const letterPeople = async (req, res) => {
  try {
    const people = await User.find().select('name employment.position').sort({ name: 1 }).lean()
    res.json({ people: people.map(p => ({ _id: p._id, name: p.name, position: p.employment?.position || '' })) })
  } catch (err) {
    console.error('Letter people error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

const tell = (req, letter) => notify(req.app.get('io'), {
  recipient: letter.user,
  sender: req.user._id,
  type: 'letter_issued',
  message: `Your ${letter.title.toLowerCase()} is ready — ${letter.number}`,
  link: `/letters/${letter._id}`
})

const record = (req, letter, action, note) => audit.record({
  action,
  actor: req.user,
  subject: { _id: letter.user, name: letter.userName },
  entityType: 'Letter',
  entityId: letter._id,
  note
})

// POST /api/letters — issue one directly
const issueLetter = async (req, res) => {
  try {
    const { user, type, purpose, addressedTo, lastDay } = req.body
    if (!(await mayIssue(req.user, type))) return res.status(403).json({ message: 'You cannot issue that kind of letter' })

    const letter = new Letter({ user, type, purpose: purpose || '', addressedTo: addressedTo || '' })
    const { error, letter: saved } = await issue(letter, { lastDay, actor: req.user })
    if (error) return res.status(error[0]).json({ message: error[1] })

    await record(req, saved, 'letter.issued', `${saved.number} · ${saved.title}`)
    await tell(req, saved)
    res.status(201).json({ letter: saved, message: `${saved.title} issued to ${saved.userName}` })
  } catch (err) {
    console.error('Issue letter error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/letters/:id/issue — answer a request with the letter
const issueRequested = async (req, res) => {
  try {
    const letter = await Letter.findById(req.params.id)
    if (!letter) return res.status(404).json({ message: 'No such request' })
    if (letter.status !== 'requested') return res.status(400).json({ message: `It is already ${letter.status}` })
    if (!(await mayIssue(req.user, letter.type))) return res.status(403).json({ message: 'You cannot issue that kind of letter' })
    if (same(letter.user, req.user._id)) return res.status(403).json({ message: 'Somebody else issues your own letters' })

    const { error, letter: saved } = await issue(letter, { lastDay: req.body.lastDay, actor: req.user })
    if (error) return res.status(error[0]).json({ message: error[1] })

    await record(req, saved, 'letter.issued', `${saved.number} · ${saved.title}`)
    await tell(req, saved)
    res.json({ letter: saved, message: `${saved.title} issued to ${saved.userName}` })
  } catch (err) {
    console.error('Issue requested letter error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/letters/:id/decline — with a reason
const declineLetter = async (req, res) => {
  try {
    const letter = await Letter.findById(req.params.id)
    if (!letter) return res.status(404).json({ message: 'No such request' })
    if (letter.status !== 'requested') return res.status(400).json({ message: `It is already ${letter.status}` })
    if (!(await mayIssue(req.user, letter.type))) return res.status(403).json({ message: 'You cannot answer that request' })

    letter.status = 'declined'
    letter.note = req.body.note
    await letter.save()

    await record(req, letter, 'letter.declined', `${letter.type} · ${letter.note}`)
    await notify(req.app.get('io'), {
      recipient: letter.user,
      sender: req.user._id,
      type: 'letter_issued',
      message: `Your request for a ${letter.type} letter was declined: ${letter.note.slice(0, 80)}`,
      link: '/documents'
    })
    res.json({ letter, message: 'Request declined' })
  } catch (err) {
    console.error('Decline letter error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = {
  verifyLetter, myLetters, requestLetter, cancelRequest, getLetter,
  listLetters, letterPeople, issueLetter, issueRequested, declineLetter
}
