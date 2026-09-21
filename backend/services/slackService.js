const SlackIntegration = require('../models/SlackIntegration')

const TIMEOUT_MS = 5000

/**
 * Only Slack's own webhook host is accepted.
 *
 * The server POSTs to whatever URL a manager stores here, so without this
 * check the app is an open proxy: anyone who can reach the settings could aim
 * it at an internal address and read the response through `lastError`. The
 * host allowlist is what stops that, not the https check.
 */
const isSlackWebhook = (url) => {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'hooks.slack.com' &&
      parsed.pathname.startsWith('/services/')
    )
  } catch {
    return false
  }
}

/**
 * POST one message.
 *
 * Returns a result rather than throwing: a standup must not fail because
 * Slack is down, and the caller decides whether anyone needs to hear about it.
 */
const post = async (webhookUrl, payload) => {
  if (!isSlackWebhook(webhookUrl)) {
    return { ok: false, error: 'Not a Slack webhook URL' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })

    if (!res.ok) {
      // Slack answers with a plain-text reason such as "invalid_token"
      const reason = (await res.text().catch(() => '')).slice(0, 200)
      return { ok: false, error: `Slack said ${res.status}: ${reason || 'no reason given'}` }
    }

    return { ok: true }
  } catch (err) {
    const error = err.name === 'AbortError'
      ? 'Slack did not respond in time'
      : err.message
    return { ok: false, error }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Send to a team's channel if they have one wired up and want this event.
 *
 * Every caller is a side effect of something more important, so this never
 * throws and never blocks: failures are recorded on the integration so the
 * settings page can show them, and the original action carries on.
 */
const notifyTeam = async (teamId, event, payload) => {
  if (!teamId) return { ok: false, skipped: 'no team' }

  try {
    const integration = await SlackIntegration.findOne({ team: teamId })
    if (!integration || !integration.active) return { ok: false, skipped: 'not connected' }
    if (!integration.events[event]) return { ok: false, skipped: 'event off' }

    const result = await post(integration.webhookUrl, payload)

    await SlackIntegration.updateOne(
      { _id: integration._id },
      result.ok
        ? { lastDeliveryAt: new Date(), lastError: '' }
        : { lastError: result.error }
    )

    if (!result.ok) console.warn(`Slack ${event} failed:`, result.error)
    return result
  } catch (err) {
    console.error(`Slack ${event} error:`, err.message)
    return { ok: false, error: err.message }
  }
}

/* Message builders ---------------------------------------------------- */

const MOOD_EMOJI = {
  great: ':rocket:',
  good: ':slightly_smiling_face:',
  okay: ':neutral_face:',
  bad: ':disappointed:',
  stressed: ':cold_sweat:'
}

/** Slack truncates long blocks awkwardly, so trim before it does. */
const clip = (text, max = 500) => {
  const clean = (text || '').trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

const standupMessage = (standup, user) => {
  const lines = []
  if (standup.yesterday) lines.push(`*Yesterday:* ${clip(standup.yesterday)}`)
  lines.push(`*Today:* ${clip(standup.today)}`)

  for (const [key, value] of Object.entries(standup.answers || {})) {
    if (value) lines.push(`*${key.replace(/_/g, ' ')}:* ${clip(value)}`)
  }

  if (standup.hasBlocker) lines.push(`:warning: *Blocked:* ${clip(standup.blockers)}`)

  return {
    text: `${user.name} posted their standup`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${MOOD_EMOJI[standup.mood] || ''} *${user.name}* · ${standup.date}\n${lines.join('\n')}`
        }
      }
    ]
  }
}

const blockerMessage = (standup, user) => ({
  text: `${user.name} is blocked`,
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:rotating_light: *${user.name} is blocked* · ${standup.date}\n${clip(standup.blockers)}`
      }
    }
  ]
})

const summaryMessage = (teamName, date, standups, rosterSize) => {
  const blocked = standups.filter(s => s.hasBlocker)

  const lines = [
    `*${teamName}* · ${date}`,
    `${standups.length} of ${rosterSize} posted a standup.`
  ]

  if (blocked.length > 0) {
    lines.push('', '*Blocked:*')
    for (const s of blocked) {
      lines.push(`• *${s.user?.name || 'Someone'}* — ${clip(s.blockers, 200)}`)
    }
  } else if (standups.length > 0) {
    lines.push('Nobody reported a blocker.')
  }

  return {
    text: `${teamName} standup summary for ${date}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } }
    ]
  }
}

const weeklyReportMessage = (teamName, week, content) => ({
  text: `Weekly report for ${teamName}`,
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:sparkles: *Weekly report — ${teamName}*\n_${week.weekStart} to ${week.weekEnd}_`
      }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: clip(content, 2800) }
    }
  ]
})

const testMessage = (teamName, byName) => ({
  text: 'StandupBot is connected',
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:white_check_mark: *StandupBot is connected to ${teamName}.*\nWired up by ${byName}. Standups, blockers and the weekly report will land here.`
      }
    }
  ]
})

module.exports = {
  isSlackWebhook,
  post,
  notifyTeam,
  standupMessage,
  blockerMessage,
  summaryMessage,
  weeklyReportMessage,
  testMessage
}
