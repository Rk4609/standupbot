const mongoose = require('mongoose')
const Onboarding = require('../models/Onboarding')
const Team = require('../models/Team')
const User = require('../models/User')
const { notify } = require('../services/notifyService')
const { startOnboarding } = require('../services/onboardingService')
const { canUse } = require('../services/roleService')
const { todayIn, zoneOf } = require('../utils/time')

const isAdmin = (user) => user.role === 'admin'

/** Teams this person leads. */
const ledTeams = async (user) =>
  (await Team.find({ manager: user._id }).select('_id').lean()).map(t => String(t._id))

/**
 * What this person may do with one checklist.
 *
 * An admin does everything. The joiner's manager (holding the onboarding
 * module) ticks their own and the joiner's tasks and edits the list. The
 * joiner ticks their own tasks. Nobody else sees it at all.
 */
const rightsOver = async (viewer, onboarding) => {
  const self = String(onboarding.user) === String(viewer._id)
  const admin = isAdmin(viewer)
  const lead = !admin && viewer.role === 'manager' &&
    onboarding.team && (await ledTeams(viewer)).includes(String(onboarding.team)) &&
    await canUse(viewer, 'onboarding')

  const ticks = new Set([
    ...(admin ? ['hr', 'manager', 'employee'] : []),
    ...(lead ? ['manager', 'employee'] : []),
    ...(self ? ['employee'] : [])
  ])

  return { see: self || admin || lead, edit: admin || lead, ticks }
}

/** The checklist as a reader sees it: progress, what is late, and what they may tick. */
const present = (onboarding, rights, today) => {
  const row = onboarding.toObject ? onboarding.toObject() : onboarding
  const tasks = row.tasks.map(task => ({
    ...task,
    overdue: !task.done && task.dueOn < today,
    canTick: rights.ticks.has(task.owner)
  }))
  const done = tasks.filter(t => t.done).length

  return {
    ...row,
    tasks,
    progress: {
      done,
      total: tasks.length,
      percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      overdue: tasks.filter(t => t.overdue).length
    },
    canEdit: rights.edit
  }
}

const found = async (req, res) => {
  const onboarding = await Onboarding.findById(req.params.id)
  const rights = onboarding ? await rightsOver(req.user, onboarding) : null
  if (!onboarding || !rights.see) {
    res.status(404).json({ message: 'No such checklist' })
    return null
  }
  return { onboarding, rights }
}

/** Finished when every task is; reopened if one is unticked again. */
const settle = async (req, onboarding) => {
  const allDone = onboarding.tasks.length > 0 && onboarding.tasks.every(t => t.done)

  if (allDone && onboarding.status !== 'complete') {
    onboarding.status = 'complete'
    onboarding.completedAt = new Date()
    await onboarding.save()

    const lead = onboarding.team ? (await Team.findById(onboarding.team).select('manager').lean())?.manager : null
    const recipients = [onboarding.user, lead].filter(id => id && String(id) !== String(req.user._id))
    await Promise.all(recipients.map(recipient => notify(req.app.get('io'), {
      recipient,
      sender: req.user._id,
      type: 'onboarding_complete',
      message: String(recipient) === String(onboarding.user)
        ? 'Your onboarding is complete — welcome to the team'
        : `${onboarding.userName}'s onboarding is complete`,
      link: `/onboarding/${onboarding._id}`
    })))
  } else if (!allDone && onboarding.status === 'complete') {
    onboarding.status = 'active'
    onboarding.completedAt = null
    await onboarding.save()
  }
}

