const Leave = require('../models/Leave')
const Standup = require('../models/Standup')
const { clip } = require('./promptBudget')
const { addDays } = require('./time')
const { isOffDay } = require('../services/settingsService')

/**
 * A week of a team's work, as its standups have it.
 *
 * This is the report somebody outside the team reads — a client, a director —
 * so it is about the work: what moved, what is stuck, what is next.
 * Moods, lateness and who was absent are left out on purpose; they belong in
 * the lead's own brief, not in a document that gets forwarded.
 */

const UPDATES_PER_PERSON = 5

/** Pure: the report's facts from the week's rows. */
const analyseWeek = ({ week, today, people, standups, leaves }) => {
  const nameOf = new Map(people.map(p => [String(p._id), p.name]))

  const lastDay = week.weekEnd < today ? week.weekEnd : today
  const workdays = []
  for (let day = week.weekStart; day <= lastDay; day = addDays(day, 1)) {
    if (!isOffDay(day)) workdays.push(day)
  }

  // What each person said they were on, day by day — the standup's plan is
  // the closest thing to a record of the work now that hours are not booked
  const byPerson = new Map(people.map(p => [String(p._id), { name: p.name, standups: 0, blocked: 0, updates: [] }]))
  let blockersRaised = 0

  for (const s of standups) {
    const person = byPerson.get(String(s.user))
    if (!person) continue
    person.standups += 1
    if (s.hasBlocker) {
      person.blocked += 1
      blockersRaised += 1
    }

    const text = clip(s.today || '', 140)
    if (text && person.updates.length < UPDATES_PER_PERSON && !person.updates.some(u => u.text === text)) {
      person.updates.push({ date: s.date, text })
    }
  }

  // Blockers still open: on the person's last standup of the week
  const lastOf = new Map()
  for (const s of standups) {
    const who = String(s.user)
    if (!nameOf.has(who)) continue
    if (!lastOf.has(who) || lastOf.get(who).date < s.date) lastOf.set(who, s)
  }
  const openBlockers = [...lastOf.entries()]
    .filter(([, s]) => s.hasBlocker)
    .map(([who, s]) => ({ name: nameOf.get(who), blocker: clip(s.blockers, 160), since: s.date }))

  const nextWeek = [...lastOf.entries()]
    .filter(([, s]) => s.today?.trim())
    .map(([who, s]) => ({ name: nameOf.get(who), plan: clip(s.today, 160) }))

  // Expected standups: every working day so far, less days on leave
  const leaveDays = new Map()
  let expected = 0
  for (const person of people) {
    const theirs = leaves.filter(l => String(l.user) === String(person._id))
    for (const day of workdays) {
      const off = theirs.find(l => l.from <= day && l.to >= day)
      if (off) {
        leaveDays.set(person.name, (leaveDays.get(person.name) || 0) + (off.halfDay ? 0.5 : 1))
        if (!off.halfDay) continue
      }
      expected += 1
    }
  }
  const submitted = standups.filter(s => nameOf.has(String(s.user)) && workdays.includes(s.date)).length

  return {
    week: { start: week.weekStart, end: week.weekEnd, label: week.weekLabel },
    people: people.length,
    standups: {
      submitted,
      expected,
      rate: expected ? Math.round((Math.min(submitted, expected) / expected) * 100) : 0
    },
    blockersRaised,
    team: [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name)),
    openBlockers,
    nextWeek,
    leave: {
      days: [...leaveDays.values()].reduce((n, d) => n + d, 0),
      people: [...leaveDays.entries()].map(([name, days]) => ({ name, days }))
    }
  }
}

/** Read the week's rows for these people and work out the facts. */
const collectWeekFacts = async ({ people, week, today }) => {
  const ids = people.map(p => p._id)

  const [standups, leaves] = await Promise.all([
    Standup.find({ user: { $in: ids }, date: { $gte: week.weekStart, $lte: week.weekEnd } })
      .select('user date today hasBlocker blockers')
      .sort({ date: 1 })
      .lean(),
    Leave.find({ user: { $in: ids }, status: 'approved', from: { $lte: week.weekEnd }, to: { $gte: week.weekStart } })
      .select('user from to halfDay').lean()
  ])

  return analyseWeek({ week, today, people, standups, leaves })
}

module.exports = { analyseWeek, collectWeekFacts }
