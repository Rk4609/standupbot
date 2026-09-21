/**
 * Calendar-day arithmetic on 'YYYY-MM-DD' strings, done in UTC so a date
 * never slides a day because of the reader's clock. The same rule the server
 * follows for standups and attendance.
 */

export const addDaysIso = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** The Monday of the week the date falls in. */
export const mondayOfIso = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`)
  const sinceMonday = (d.getUTCDay() + 6) % 7
  return addDaysIso(iso, -sinceMonday)
}

/** Monday to Friday of the week the date falls in. */
export const workWeek = (iso) =>
  Array.from({ length: 5 }, (_, i) => addDaysIso(mondayOfIso(iso), i))

/** "Mon", "Tue" — in the reader's own language. */
export const weekdayShort = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })

export const dayOfMonth = (iso) => Number(iso.slice(8, 10))

/** A month's name relative to the date's own month: -1 for the one before. */
export const monthName = (iso, offset = 0) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + offset)
  return d.toLocaleDateString(undefined, { month: 'long', timeZone: 'UTC' })
}

/** "September 2026" */
export const monthYear = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  })

/** 6 → "6", 6.5 → "6.5", 6.25 → "6.3" */
export const hoursLabel = (n) => {
  const value = Number(n) || 0
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
