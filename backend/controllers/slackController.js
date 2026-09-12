const SlackIntegration = require('../models/SlackIntegration')
const Team = require('../models/Team')
const slack = require('../services/slackService')

/**
 * The team a lead may wire up.
 *
 * An admin can pick any team, and falls back to their own team or one they
 * manage — most admins here are also running a team, and making them pass an
 * id for the common case would leave the page a dead end.
 */
const resolveTeam = async (user, requested) => {
  if (user.role === 'admin') {
    if (requested) return { team: requested }
    if (user.team) return { team: user.team }

    const managed = await Team.findOne({ manager: user._id }).select('_id')
    if (managed) return { team: managed._id }

    const any = await Team.findOne().select('_id')
    if (any) return { team: any._id }

    return { error: 'There are no teams to connect yet' }
  }

  const own = await Team.findOne({ manager: user._id })
  if (!own) return { error: 'You are not managing any team!' }
  if (requested && String(requested) !== String(own._id)) {
    return { error: 'That team is not yours' }
  }
  return { team: own._id }
}

/** What a client is allowed to see. The webhook itself never leaves the server. */
const present = (integration) => {
  if (!integration) return { connected: false, events: null }

  return {
    connected: true,
    webhook: integration.masked(),
    channel: integration.channel,
    events: integration.events,
    active: integration.active,
    lastDeliveryAt: integration.lastDeliveryAt,
    lastError: integration.lastError,
    updatedAt: integration.updatedAt
  }
}

// GET /api/slack
const getIntegration = async (req, res) => {
  try {
    const { team, error } = await resolveTeam(req.user, req.query.team)
    if (error) return res.status(400).json({ message: error })

    const integration = await SlackIntegration.findOne({ team })

    // An admin can wire up any team, so they need the list to choose from.
    // A manager has exactly one and is not offered a choice.
    const teams = req.user.role === 'admin'
      ? await Team.find().select('name').sort({ name: 1 }).lean()
      : []

    res.json({ ...present(integration), team: String(team), teams })
  } catch (err) {
    console.error('Get Slack integration error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

/**
 * PUT /api/slack — store a webhook, after proving it works.
 *
 * The test message is sent before anything is saved. A webhook that Slack
 * rejects is a typo, and storing it would leave the team believing they are
 * connected until the first standup silently fails to appear.
 */
const saveIntegration = async (req, res) => {
  try {
    const { team, error } = await resolveTeam(req.user, req.body.team)
    if (error) return res.status(400).json({ message: error })

    const { webhookUrl, channel = '', events } = req.body

    if (!slack.isSlackWebhook(webhookUrl)) {
      return res.status(400).json({
        message: 'That is not a Slack webhook. It should start with https://hooks.slack.com/services/'
      })
    }

    const teamDoc = await Team.findById(team).select('name')

    const check = await slack.post(
      webhookUrl,
      slack.testMessage(teamDoc?.name || 'your team', req.user.name)
    )
    if (!check.ok) {
      return res.status(400).json({
        message: `Slack would not accept that webhook — ${check.error}`
      })
    }

    const integration = await SlackIntegration.findOneAndUpdate(
      { team },
      {
        team,
        webhookUrl,
        channel: channel.trim().slice(0, 80),
        ...(events ? { events } : {}),
        active: true,
        lastDeliveryAt: new Date(),
        lastError: '',
        updatedBy: req.user._id
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    res.json({ ...present(integration), message: 'Connected — check the channel' })
  } catch (err) {
    console.error('Save Slack integration error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// PATCH /api/slack — turn individual events on or off
const updateEvents = async (req, res) => {
  try {
    const { team, error } = await resolveTeam(req.user, req.body.team)
    if (error) return res.status(400).json({ message: error })

    const integration = await SlackIntegration.findOne({ team })
    if (!integration) {
      return res.status(404).json({ message: 'No Slack channel is connected yet' })
    }

    if (req.body.events) {
      for (const [key, value] of Object.entries(req.body.events)) {
        integration.events[key] = Boolean(value)
      }
    }
    if (req.body.active !== undefined) integration.active = Boolean(req.body.active)

    integration.updatedBy = req.user._id
    await integration.save()

    res.json(present(integration))
  } catch (err) {
    console.error('Update Slack events error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/slack/test — send a message now
const sendTest = async (req, res) => {
  try {
    const { team, error } = await resolveTeam(req.user, req.body.team)
    if (error) return res.status(400).json({ message: error })

    const integration = await SlackIntegration.findOne({ team })
    if (!integration) {
      return res.status(404).json({ message: 'No Slack channel is connected yet' })
    }

    const teamDoc = await Team.findById(team).select('name')
    const result = await slack.post(
      integration.webhookUrl,
      slack.testMessage(teamDoc?.name || 'your team', req.user.name)
    )

    await SlackIntegration.updateOne(
      { _id: integration._id },
      result.ok
        ? { lastDeliveryAt: new Date(), lastError: '' }
        : { lastError: result.error }
    )

    if (!result.ok) return res.status(502).json({ message: result.error })
    res.json({ message: 'Sent — check the channel' })
  } catch (err) {
    console.error('Slack test error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// DELETE /api/slack — disconnect
const disconnect = async (req, res) => {
  try {
    const { team, error } = await resolveTeam(req.user, req.query.team)
    if (error) return res.status(400).json({ message: error })

    await SlackIntegration.deleteOne({ team })
    res.json({ connected: false, events: null, message: 'Disconnected' })
  } catch (err) {
    console.error('Slack disconnect error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = { getIntegration, saveIntegration, updateEvents, sendTest, disconnect }
