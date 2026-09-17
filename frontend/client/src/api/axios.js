import axios from 'axios'
import { getUser, removeUser } from '../store/authStore'
import { onRefresh, requestRefresh } from '../lib/liveRefresh'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
})

/**
 * Recent answers, so opening a module shows its data at once.
 *
 * After sign-in the app asks for each module's first page of data in the
 * background (see warmUp). Those requests, and any later request for the same
 * thing, keep the newest answer here for a minute; a module that opens in
 * that time gets it immediately instead of waiting on the network.
 *
 * It works like "show what we have, then check": an answer older than a few
 * seconds is shown at once and a refresh goes out straight after, so the
 * module fills in instantly and corrects itself a moment later if anything
 * moved. Deliberately narrow beyond that:
 * - only requests that were warmed are remembered — nothing else is cached;
 * - an answer is kept for five minutes at most, and a newer one always wins,
 *   ordered by when each request was sent, not when it happened to land;
 * - a refresh of something already on screen always goes to the network;
 *   a module opening for the first time may still use what is remembered;
 * - any change sent to the server (a save, a submit, a delete) clears it all;
 * - answers are filed under the session's token, and cleared on sign-out.
 */
const WARM_TTL_MS = 5 * 60_000
const REVALIDATE_AFTER_MS = 10_000
const warmed = new Map()
// Warm-ups still on their way: a module's answer for one of these is
// remembered too, so it is not beaten later by the slower warm-up
const warming = new Set()
// key -> when a module last asked for it, to tell a refresh of something on
// screen (must reach the server) from a first look (may use what we have)
const asked = new Map()
let invalidatedAt = 0
let refreshedAt = 0

const cacheKey = (config, token) => {
  const params = Object.entries(config.params || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
  return `${token || ''}|${config.url}|${JSON.stringify(params)}`
}

// A live refresh means "look again" for whatever is already on screen
onRefresh(() => {
  refreshedAt = Date.now()
})

// Har request mein token automatically lagao. Reading through authStore keeps
// the "Remember me" choice (localStorage vs sessionStorage) in one place.
API.interceptors.request.use((config) => {
  const user = getUser()
  if (user?.token) config.headers.Authorization = `Bearer ${user.token}`

  const method = (config.method || 'get').toLowerCase()

  if (method !== 'get') {
    // Something is about to change on the server
    warmed.clear()
    invalidatedAt = Date.now()
    return config
  }

  config.sentAt = Date.now()

  if (!config.warm) {
    const key = cacheKey(config, user?.token)
    const askedBefore = asked.get(key)
    if (asked.size > 500) asked.clear()
    asked.set(key, config.sentAt)

    // Asked for before, and a refresh has been requested since: this is that
    // refresh, and it has to come from the server
    const isRefresh = askedBefore !== undefined && askedBefore < refreshedAt

    const hit = warmed.get(key)
    const usable = hit &&
      !isRefresh &&
      config.sentAt - hit.at < WARM_TTL_MS &&
      hit.at > invalidatedAt

    if (usable) {
      config.fromWarm = true
      config.adapter = () => Promise.resolve({ ...hit.response, config, request: null })

      // Shown at once; if it is more than a few seconds old, check straight
      // after, so the module corrects itself in place if anything moved
      if (config.sentAt - hit.at > REVALIDATE_AFTER_MS) {
        setTimeout(() => requestRefresh(), 50)
      }
    }
  }

  return config
})

/** Keep this answer if its request is one we remember and it is the newest. */
const remember = (response, force = false) => {
  const { config } = response
  if (!config || config.fromWarm || (config.method || 'get').toLowerCase() !== 'get') return

  const key = cacheKey(config, getUser()?.token)
  const existing = warmed.get(key)
  if (!force && !existing && !warming.has(key)) return
  if (existing && existing.at >= config.sentAt) return
  // Sent before the data was last invalidated: already out of date
  if (config.sentAt <= invalidatedAt) return

  warmed.set(key, {
    at: config.sentAt,
    response: {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    }
  })
}

API.interceptors.response.use((response) => {
  remember(response)
  return response
})

/** Fetch something now so a module asking for it soon gets it at once. */
export const warmUp = (url, config = {}) => {
  const key = cacheKey({ url, params: config.params }, getUser()?.token)
  warming.add(key)

  return API.get(url, { ...config, warm: true })
    .then((response) => remember(response, true))
    .catch(() => {
      // Nothing lost: the module fetches it itself when it opens
    })
    .finally(() => warming.delete(key))
}

/** Forget every remembered answer — on sign-out, and between tests. */
export const clearWarm = () => {
  warmed.clear()
  warming.clear()
  asked.clear()
  invalidatedAt = Date.now()
}

/**
 * Signing in is the one place a 401 is an answer rather than an expiry.
 *
 * Wrong password, unknown email, a reset link that has lapsed — those come
 * back 401 and the form should say so, not throw the person out of a session
 * they are not in yet.
 */
const ANSWERS_WITH_401 = ['/auth/login', '/auth/register', '/auth/reset-password']

const isSignIn = (url = '') => ANSWERS_WITH_401.some(path => url.includes(path))

/**
 * A token lasts seven days. When it lapses every page started failing in its
 * own way — one showed empty fields, another said "user no longer exists" —
 * because each handled its own 401 and none of them knew what it meant.
 *
 * It means the session is over, and that is not a page-level fact. The stored
 * session is cleared here and the browser goes to sign-in with a reason, once,
 * however many requests happen to fail at the same moment.
 */
let signingOut = false

API.interceptors.response.use(
  response => response,
  (error) => {
    const status = error.response?.status
    const url = error.config?.url || ''

    if (status === 401 && !isSignIn(url) && !signingOut) {
      signingOut = true
      removeUser()

      // A full load rather than a router navigation: everything in memory
      // belongs to the session that just ended
      const target = '/login?expired=1'
      if (window.location.pathname !== '/login') {
        window.location.replace(target)
      } else {
        signingOut = false
      }
    }

    return Promise.reject(error)
  }
)

export default API
