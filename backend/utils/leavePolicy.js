const { addDays, daysBetween, isWeekend } = require('./time')

/**
 * How much time off a person has in a calendar year, by kind.
 *
 * `null` means no limit: unpaid leave is still asked for and approved, it
 * just does not run out.
 */
const ALLOWANCE = {
  casual: 12,
  sick: 8,
  earned: 15,
  unpaid: null
}

/** The longest single request, so a typo in the year is caught, not approved. */
const MAX_SPAN_DAYS = 60

/** Working days from `from` to `to` inclusive; a half day costs half. */
const workingDays = (from, to, halfDay = false) => {
  if (halfDay) return isWeekend(from) ? 0 : 0.5

  let count = 0
  const span = daysBetween(from, to)
  for (let i = 0; i <= span; i++) {
    if (!isWeekend(addDays(from, i))) count += 1
  }
  return count
}

/**
 * What is left of each kind this year.
 *
 * Counted by the year a request starts in. Pending requests are held against
 * the balance as well, so two requests sent back to back cannot both fit in
 * the same last three days.
 */
const balanceFor = (requests, year) => {
  const inYear = requests.filter(r => r.from.startsWith(`${year}-`))

  return Object.entries(ALLOWANCE).map(([type, allowance]) => {
    const sum = (status) => inYear
      .filter(r => r.type === type && r.status === status)
      .reduce((total, r) => total + r.days, 0)

    const used = sum('approved')
    const pending = sum('pending')

    return {
      type,
      allowance,
      used,
      pending,
      remaining: allowance === null ? null : Math.max(0, allowance - used - pending)
    }
  })
}

module.exports = { ALLOWANCE, MAX_SPAN_DAYS, workingDays, balanceFor }
