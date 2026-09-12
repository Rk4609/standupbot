/**
 * Week helpers.
 *
 * Standup dates are stored as 'YYYY-MM-DD' strings derived from UTC, so every
 * calculation here stays in UTC — mixing in local time would shift week
 * boundaries for anyone east or west of the server.
 */

const MS_PER_DAY = 86_400_000

const toISODate = (d) => d.toISOString().split('T')[0]

/** Monday 00:00 UTC of the week containing `date`. */
const mondayOf = (date) => {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay() // 0 = Sunday
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day))
  return d
}

/** ISO-8601 week number. */
const isoWeekNumber = (date) => {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  // Thursday of this week decides which year/week it belongs to
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / MS_PER_DAY + 1) / 7)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Resolve a working week (Mon-Fri) from any date inside it.
 * Returns ISO date strings plus a human label like "Week 37 · Sep 8–12".
 */
const resolveWeek = (anyDate = new Date()) => {
  const monday = mondayOf(anyDate)
  const friday = new Date(monday.getTime() + 4 * MS_PER_DAY)

  const sameMonth = monday.getUTCMonth() === friday.getUTCMonth()
  const range = sameMonth
    ? `${MONTHS[monday.getUTCMonth()]} ${monday.getUTCDate()}–${friday.getUTCDate()}`
    : `${MONTHS[monday.getUTCMonth()]} ${monday.getUTCDate()} – ` +
      `${MONTHS[friday.getUTCMonth()]} ${friday.getUTCDate()}`

  return {
    weekStart: toISODate(monday),
    weekEnd: toISODate(friday),
    weekLabel: `Week ${isoWeekNumber(monday)} · ${range}`
  }
}

/** The Mon-Fri week immediately before the one containing `anyDate`. */
const previousWeek = (anyDate = new Date()) =>
  resolveWeek(new Date(mondayOf(anyDate).getTime() - 7 * MS_PER_DAY))

module.exports = { resolveWeek, previousWeek, mondayOf, isoWeekNumber, toISODate }
