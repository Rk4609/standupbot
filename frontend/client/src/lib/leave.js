/** Words and colours for leave, shared by the request, approval and calendar views. */

export const TYPE_LABEL = {
  casual: 'Casual',
  sick: 'Sick',
  earned: 'Earned',
  unpaid: 'Unpaid'
}

/** One colour per kind, so the calendar reads at a glance. */
export const TYPE_DOT = {
  casual: 'bg-sky-500',
  sick: 'bg-red-500',
  earned: 'bg-emerald-500',
  unpaid: 'bg-content-subtle'
}

export const STATUS_LABEL = {
  pending: 'Waiting',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled'
}

export const STATUS_TONE = {
  pending: 'warning',
  approved: 'positive',
  rejected: 'danger',
  cancelled: 'neutral'
}

export const dayWord = (n) => `${n} ${n === 1 ? 'day' : 'days'}`

const asUtc = (iso) => new Date(`${iso}T00:00:00.000Z`)

const DAY_FORMAT = { day: 'numeric', month: 'short', timeZone: 'UTC' }

/** "18 Sep" — a calendar day, read without shifting it into a time zone. */
export const shortDay = (iso) =>
  asUtc(iso).toLocaleDateString(undefined, DAY_FORMAT)

/**
 * "18 Sep", "18–22 Sep" or "29 Sep – 2 Oct", in the order the reader's
 * locale writes them — joining the parts by hand gave "28–Sep 30" in English.
 */
export const dayRange = (from, to) => {
  if (!to || from === to) return shortDay(from)
  return new Intl.DateTimeFormat(undefined, DAY_FORMAT).formatRange(asUtc(from), asUtc(to))
}

/** Shift a 'YYYY-MM-DD' by whole days. */
export const addDays = (iso, n) => {
  const d = asUtc(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const isWeekend = (iso) => [0, 6].includes(asUtc(iso).getUTCDay())

/** Working days a request costs — the same count the server makes. */
export const workingDays = (from, to, halfDay = false, holidays = []) => {
  if (!from) return 0
  const off = (day) => isWeekend(day) || holidays.some(h => h.date === day)
  if (halfDay) return off(from) ? 0 : 0.5
  if (!to || to < from) return 0
  let count = 0
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (!off(day)) count += 1
  }
  return count
}
