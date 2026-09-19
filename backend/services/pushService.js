const webpush = require('web-push')
const PushSubscription = require('../models/PushSubscription')

/**
 * Notifications that reach a phone or laptop while the app is closed.
 *
 * Needs a VAPID key pair in the environment (VAPID_PUBLIC_KEY,
 * VAPID_PRIVATE_KEY, and a contact in VAPID_SUBJECT). Without them this is
 * switched off and says so, rather than failing every notification: the bell
 * and the live popup carry on exactly as before.
 *
 *   npx web-push generate-vapid-keys
 */

/** Too frequent to buzz somebody's phone for; they still reach the bell. */
const NOT_PUSHED = new Set(['standup_submitted'])

const TITLES = {
  blocker_added: 'Blocker raised',
  reminder: 'Reminder',
  support_raised: 'New support request',
  support_replied: 'Your request was answered',
  support_closed: 'Request closed',
  hiring_submitted: 'Somebody put forward',
  hiring_decided: 'Hiring decision',
  leave_requested: 'Leave requested',
  leave_decided: 'Leave update',
  payslip_ready: 'Payslip ready',
  onboarding_started: 'Welcome aboard',
  onboarding_complete: 'Onboarding complete',
  brief_ready: 'Morning brief',
  report_ready: 'Weekly report',
  kudos_received: 'Kudos for you',
  celebration_day: 'Today is a special day',
  celebration_wish: 'A wish for you',
  announcement: 'Announcement',
  expense_submitted: 'Expense claim',
  expense_decided: 'Expense update',
  review_started: 'Review time',
  review_submitted: 'Self-review in',
  review_shared: 'Your review',
  oneonone_scheduled: '1:1 booked',
  letter_requested: 'Letter requested',
  letter_issued: 'Your letter'
}

let configuredWith = null

/** Set the keys once, and again only if the environment changed (tests do). */
const configured = () => {
  const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv } = process.env
  if (!pub || !priv) return false

  const signature = `${pub}:${priv}`
  if (configuredWith !== signature) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@standupbot.local', pub, priv)
    configuredWith = signature
  }
  return true
}

const publicKey = () => (configured() ? process.env.VAPID_PUBLIC_KEY : null)

/**
 * Send one message to every device a person has turned this on for.
 *
 * Never throws: a push is a courtesy on top of a notification that is
 * already stored. A device the push service says no longer exists (404 or
 * 410) is forgotten, so it is not tried again on every notification.
 */
const pushToUser = async (userId, { title, body, url = '/', tag }) => {
  if (!userId || !configured()) return { sent: 0 }

  let subscriptions
  try {
    subscriptions = await PushSubscription.find({ user: userId }).lean()
  } catch (err) {
    console.error('Push lookup failed:', err.message)
    return { sent: 0 }
  }
  if (subscriptions.length === 0) return { sent: 0 }

  const payload = JSON.stringify({ title, body, url, tag })
  let sent = 0

  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, { TTL: 60 * 60 * 12 })
      sent += 1
      await PushSubscription.updateOne({ _id: sub._id }, { $set: { lastSentAt: new Date() } })
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {})
      } else {
        console.error('Push failed:', err.statusCode || '', err.message)
      }
    }
  }))

  return { sent }
}

/** The push for a stored notification, if its kind is one that buzzes. */
const pushNotification = (doc) => {
  if (!doc || NOT_PUSHED.has(doc.type)) return Promise.resolve({ sent: 0 })
  return pushToUser(doc.recipient, {
    title: TITLES[doc.type] || 'StandupBot',
    body: doc.message,
    url: doc.link || '/',
    tag: doc.type
  })
}

module.exports = { pushToUser, pushNotification, publicKey, configured, NOT_PUSHED }
