const Team = require('../models/Team')

/**
 * The team a person belongs to for their own work.
 *
 * `user.team` only covers employees. A manager is linked to their team as its
 * manager instead, and an admin is linked to nothing at all — so reading the
 * field directly left leads with no team, which quietly filed their standups
 * against nobody, hid their team's template from them and kept them out
 * of their own team's reports. Three separate bugs from one missing lookup, which is
 * why it lives in one place now.
 *
 * This answers "whose work is this", not "what may they see" — for that, the
 * controllers scope by role, where an admin means everything.
 */
const ownTeam = async (user) => {
  if (!user) return null
  if (user.team) return user.team

  const managed = await Team.findOne({ manager: user._id }).select('_id').lean()
  return managed?._id || null
}

module.exports = { ownTeam }
