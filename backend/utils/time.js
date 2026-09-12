/**
 * Calendar-day arithmetic in a named timezone.
 *
 * A standup belongs to a day, not an instant, and "which day" is decided
 * where the person is — not where the server runs. Render runs in UTC, so
 * `new Date().toISOString().split('T')[0]` filed a standup submitted at
 * 01:00 in Delhi under the previous date, told that person at 11 PM that
 * they had "already submitted today", and broke their streak the next
 * morning.
 *
 * Everything here works on 'YYYY-MM-DD' strings, which is how dates are
 * stored. Mixing a local `setDate()` with a UTC `toISOString()` is the bug
 * this module exists to stop, so nothing below does date maths on a Date in
 * local time.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Is this a timezone the platform's ICU data knows, named unambiguously?
 *
 * ICU also accepts bare abbreviations and quietly picks one meaning: 'IST'
 * resolves to Asia/Calcutta, so an Irish user typing it would be put on
 * India time. Only region-qualified names ('Area/Location') and 'UTC' are
 * accepted, which is what every browser reports anyway.
 */
const isValidTimezone = (tz) => {
  if (typeof tz !== 'string' || tz === '') return false
  if (tz !== 'UTC' && !tz.includes('/')) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Fall back rather than throw: a bad stored zone must not break a standup. */
const safeZone = (tz) => (isValidTimezone(tz) ? tz : 'UTC')

/**
 * The parts of an instant as seen in a zone.
 *
 * `formatToParts` is used instead of a locale that happens to print
 * ISO-ish dates, because locale output is not a stable contract.
 */
const partsIn = (tz, at = new Date()) => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone(tz),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short'
  })

  const out = {}
  for (const { type, value } of fmt.formatToParts(at)) out[type] = value

  // Midnight comes back as hour "24" in some ICU versions
  const hour = Number(out.hour) % 24

  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour,
    minute: Number(out.minute),
    weekday: out.weekday
  }
}

/** The calendar date, 'YYYY-MM-DD', as it reads in `tz` right now. */
const todayIn = (tz, at = new Date()) => {
  const p = partsIn(tz, at)
  return `${p.year}-${p.month}-${p.day}`
}

/** The hour, 0-23, as it reads in `tz`. */
const hourIn = (tz, at = new Date()) => partsIn(tz, at).hour

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Day of the week in `tz`, 0 = Sunday, matching `Date#getDay`. */
const weekdayIn = (tz, at = new Date()) => WEEKDAY_INDEX[partsIn(tz, at).weekday]

/**
 * Shift a 'YYYY-MM-DD' string by whole days.
 *
 * Done in UTC on purpose: the string names a calendar day with no time in
 * it, so there is no zone to honour and no DST hour to lose.
 */
const addDays = (iso, n) => {
  if (!DATE_RE.test(iso)) throw new Error(`Not a YYYY-MM-DD date: ${iso}`)
  const d = new Date(`${iso}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

/** Whole days from `from` to `to`, both 'YYYY-MM-DD'. Negative if `to` is earlier. */
const daysBetween = (from, to) =>
  Math.round(
    (new Date(`${to}T00:00:00.000Z`) - new Date(`${from}T00:00:00.000Z`)) / 86_400_000
  )

/** Is this calendar date a Saturday or Sunday? */
const isWeekend = (iso) => {
  const day = new Date(`${iso}T00:00:00.000Z`).getUTCDay()
  return day === 0 || day === 6
}

/** The last `n` dates ending today in `tz`, oldest first. */
const lastNDates = (n, tz, at = new Date()) => {
  const end = todayIn(tz, at)
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)))
}

/**
 * The zone to use for a user.
 *
 * Everyone predates the timezone field, so an empty value is not a bug —
 * it means "never chose one", and UTC is the honest answer until they do.
 */
const zoneOf = (user) => safeZone(user?.timezone)

module.exports = {
  isValidTimezone,
  todayIn,
  hourIn,
  weekdayIn,
  addDays,
  daysBetween,
  isWeekend,
  lastNDates,
  zoneOf
}
