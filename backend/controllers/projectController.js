const Project = require('../models/Project')
const Standup = require('../models/Standup')
const Team = require('../models/Team')
const User = require('../models/User')
const { ownTeam } = require('../utils/teams')
const { lastNDates, todayIn, zoneOf } = require('../utils/time')
const audit = require('../services/auditService')

/** The team a lead owns, or every team for an admin. */
const leadTeam = async (user) => {
  if (user.role === 'admin') return { admin: true }

  const team = await Team.findOne({ manager: user._id }).select('_id')
  if (!team) return { error: 'You are not managing any team!' }
  return { team: team._id }
}

/**
 * What this person may book time against.
 *
 * A project with named members belongs to those people. One with none is
 * open to its whole team, which is how every project behaved before anyone
 * could be assigned — so naming members on one project does not quietly
 * lock everybody out of the rest.
 *
 * Shared projects — internal work, leave, training — belong to nobody's team
 * and are always bookable, or a week never adds up to a full week.
 */
const bookableFilter = (userId, teamId) => ({
  active: true,
  $or: [
    { team: null },
    ...(teamId
      ? [{
          team: teamId,
          $or: [{ members: { $size: 0 } }, { members: userId }]
        }]
      : []),
    // Assigned to it from another team: the assignment is the decision
    { members: userId }
  ]
})

