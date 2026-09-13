const Notification = require('../models/Notification')

/**
 * Write a notification and push it to whoever it is for.
 *
 * The bell reads the stored rows, and the socket makes one appear without a
 * reload; sending only the socket event would lose it on refresh, and storing
 * only the row would mean nobody sees it until they navigate. Both, always.
 *
 * Nothing here throws. A notification is a side effect of an action somebody
 * already completed — a hub that is down, or a recipient who was deleted a
 * second ago, must not turn their successful reply into a 500.
 */
const notify = async (io, { recipient, sender, type, message, link }) => {
  if (!recipient) return null

  try {
    const doc = await Notification.create({ recipient, sender, type, message, link })

    // `io` is absent when the app is mounted without a socket server, which
    // is how the tests run
    io?.to(String(recipient)).emit('new-notification', {
      _id: doc._id,
      message: doc.message,
      type: doc.type,
      isRead: false,
      createdAt: doc.createdAt,
      link: doc.link
    })

    return doc
  } catch (err) {
    console.error('Notify failed:', err.message)
    return null
  }
}

/** The same notification to several people, skipping any repeated id. */
const notifyMany = async (io, recipients, payload) => {
  const seen = new Set()
  const unique = (recipients || []).filter(id => {
    const key = String(id)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  return Promise.all(unique.map(recipient => notify(io, { ...payload, recipient })))
}

module.exports = { notify, notifyMany }
