/** Shared between the personal timesheet and the manager's review of it. */

export const STATUS_TONE = {
  draft: 'neutral',
  submitted: 'info',
  approved: 'positive',
  changes_requested: 'warning'
}

export const STATUS_LABEL = {
  draft: 'Not submitted',
  submitted: 'Waiting for review',
  approved: 'Approved',
  changes_requested: 'Changes requested'
}

/**
 * Shift a Monday by whole weeks.
 *
 * Done in UTC on a 'YYYY-MM-DD' string: the date names a calendar day with no
 * time in it, so there is no zone to honour and no DST hour to lose.
 */
export const shiftWeek = (weekStart, weeks) => {
  const d = new Date(`${weekStart}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  return d.toISOString().split('T')[0]
}