// GET /api/onboarding/mine — my own checklist, if I have one
const myOnboarding = async (req, res) => {
  try {
    const onboarding = await Onboarding.findOne({ user: req.user._id })
    if (!onboarding) return res.json({ onboarding: null })
    const rights = await rightsOver(req.user, onboarding)
    res.json({ onboarding: present(onboarding, rights, todayIn(zoneOf(req.user))) })
  } catch (err) {
    console.error('My onboarding error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/onboarding?status=active|complete — everybody I onboard
const listOnboarding = async (req, res) => {
  try {
    const today = todayIn(zoneOf(req.user))
    const status = ['active', 'complete'].includes(req.query.status) ? req.query.status : 'active'

    const teams = isAdmin(req.user) ? null : await ledTeams(req.user)
    // As ObjectIds: the aggregate below does not cast strings the way find does
    const scope = teams ? { team: { $in: teams.map(id => new mongoose.Types.ObjectId(id)) } } : {}

    const [rows, counts, already] = await Promise.all([
      Onboarding.find({ ...scope, status }).populate('team', 'name').sort({ startsOn: -1 }).lean(),
      Onboarding.aggregate([{ $match: scope }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      Onboarding.find(scope).select('user').lean()
    ])

    // Who could be started by hand: people in scope without a checklist,
    // most recent joiners first
    const has = new Set(already.map(o => String(o.user)))
    const peopleFilter = teams
      ? { team: { $in: teams } }
      : { role: { $in: ['employee', 'manager'] } }
    const candidates = (await User.find(peopleFilter)
      .select('name employment.position employment.joinedOn')
      .sort({ 'employment.joinedOn': -1, createdAt: -1 })
      .limit(200)
      .lean())
      .filter(p => !has.has(String(p._id)) && String(p._id) !== String(req.user._id))

    const rights = { see: true, edit: true, ticks: new Set(isAdmin(req.user) ? ['hr', 'manager', 'employee'] : ['manager', 'employee']) }

    res.json({
      status,
      today,
      onboardings: rows.map(row => {
        const shown = present(row, rights, today)
        const next = shown.tasks.filter(t => !t.done).sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0] || null
        return {
          _id: row._id,
          user: row.user,
          userName: row.userName,
          position: row.position,
          team: row.team?.name || '',
          startsOn: row.startsOn,
          status: row.status,
          completedAt: row.completedAt,
          progress: shown.progress,
          next: next ? { title: next.title, owner: next.owner, dueOn: next.dueOn, overdue: next.overdue } : null
        }
      }),
      counts: {
        active: counts.find(c => c._id === 'active')?.n || 0,
        complete: counts.find(c => c._id === 'complete')?.n || 0
      },
      people: candidates.slice(0, 50).map(p => ({
        _id: p._id,
        name: p.name,
        position: p.employment?.position || '',
        joinedOn: p.employment?.joinedOn || null
      }))
    })
  } catch (err) {
    console.error('List onboarding error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/onboarding/:id
const getOnboarding = async (req, res) => {
  try {
    const hit = await found(req, res)
    if (!hit) return
    res.json({ onboarding: present(hit.onboarding, hit.rights, todayIn(zoneOf(req.user))) })
  } catch (err) {
    console.error('Get onboarding error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/onboarding — start a checklist for somebody already here
const createOnboarding = async (req, res) => {
  try {
    const person = await User.findById(req.body.user).select('name team employment role')
    if (!person) return res.status(404).json({ message: 'No such person' })
    if (String(person._id) === String(req.user._id)) {
      return res.status(403).json({ message: 'Somebody else has to onboard you' })
    }

    if (!isAdmin(req.user)) {
      const teams = await ledTeams(req.user)
      const theirTeam = person.team || (await Team.findOne({ manager: person._id }).select('_id').lean())?._id
      if (!theirTeam || !teams.includes(String(theirTeam))) {
        return res.status(403).json({ message: 'That person is not on a team you lead' })
      }
    }

    if (await Onboarding.exists({ user: person._id })) {
      return res.status(409).json({ message: `${person.name} already has a checklist` })
    }

    const joined = person.employment?.joinedOn
      ? new Date(person.employment.joinedOn).toISOString().slice(0, 10)
      : null
    const startsOn = req.body.startsOn || joined || todayIn(zoneOf(req.user))

    const { onboarding } = await startOnboarding({
      io: req.app.get('io'),
      user: person,
      startsOn,
      actor: req.user
    })

    const rights = await rightsOver(req.user, onboarding)
    res.status(201).json({
      message: `Onboarding started for ${person.name}`,
      onboarding: present(onboarding, rights, todayIn(zoneOf(req.user)))
    })
  } catch (err) {
    console.error('Create onboarding error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// PATCH /api/onboarding/:id/tasks/:taskId — tick, untick, or leave a note
const updateTask = async (req, res) => {
  try {
    const hit = await found(req, res)
    if (!hit) return
    const { onboarding, rights } = hit

    const task = onboarding.tasks.id(req.params.taskId)
    if (!task) return res.status(404).json({ message: 'No such task' })
    if (!rights.ticks.has(task.owner)) {
      return res.status(403).json({ message: 'That task is somebody else\'s to tick' })
    }

    if (typeof req.body.done === 'boolean' && req.body.done !== task.done) {
      task.done = req.body.done
      task.doneBy = req.body.done ? req.user._id : null
      task.doneByName = req.body.done ? req.user.name : ''
      task.doneAt = req.body.done ? new Date() : null
    }
    if (typeof req.body.note === 'string') task.note = req.body.note

    await onboarding.save()
    await settle(req, onboarding)

    res.json({ onboarding: present(onboarding, rights, todayIn(zoneOf(req.user))) })
  } catch (err) {
    console.error('Update onboarding task error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/onboarding/:id/tasks — add a task this person's joining needs
const addTask = async (req, res) => {
  try {
    const hit = await found(req, res)
    if (!hit) return
    const { onboarding, rights } = hit
    if (!rights.edit) return res.status(403).json({ message: 'Only their manager or an admin can change the list' })

    onboarding.tasks.push({ title: req.body.title, owner: req.body.owner, dueOn: req.body.dueOn })
    await onboarding.save()
    await settle(req, onboarding)

    res.status(201).json({ onboarding: present(onboarding, rights, todayIn(zoneOf(req.user))) })
  } catch (err) {
    console.error('Add onboarding task error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// DELETE /api/onboarding/:id/tasks/:taskId — a task that does not apply
const removeTask = async (req, res) => {
  try {
    const hit = await found(req, res)
    if (!hit) return
    const { onboarding, rights } = hit
    if (!rights.edit) return res.status(403).json({ message: 'Only their manager or an admin can change the list' })

    const task = onboarding.tasks.id(req.params.taskId)
    if (!task) return res.status(404).json({ message: 'No such task' })
    task.deleteOne()
    await onboarding.save()
    await settle(req, onboarding)

    res.json({ onboarding: present(onboarding, rights, todayIn(zoneOf(req.user))) })
  } catch (err) {
    console.error('Remove onboarding task error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = {
  myOnboarding, listOnboarding, getOnboarding, createOnboarding, updateTask, addTask, removeTask
}
