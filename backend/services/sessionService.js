const jwt = require('jsonwebtoken')
const Session = require('../models/Session')
const User = require('../models/User')

const LIFETIME_MS = 7 * 24 * 60 * 60 * 1000
/** Write "last seen" at most this often, not on every request. */
const TOUCH_EVERY_MS = 5 * 60 * 1000
/** How long an answer about a session is trusted before asking again. */
const CACHE_MS = 30 * 1000

const cache = new Map()

/** "Chrome on Windows", from the browser's own description. */
const deviceFrom = (ua = '') => {
  const browser = /edg\//i.test(ua) ? 'Edge' : /opr\//i.test(ua) ? 'Opera' : /chrome|crios/i.test(ua) ? 'Chrome'
    : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : ua ? 'Browser' : 'Unknown device'
  const os = /android/i.test(ua) ? 'Android' : /iphone|ipad/i.test(ua) ? 'iOS' : /windows/i.test(ua) ? 'Windows'
    : /mac os/i.test(ua) ? 'macOS' : /linux/i.test(ua) ? 'Linux' : ''
  return os ? `${browser} on ${os}` : browser
}

/** The first parts of an address only: "49.36.x.x". */
const partialIp = (ip = '') => {
  const clean = String(ip).replace(/^::ffff:/, '')
  if (clean.includes('.')) return `${clean.split('.').slice(0, 2).join('.')}.x.x`
  return clean ? `${clean.split(':').slice(0, 2).join(':')}::` : ''
}

/** Start a session for this sign-in and return its token. */
const startSession = async (user, req) => {
  const row = await Session.create({
    user: user._id,
    device: deviceFrom(req?.headers?.['user-agent']),
    ip: partialIp(req?.ip),
    expiresAt: new Date(Date.now() + LIFETIME_MS)
  })
  return jwt.sign({ id: String(user._id), sid: String(row._id) }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

/**
 * Is this token's sign-in still good? A token with a session id lives and
 * dies with that row. Tokens from before sessions existed carry no id, and
 * are judged by the account's cut-off instead, which "sign out everywhere"
 * moves forward.
 */
const sessionAllows = async (decoded, user) => {
  if (!decoded.sid) {
    const cutoff = user.tokensValidAfter ? new Date(user.tokensValidAfter).getTime() : 0
    return !(cutoff && decoded.iat * 1000 < cutoff)
  }

  const hit = cache.get(decoded.sid)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.ok

  const row = await Session.findById(decoded.sid).select('revokedAt lastSeenAt').lean()
  const ok = Boolean(row && !row.revokedAt)
  cache.set(decoded.sid, { ok, at: Date.now() })

  if (ok && Date.now() - new Date(row.lastSeenAt).getTime() > TOUCH_EVERY_MS) {
    Session.updateOne({ _id: decoded.sid }, { $set: { lastSeenAt: new Date() } }).catch(() => {})
  }
  return ok
}

/** End sessions now, here and in the cache. */
const revoke = async (filter) => {
  const rows = await Session.find({ ...filter, revokedAt: null }).select('_id').lean()
  await Session.updateMany({ _id: { $in: rows.map(r => r._id) } }, { $set: { revokedAt: new Date() } })
  for (const r of rows) cache.set(String(r._id), { ok: false, at: Date.now() })
  return rows.length
}

/**
 * Sign somebody out everywhere except (optionally) the session in use —
 * including any token from before sessions existed.
 */
const revokeAllExcept = async (userId, keepSid = null) => {
  const count = await revoke({ user: userId, ...(keepSid ? { _id: { $ne: keepSid } } : {}) })
  await User.updateOne({ _id: userId }, { $set: { tokensValidAfter: new Date() } })
  return count
}

const resetSessionCache = () => cache.clear()

module.exports = { startSession, sessionAllows, revoke, revokeAllExcept, deviceFrom, partialIp, resetSessionCache }
