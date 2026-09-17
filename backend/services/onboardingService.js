const Onboarding = require('../models/Onboarding')
const Team = require('../models/Team')
const { notify } = require('./notifyService')
const { tasksFor } = require('../utils/onboardingPlan')
const { ownTeam } = require('../utils/teams')

/**
 * Make somebody's checklist and tell the two people who work through it.
 *
 * Returns the existing one if they already have a checklist: approving a
 * hire twice, or starting one by hand for a hire that already has one, must
 * not leave two lists that disagree.
 */
const startOnboarding = async ({ io, user, startsOn, actor, candidate = null }) => {
  const existing = await Onboarding.findOne({ user: user._id })
  if (existing) return { onboarding: existing, created: false }

  const team = await ownTeam(user)

  const onboarding = await Onboarding.create({
    user: user._id,
    userName: user.name,
    position: user.employment?.position || '',
    team,
    startsOn,
    tasks: tasksFor(startsOn),
    candidate,
    startedBy: actor?._id || null,
    startedByName: actor?.name || ''
  })

  await notify(io, {
    recipient: user._id,
    sender: actor?._id,
    type: 'onboarding_started',
    message: 'Welcome aboard — your first-weeks checklist is ready',
    link: `/onboarding/${onboarding._id}`
  })

  const lead = team ? (await Team.findById(team).select('manager').lean())?.manager : null
  if (lead && String(lead) !== String(actor?._id) && String(lead) !== String(user._id)) {
    await notify(io, {
      recipient: lead,
      sender: actor?._id,
      type: 'onboarding_started',
      message: `${user.name} is joining your team — their onboarding checklist is ready`,
      link: `/onboarding/${onboarding._id}`
    })
  }

  return { onboarding, created: true }
}

module.exports = { startOnboarding }