// GET /api/projects — what I can book against
const listProjects = async (req, res) => {
  try {
    const projects = await Project.find(bookableFilter(req.user._id, req.user.team))
      .select('name code client billable team')
      .sort({ name: 1 })
      .lean()

    res.json(projects)
  } catch (err) {
    console.error('List projects error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/projects/all — the catalogue a lead maintains, archived included
const listAllProjects = async (req, res) => {
  try {
    const scope = await leadTeam(req.user)
    if (scope.error) return res.status(400).json({ message: scope.error })

    const filter = scope.admin
      ? {}
      : { $or: [{ team: null }, { team: scope.team }] }

    const projects = await Project.find(filter)
      .populate('team', 'name')
      .populate('members', 'name email avatar')
      .sort({ active: -1, name: 1 })
      .lean()

    // An admin can put a project on any team, so they need the list to
    // choose from. A manager has one and is not offered a choice.
    const teams = scope.admin
      ? await Team.find().select('name').sort({ name: 1 }).lean()
      : []
    const defaultTeam = scope.admin ? await ownTeam(req.user) : scope.team

    // Everyone this lead could put on a project, so the picker has options
    // without a second round trip
    const assignable = await User.find(
      scope.admin ? { role: { $ne: 'admin' } } : { team: scope.team }
    )
      .select('name email avatar team')
      .sort({ name: 1 })
      .lean()

    // How much has been booked to each, so a lead can see what is actually
    // in use before archiving something
    const usage = await Standup.aggregate([
      { $unwind: '$work' },
      { $group: { _id: '$work.project', hours: { $sum: '$work.hours' }, entries: { $sum: 1 } } }
    ])
    const usageBy = new Map(usage.map(u => [String(u._id), u]))

    res.json({
      projects: projects.map(p => ({
        ...p,
        hours: Number((usageBy.get(String(p._id))?.hours || 0).toFixed(2)),
        entries: usageBy.get(String(p._id))?.entries || 0
      })),
      teams,
      assignable,
      defaultTeam: defaultTeam ? String(defaultTeam) : null,
      canShare: Boolean(scope.admin)
    })
  } catch (err) {
    console.error('List all projects error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/projects
const createProject = async (req, res) => {
  try {
    const scope = await leadTeam(req.user)
    if (scope.error) return res.status(400).json({ message: scope.error })

    const { name, code = '', client = '', billable = true, team } = req.body

    // A manager cannot create a project for somebody else's team, and cannot
    // create a shared one — shared projects affect every team, so they are an
    // admin's call
    if (!scope.admin && team && String(team) !== String(scope.team)) {
      return res.status(400).json({ message: 'That team is not yours' })
    }

    // `team: null` asks for a shared project; leaving it out means "mine".
    // Defaulting an admin to shared made every client project visible to
    // every team, which is the opposite of what naming a client implies.
    let owner
    if (!scope.admin) owner = scope.team
    else if (team !== undefined) owner = team
    else owner = await ownTeam(req.user)

    const project = await Project.create({
      name,
      code,
      client,
      billable,
      team: owner,
      createdBy: req.user._id
    })

    res.status(201).json(project)
  } catch (err) {
    console.error('Create project error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// PATCH /api/projects/:id
const updateProject = async (req, res) => {
  try {
    const scope = await leadTeam(req.user)
    if (scope.error) return res.status(400).json({ message: scope.error })

    const project = await Project.findById(req.params.id)
    if (!project) return res.status(404).json({ message: 'Project not found' })

    if (!scope.admin) {
      // A manager owns their team's projects; the shared ones are an admin's
      if (!project.team || String(project.team) !== String(scope.team)) {
        return res.status(403).json({ message: 'That project is not yours' })
      }
    }

    for (const field of ['name', 'code', 'client', 'billable', 'active']) {
      if (req.body[field] !== undefined) project[field] = req.body[field]
    }

    await project.save()
    res.json(project)
  } catch (err) {
    console.error('Update project error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

/** The project this lead is allowed to change, or an explanation. */
const ownedProject = async (user, id) => {
  const project = await Project.findById(id)
  if (!project) return { error: 'Project not found', status: 404 }

  if (user.role === 'admin') return { project }

  const team = await Team.findOne({ manager: user._id }).select('_id')
  if (!team) return { error: 'You are not managing any team!', status: 400 }

  if (!project.team || String(project.team) !== String(team._id)) {
    return { error: 'That project is not yours', status: 403 }
  }
  return { project, team: team._id }
}

/** Who this lead may put on a project: their own team, or anyone for an admin. */
const assignableTo = async (user, project) => {
  if (user.role === 'admin') return {}
  return { team: project.team }
}

// PATCH /api/projects/:id/members — put people on a project or take them off
const updateMembers = async (req, res) => {
  try {
    const { project, error, status } = await ownedProject(req.user, req.params.id)
    if (error) return res.status(status).json({ message: error })

    const { add = [], remove = [] } = req.body

    if (add.length > 0) {
      // Only people this lead is responsible for, so a manager cannot quietly
      // put another team's employee on their project
      const allowed = await User.find({
        _id: { $in: add },
        ...(await assignableTo(req.user, project))
      }).select('_id').lean()

      if (allowed.length !== add.length) {
        return res.status(400).json({ message: 'Some of those people are not on this team' })
      }

      for (const u of allowed) {
        if (!project.members.some(m => String(m) === String(u._id))) {
          project.members.push(u._id)
        }
      }
    }

    if (remove.length > 0) {
      const removing = new Set(remove.map(String))
      project.members = project.members.filter(m => !removing.has(String(m)))
    }

    await project.save()

    const members = await User.find({ _id: { $in: project.members } })
      .select('name email avatar role')
      .sort({ name: 1 })
      .lean()

    res.json({ _id: project._id, members })
  } catch (err) {
    console.error('Update project members error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

/**
 * POST /api/projects/:id/transfer — move somebody to another project.
 *
 * Only what they book from here on. The hours already against the old project
 * stay there, because that is where the work happened, and a timesheet that
 * changes retrospectively is worth nothing.
 */
const transferMember = async (req, res) => {
  try {
    const from = await ownedProject(req.user, req.params.id)
    if (from.error) return res.status(from.status).json({ message: from.error })

    const to = await ownedProject(req.user, req.body.toProject)
    if (to.error) return res.status(to.status).json({ message: `Destination: ${to.error}` })

    if (String(from.project._id) === String(to.project._id)) {
      return res.status(400).json({ message: 'That is the same project' })
    }

    const person = await User.findOne({
      _id: req.body.user,
      ...(await assignableTo(req.user, from.project))
    }).select('name').lean()
    if (!person) return res.status(400).json({ message: 'That person is not on this team' })

    from.project.members = from.project.members.filter(
      m => String(m) !== String(person._id)
    )
    if (!to.project.members.some(m => String(m) === String(person._id))) {
      to.project.members.push(person._id)
    }

    await Promise.all([from.project.save(), to.project.save()])

    await audit.record({
      action: 'project.transfer',
      actor: req.user,
      subject: person,
      team: from.project.team,
      entityType: 'Project',
      entityId: from.project._id,
      changes: [{ field: 'project', from: from.project.name, to: to.project.name }]
    })

    res.json({
      message: `${person.name} moved to ${to.project.name}`,
      from: from.project._id,
      to: to.project._id
    })
  } catch (err) {
    console.error('Transfer member error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

/**
 * GET /api/projects/activity — who worked on what today, and who is keeping it up.
 *
 * The two questions a lead actually asks: what is this person on right now,
 * and are they reporting it every day or only when reminded.
 */
const projectActivity = async (req, res) => {
  try {
    const scope = await leadTeam(req.user)
    if (scope.error) return res.status(400).json({ message: scope.error })

    const rosterFilter = scope.admin
      ? { role: { $ne: 'admin' } }
      : { team: scope.team, role: { $ne: 'admin' } }

    const [roster, projects] = await Promise.all([
      User.find(rosterFilter).select('name email avatar team').sort({ name: 1 }).lean(),
      Project.find(scope.admin ? {} : { $or: [{ team: null }, { team: scope.team }] })
        .select('name code client members active')
        .lean()
    ])

    const zone = zoneOf(req.user)
    const today = todayIn(zone)
    const week = lastNDates(7, zone)

    const ids = roster.map(u => u._id)
    const standups = await Standup.find({ user: { $in: ids }, date: { $in: week } })
      .select('user date work hasBlocker blockers today')
      .lean()

    const projectBy = new Map(projects.map(p => [String(p._id), p]))

    const seen = new Map()
    for (const s of standups) {
      const key = String(s.user)
      if (!seen.has(key)) seen.set(key, { days: new Set(), todayEntry: null })
      const entry = seen.get(key)
      entry.days.add(s.date)
      if (s.date === today) entry.todayEntry = s
    }

    const assignedTo = new Map()
    for (const p of projects) {
      for (const m of p.members || []) {
        const key = String(m)
        if (!assignedTo.has(key)) assignedTo.set(key, [])
        assignedTo.get(key).push({ _id: p._id, name: p.name, code: p.code, active: p.active })
      }
    }

    const people = roster.map(u => {
      const key = String(u._id)
      const mine = seen.get(key)
      const s = mine?.todayEntry

      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        avatar: u.avatar || '',
        assigned: assignedTo.get(key) || [],
        submittedToday: Boolean(s),
        plan: s?.today || '',
        blocker: s?.hasBlocker ? s.blockers : '',
        workedOn: (s?.work || []).map(w => ({
          project: projectBy.get(String(w.project))?.name || 'Removed project',
          code: projectBy.get(String(w.project))?.code || '',
          hours: w.hours,
          note: w.note || ''
        })),
        daysThisWeek: mine?.days.size || 0
      }
    })

    res.json({
      today,
      week: { from: week[0], to: week[week.length - 1] },
      people,
      projects: projects
        .filter(p => p.active)
        .map(p => ({
          _id: p._id,
          name: p.name,
          code: p.code,
          memberCount: p.members?.length || 0
        }))
    })
  } catch (err) {
    console.error('Project activity error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = {
  listProjects,
  listAllProjects,
  createProject,
  updateProject,
  updateMembers,
  transferMember,
  projectActivity,
  bookableFilter
}
