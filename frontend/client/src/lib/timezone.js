/**
 * The browser already knows where the person is, so nobody should have to
 * pick their timezone from a list of 400 on the way in. It is asked for once
 * at sign-up and only ever edited by someone who travelled or was guessed
 * wrong.
 */

import { getUser } from '../store/authStore'

/** The browser's own zone, or '' if it cannot say — the server reads that as UTC. */
export const detectTimezone = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    // The server refuses bare abbreviations like 'IST', which mean different
    // things in different places
    return tz && (tz === 'UTC' || tz.includes('/')) ? tz : ''
  } catch {
    return ''
  }
}

/**
 * Every zone the browser knows, for the picker.
 *
 * `supportedValuesOf` is missing on older engines, in which case the list
 * falls back to the person's own zone plus a handful of common ones — enough
 * to change it, rather than an empty dropdown.
 */
export const timezoneOptions = () => {
  const detected = detectTimezone()

  let zones
  try {
    zones = Intl.supportedValuesOf?.('timeZone') || []
  } catch {
    zones = []
  }

  if (zones.length === 0) {
    zones = [
      'UTC',
      'Asia/Kolkata',
      'Asia/Dubai',
      'Asia/Singapore',
      'Asia/Tokyo',
      'Europe/London',
      'Europe/Berlin',
      'America/New_York',
      'America/Chicago',
      'America/Los_Angeles',
      'Australia/Sydney'
    ]
  }

  return Array.from(new Set([detected, 'UTC', ...zones].filter(Boolean))).sort()
}

/** Current local time in a zone, e.g. "14:05" — shown next to the picker. */
export const timeIn = (tz, at = new Date()) => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz || 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(at)
  } catch {
    return ''
  }
}

/** The UTC offset as text, e.g. "UTC+05:30". */
export const offsetLabel = (tz, at = new Date()) => {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz || 'UTC',
      timeZoneName: 'longOffset'
    }).formatToParts(at)
    const name = parts.find(p => p.type === 'timeZoneName')?.value || ''
    return name === 'GMT' ? 'UTC+00:00' : name.replace('GMT', 'UTC')
  } catch {
    return ''
  }
}

/** A calendar date, 'YYYY-MM-DD', as it reads in a zone. */
export const isoDateIn = (tz, at = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(at)

  const get = (type) => parts.find(p => p.type === type).value
  return `${get('year')}-${get('month')}-${get('day')}`
}

/**
 * Today, as the server will file it for this user.
 *
 * It deliberately mirrors the server's fallback — an account with no zone set
 * is UTC, not the browser's zone. Using the browser here would put the two
 * out of step and the dashboard would claim a submitted standup was missing.
 */
export const todayForUser = (at = new Date()) => isoDateIn(getUser()?.timezone, at)

/** The last `n` dates ending today for this user, oldest first. */
export const lastNDatesForUser = (n, at = new Date()) => {
  const end = todayForUser(at)
  const base = new Date(`${end}T00:00:00.000Z`)

  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() + i - (n - 1))
    return d.toISOString().split('T')[0]
  })
}
