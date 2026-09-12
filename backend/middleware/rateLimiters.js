const rateLimit = require('express-rate-limit')
const { ipKeyGenerator, MemoryStore } = require('express-rate-limit')

/**
 * Each limiter gets its own store, and we keep handles to them so the test
 * suite can clear the counters between cases — otherwise a suite that makes
 * six registrations trips the 5/hour limit on its own sixth request.
 *
 * The registry lives on globalThis because this file is reached both as CJS
 * (require, from the routes) and as ESM (import, from the test setup). Those
 * are separate module instances, so a plain module-level array would have the
 * setup clearing stores the app never uses.
 */
const stores = (globalThis.__standupbotRateLimitStores ??= [])
const newStore = () => {
  const store = new MemoryStore()
  stores.push(store)
  return store
}

/**
 * Rate limits.
 *
 * Render terminates TLS and forwards the client IP in X-Forwarded-For, so the
 * app must trust the proxy (see server.js) or every request would be counted
 * against the proxy's single IP.
 */
const message = (retryAfter) => ({
  message: `Too many attempts. Please try again in ${retryAfter}.`
})

/** Credential endpoints — the ones worth brute forcing. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  store: newStore(),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Failed attempts are what we care about; a correct login should not
  // consume the budget of the next person behind the same NAT.
  skipSuccessfulRequests: true,
  message: message('15 minutes')
})

/** Password reset — also an email-sending endpoint, so abuse costs money. */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  store: newStore(),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('an hour')
})

/** Account creation. */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  store: newStore(),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('an hour')
})

/** The AI endpoints cost real tokens per call. */
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  store: newStore(),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Per user rather than per IP — a whole office shares one address.
  // ipKeyGenerator normalises IPv6 to its /64 prefix; using req.ip raw would
  // let a client rotate through addresses in its own subnet to reset the count.
  keyGenerator: (req, res) => (req.user?._id ? String(req.user._id) : ipKeyGenerator(req, res)),
  message: message('a few minutes')
})

/** Everything else, as a backstop against scripted traffic. */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 200,
  store: newStore(),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('a minute')
})

/** Clear every limiter's counters. Used by the test setup. */
const resetRateLimits = () => {
  for (const store of stores) store.resetAll?.()
}

module.exports = {
  resetRateLimits,
  authLimiter,
  passwordResetLimiter,
  registerLimiter,
  aiLimiter,
  apiLimiter
}
