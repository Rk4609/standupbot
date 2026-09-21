const Attendance = require('../models/Attendance')
const Leave = require('../models/Leave')
const Standup = require('../models/Standup')
const { readDay } = require('./attendancePolicy')
const { addDays, daysBetween, isWeekend } = require('./time')
const { mondayOf, toISODate } = require('./week')

/**
 * Signs that somebody may be carrying too much, for their lead only.
 *
 * None of these means anything alone — a long day before a release is
 * normal. What is worth a friendly conversation is several at once, which is
 * why a person is only flagged for a check-in at two or more. The words are
 * about what happened ("five long days"), never about the person ("burnt
 * out"): this is a prompt to ask, not a verdict.
 */
const LONG_DAY_MINUTES = 570 // nine and a half hours
const LONG_DAYS = 4 // in the last two weeks
const WEEKEND_DAYS = 2 // in the last four weeks
const HEAVY_WEEK_HOURS = 50
const LOW_MOODS = ['bad', 'stressed']
const MOOD_SCORE = { great: 5, good: 4, okay: 3, bad: 2, stressed: 1 }
const BLOCKED_RUN = 5
const NO_BREAK_DAYS = 90
const WINDOW_DAYS = 28

const hoursLabel = (n) => `${Math.round(n * 10) / 10}h`

/** Pure: each person's signals from their recent rows. */
const analyseWellbeing = ({ people, today, attendance, standups, leaves }) => {
  const twoWeeksAgo = addDays(today, -14)
  const monthAgo = addDays(today, -WINDOW_DAYS)
  const result = new Map()

  for (const person of people) {
    const id = String(person._id)
    const rows = attendance.filter(r => String(r.user) === id)
    const theirs = standups.filter(s => String(s.user) === id).sort((a, b) => a.date.localeCompare(b.date))
    const signals = []

    /* long days ------------------------------------------------------ */
    const long = rows
      .filter(r => r.date >= twoWeeksAgo && r.date <= today && r.checkOut)
      .map(r => readDay(r, { today }))
      .filter(d => d.minutes >= LONG_DAY_MINUTES)
    if (long.length >= LONG_DAYS) {
      signals.push({ kind: 'long-days', detail: `${long.length} days over 9½ hours in two weeks` })
    }

    /* weekends ------------------------------------------------------- */
    const weekendDays = new Set(rows.filter(r => r.date >= monthAgo && isWeekend(r.date)).map(r => r.date))
    if (weekendDays.size >= WEEKEND_DAYS) {
      signals.push({ kind: 'weekends', detail: `Worked ${weekendDays.size} weekend days this month` })
    }

    /* heavy weeks ---------------------------------------------------- */
    // From check-in to check-out, so only days somebody closed count
    const byWeek = new Map()
    for (const r of rows.filter(x => x.date >= twoWeeksAgo && x.date <= today && x.checkOut)) {
      const week = toISODate(mondayOf(new Date(`${r.date}T12:00:00.000Z`)))
      byWeek.set(week, (byWeek.get(week) || 0) + readDay(r, { today }).minutes / 60)
    }
    const heaviest = [...byWeek.entries()].sort((a, b) => b[1] - a[1])[0]
    if (heaviest && heaviest[1] > HEAVY_WEEK_HOURS) {
      signals.push({ kind: 'heavy-week', detail: `${hoursLabel(heaviest[1])} worked in the week of ${heaviest[0]}` })
    }

    /* mood ----------------------------------------------------------- */
    const lastFive = theirs.slice(-5)
    const previousFive = theirs.slice(-10, -5)
    const low = lastFive.filter(s => LOW_MOODS.includes(s.mood)).length
    const average = (list) => list.reduce((n, s) => n + (MOOD_SCORE[s.mood] || 3), 0) / list.length
    if (lastFive.length >= 3 && low >= 3) {
      signals.push({ kind: 'mood', detail: `${low} of the last ${lastFive.length} moods bad or stressed` })
    } else if (lastFive.length === 5 && previousFive.length === 5 && average(previousFive) - average(lastFive) >= 1) {
      signals.push({ kind: 'mood', detail: 'Mood noticeably lower than the week before' })
    }

    /* a blocker that will not move ----------------------------------- */
    let run = 0
    for (let i = theirs.length - 1; i >= 0 && theirs[i].hasBlocker; i--) run += 1
    if (run >= BLOCKED_RUN) {
      signals.push({ kind: 'blocked', detail: `Blocked ${run} standups running` })
    }

    /* no break ------------------------------------------------------- */
    const joined = person.employment?.joinedOn
      ? new Date(person.employment.joinedOn).toISOString().slice(0, 10)
      : person.createdAt ? new Date(person.createdAt).toISOString().slice(0, 10) : null
    const lastLeave = leaves
      .filter(l => String(l.user) === id && l.from <= today)
      .reduce((latest, l) => (l.to > latest ? l.to : latest), '')
    const since = [joined, lastLeave].filter(Boolean).sort().pop()
    if (since && joined && daysBetween(joined, today) >= NO_BREAK_DAYS) {
      const gap = daysBetween(since, today)
      if (gap >= NO_BREAK_DAYS) {
        signals.push({ kind: 'no-break', detail: lastLeave ? `No leave in ${gap} days` : `No leave since joining ${gap} days ago` })
      }
    }

    if (signals.length > 0) {
      result.set(id, { level: signals.length >= 2 ? 'check-in' : 'watch', signals })
    }
  }

  return result
}

/** Read what the signals need for these people, and work them out. */
const collectWellbeing = async ({ people, today }) => {
  const ids = people.map(p => p._id)
  if (ids.length === 0) return new Map()
  const monthAgo = addDays(today, -WINDOW_DAYS)

  const [attendance, standups, leaves] = await Promise.all([
    Attendance.find({ user: { $in: ids }, date: { $gte: monthAgo, $lte: today } })
      .select('user date checkIn checkOut timezone').lean(),
    Standup.find({ user: { $in: ids }, date: { $gte: monthAgo, $lte: today } })
      .select('user date mood hasBlocker').lean(),
    // Only the latest end date matters, so a year back is plenty
    Leave.find({ user: { $in: ids }, status: 'approved', to: { $gte: addDays(today, -365) } })
      .select('user from to').lean()
  ])

  return analyseWellbeing({ people, today, attendance, standups, leaves })
}

module.exports = { analyseWellbeing, collectWellbeing, NO_BREAK_DAYS, LONG_DAY_MINUTES }
