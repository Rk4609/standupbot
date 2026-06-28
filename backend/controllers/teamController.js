const Team = require('../models/Team')
const User = require('../models/User')

// POST /api/teams — team banao (admin)
const createTeam = async (req, res) => {
  const { name, managerId } = req.body
  const team = await Team.create({ name, manager: managerId })
  res.status(201).json(team)
}

// POST /api/teams/:id/members — member add karo
const addMember = async (req, res) => {
  const { userId } = req.body
  const team = await Team.findById(req.params.id)
  if (!team) return res.status(404).json({ message: 'Team not found' })

  team.members.addToSet(userId)
  await team.save()

  await User.findByIdAndUpdate(userId, { team: team._id })
  res.json(team)
}

// GET /api/teams — sabhi teams (admin)
const getAllTeams = async (req, res) => {
  const teams = await Team.find()
    .populate('manager', 'name email')
    .populate('members', 'name email streak')
  res.json(teams)
}

module.exports = { createTeam, addMember, getAllTeams }