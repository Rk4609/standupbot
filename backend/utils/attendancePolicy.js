const { isWeekend, minuteOfDayIn } = require('./time')

/**
 * The working day, as the office sets it.
 *
 * Times are minutes since midnight on the person's own clock: a team split
 * between Pune and Berlin each start at ten where they are.
 */
const POLICY = {
  start: 10 * 60,
  graceMinutes: 15,
  fullDayMinutes: 8 * 60,
  halfDayMinutes: 4 * 60
}

const hhmm = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/**
 * What a row means.
 *
 *   working      checked in today and not out yet
 *   no-checkout  checked in on a day that is over, never checked out
 *   half-day     out, but worked less than half a day
 *   present      out after at least half a day
 *
 * `late` is separate from the state: somebody can be late and still work a
 * full day. Nobody is late on a weekend, or on a day they took half off.
 */
const readDay = (row, { today, halfDayLeave = false } = {}) => {
  const tz = row.timezone || 'UTC'
  const inAt = minuteOfDayIn(tz, new Date(row.checkIn))
  const lateBy = isWeekend(row.date) || halfDayLeave
    ? 0
    : Math.max(0, inAt - (POLICY.start + POLICY.graceMinutes))

  let minutes = null
  let state
  if (row.checkOut) {
    minutes = Math.max(0, Math.round((new Date(row.checkOut) - new Date(row.checkIn)) / 60_000))
    state = minutes < POLICY.halfDayMinutes && !halfDayLeave ? 'half-day' : 'present'
  } else {
    state = row.date < today ? 'no-checkout' : 'working'
  }

  return {
    _id: row._id,
    date: row.date,
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    timezone: tz,
    inAt: hhmm(inAt),
    outAt: row.checkOut ? hhmm(minuteOfDayIn(tz, new Date(row.checkOut))) : null,
    minutes,
    late: lateBy > 0,
    lateBy,
    state,
    note: row.note || '',
    corrected: row.corrected || null
  }
}

const policyForClient = () => ({
  start: hhmm(POLICY.start),
  graceMinutes: POLICY.graceMinutes,
  fullDayHours: POLICY.fullDayMinutes / 60,
  halfDayHours: POLICY.halfDayMinutes / 60
})

module.exports = { POLICY, hhmm, readDay, policyForClient }
