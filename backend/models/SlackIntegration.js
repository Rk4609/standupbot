const mongoose = require('mongoose')

/**
 * A team's Slack connection.
 *
 * This uses an incoming webhook rather than a Slack app with OAuth: a webhook
 * is a URL a manager creates in Slack and pastes here, so it works on a single
 * deployment with no public callback URL, no app review and no token refresh.
 * The trade is that it posts to exactly one channel and cannot read anything
 * back, which is all this integration needs.
 *
 * The webhook URL is a bearer secret — anyone holding it can post to the
 * channel as the app. It is never returned to a client in full, and only ever
 * sent to hooks.slack.com.
 */
const EVENTS = [
  'standupSubmitted',
  'blockerRaised',
  'dailySummary',
  // Posts the Friday weekly report. The name is from when that was the
  // retro; it is kept so the settings teams have already saved still apply.
  'weeklyRetro'
]

const slackIntegrationSchema = new mongoose.Schema({
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
    unique: true
  },

  webhookUrl: { type: String, required: true },

  // What Slack said the webhook posts to, e.g. "#standups" — shown back to
  // the manager so they can tell which channel they wired up
  channel: { type: String, default: '' },

  events: {
    standupSubmitted: { type: Boolean, default: false },
    blockerRaised: { type: Boolean, default: true },
    dailySummary: { type: Boolean, default: true },
    weeklyRetro: { type: Boolean, default: true }
  },

  active: { type: Boolean, default: true },

  // Enough to answer "is this working?" without opening the server logs
  lastDeliveryAt: { type: Date, default: null },
  lastError: { type: String, default: '' },

  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true })

/**
 * The URL with everything but its shape hidden.
 *
 * A manager needs to recognise which webhook is stored without the value
 * being readable by anyone who gets hold of a response.
 */
slackIntegrationSchema.methods.masked = function () {
  const tail = this.webhookUrl.slice(-4)
  return `https://hooks.slack.com/services/…${tail}`
}

module.exports = mongoose.models.SlackIntegration ||
  mongoose.model('SlackIntegration', slackIntegrationSchema)
module.exports.EVENTS = EVENTS
