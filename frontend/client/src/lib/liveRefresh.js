import { useSyncExternalStore } from 'react'

/**
 * A heartbeat pages listen to so they can fetch again without remounting.
 *
 * Something new happened — a notification arrived, the phone came back to
 * the app, half a minute went by — and whatever page is on screen reloads its
 * data in place. Pages keep what they already show while the new response is
 * on its way, so a refresh never blanks the screen.
 *
 * A page opts in by adding the value to the dependencies of the effect that
 * loads its data. Pages holding a half-filled form do not, because a refresh
 * there would overwrite what somebody was typing.
 */

let tick = 0
let last = 0
const listeners = new Set()

/** Bursts collapse into one: focus and visibility often fire together. */
const QUIET_MS = 1000

export const requestRefresh = (now = Date.now()) => {
  if (now - last < QUIET_MS) return false
  last = now
  tick += 1
  listeners.forEach(listener => listener())
  return true
}

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const current = () => tick

/**
 * Run something whenever a refresh goes out — the API client uses it to stop
 * handing out data fetched before the refresh. Returns the unsubscribe.
 */
export const onRefresh = (listener) => subscribe(listener)

/** The current tick; changes each time a refresh is requested. */
export const useLiveRefresh = () => useSyncExternalStore(subscribe, current, current)

/** For tests: start from a clean slate. */
export const resetLiveRefresh = () => {
  tick = 0
  last = 0
}
