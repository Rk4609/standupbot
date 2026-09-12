const Project = require('../models/Project')
const Standup = require('../models/Standup')
const Team = require('../models/Team')
const { ownTeam } = require('../utils/teams')

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
 * Their team's projects plus the shared ones — internal work, leave and
 * training belong to nobody's team but everybody has to be able to record
 * them, or a week never adds up to a full week.
 */
const bookableFilter = (teamId) => ({
  active: true,
  $or: [{ team: null }, ...(teamId ? [{ team: teamId }] : [])]
})

// GET /api/projects — what I can book against
const listProjects = async (req, res) => {
  try {
    const projects = await Project.find(bookableFilter(req.user.team))
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
      .sort({ active: -1, name: 1 })
      .lean()

    // An admin can put a project on any team, so they need the list to
    // choose from. A manager has one and is not offered a choice.
    const teams = scope.admin
      ? await Team.find().select('name').sort({ name: 1 }).lean()
      : []
    const defaultTeam = scope.admin ? await ownTeam(req.user) : scope.team

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

module.exports = {
  listProjects,
  listAllProjects,
  createProject,
  updateProject,
  bookableFilter
}
