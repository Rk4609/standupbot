const { addDays, daysBetween } = require('./time')

/**
 * Birthdays and work anniversaries coming up, from dates already on record.
 *
 * Only the day and month of a birthday are ever used or returned — the year
 * somebody was born is nobody's business on a dashboard. Somebody born on
 * 29 February is celebrated on the 28th in other years.
 */

const isLeap = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

/** The calendar day in `year` that falls on this month and day. */
const onYear = (year, month, day) => {
  const d = month === 2 && day === 29 && !isLeap(year) ? 28 : day
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** The next time (today included) that a date's month and day come round. */
const nextOccurrence = (date, today) => {
  const d = new Date(date)
  const month = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  const year = Number(today.slice(0, 4))
  const thisYear = onYear(year, month, day)
  return thisYear >= today ? thisYear : onYear(year + 1, month, day)
}

/**
 * Everything from today to `days` ahead, soonest first.
 *
 * A work anniversary counts from one full year: somebody who joined last
 * month has not had one yet, and their joining day this year is not one.
 */
const upcomingCelebrations = (people, today, days = 7) => {
  const last = addDays(today, days)
  const found = []

  for (const person of people) {
    if (person.dob) {
      const on = nextOccurrence(person.dob, today)
      if (on <= last) found.push({ person, kind: 'birthday', date: on, inDays: daysBetween(today, on) })
    }

    const joined = person.employment?.joinedOn
    if (joined) {
      const on = nextOccurrence(joined, today)
      const years = Number(on.slice(0, 4)) - new Date(joined).getUTCFullYear()
      if (years >= 1 && on <= last) {
        found.push({ person, kind: 'anniversary', date: on, inDays: daysBetween(today, on), years })
      }
    }
  }

  return found.sort((a, b) => a.inDays - b.inDays || a.person.name.localeCompare(b.person.name))
}

module.exports = { upcomingCelebrations, nextOccurrence }
