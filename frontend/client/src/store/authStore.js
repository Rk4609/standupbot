const KEY = 'standupbot_user'

/** localStorage persists across browser restarts; sessionStorage does not. */
const stores = () => [localStorage, sessionStorage]

export const getUser = () => {
  for (const store of stores()) {
    try {
      const raw = store.getItem(KEY)
      if (raw) return JSON.parse(raw)
    } catch {
      // private mode, blocked site data, or a corrupt entry — try the next one
    }
  }
  return null
}

/**
 * `remember: false` keeps the session in sessionStorage, so closing the
 * browser signs the user out. This is what the "Remember me" box controls.
 */
export const saveUser = (userData, { remember = true } = {}) => {
  const target = remember ? localStorage : sessionStorage
  const other = remember ? sessionStorage : localStorage

  try {
    other.removeItem(KEY)
    target.setItem(KEY, JSON.stringify(userData))
  } catch {
    // storage unavailable — the session stays in memory for this page only
  }
}

/**
 * Merge fresh fields into the stored session, in whichever store holds it.
 *
 * For what the server can change after sign-in — a role, the modules it
 * reaches — without touching the token or the "remember me" choice. Does
 * nothing when nobody is signed in, and returns the session as stored.
 */
export const updateUser = (changes) => {
  for (const store of stores()) {
    try {
      const raw = store.getItem(KEY)
      if (!raw) continue
      const next = { ...JSON.parse(raw), ...changes }
      store.setItem(KEY, JSON.stringify(next))
      return next
    } catch {
      // unreadable or unwritable here — try the other store
    }
  }
  return null
}

export const removeUser = () => {
  for (const store of stores()) {
    try {
      store.removeItem(KEY)
    } catch {
      // nothing to clean up if storage is unavailable
    }
  }

  // PWA — cached API responses clear karo, warna next user ko
  // purane user ka data offline/stale serve ho sakta hai
  if (typeof caches !== 'undefined') {
    caches.delete('standupbot-api-cache').catch(() => {})
  }
}
