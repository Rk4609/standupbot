const Leave = require('../models/Leave')
const Project = require('../models/Project')
const Standup = require('../models/Standup')
const { clip } = require('./promptBudget')
const { addDays } = require('./time')
const { isOffDay } = require('../services/settingsService')

/**
 * A week of a team's work, by project, as the records have it.
 *
 * This is the report somebody outside the team reads — a client, a director —
 * so it is about the work: hours, what moved, what is stuck, what is next.
 * Moods, lateness and who was absent are left out on purpose; they belong in
 * the lead's own brief, not in a document that gets forwarded.
 */

const round = (n) => Math.round(n * 100) / 100
const NOTES_PER_PROJECT = 8

/** Pure: the report's facts from the week's rows. */
const analyseWeek = ({ week, today, people, standups, projects, leaves }) => {
  const nameOf = new Map(people.map(p => [String(p._id), p.name]))
  const projectOf = new Map(projects.map(p => [String(p._id), p]))

  const lastDay = week.weekEnd < today ? week.weekEnd : today
  const workdays = []
  for (let day = week.weekStart; day <= lastDay; day = addDays(day, 1)) {
    if (!isOffDay(day)) workdays.push(day)
  }

  const byProject = new Map()
  const byPerson = new Map(people.map(p => [String(p._id), { name: p.name, hours: 0, standups: 0, projects: new Set() }]))
  let total = 0
  let billable = 0

  for (const s of standups) {
    const who = String(s.user)
    const name = nameOf.get(who)
    if (!name) continue
    const person = byPerson.get(who)
    person.standups += 1

    for (const entry of s.work || []) {
      const project = projectOf.get(String(entry.project))
      if (!project) continue

      const key = String(project._id)
      if (!byProject.has(key)) {
        byProject.set(key, {
          name: project.name,
          code: project.code || '',
          client: project.client || '',
          billable: project.billable !== false,
          hours: 0,
          contributors: new Map(),
          notes: [],
          blockers: []
        })
      }
      const row = byProject.get(key)
      row.hours += entry.hours
      row.contributors.set(name, (row.contributors.get(name) || 0) + entry.hours)

      const note = clip(entry.note || '', 140)
      if (note && row.notes.length < NOTES_PER_PROJECT && !row.notes.some(n => n.note === note)) {
        row.notes.push({ name, date: s.date, note })
      }
      if (s.hasBlocker && !row.blockers.some(b => b.name === name)) {
        row.blockers.push({ name, date: s.date, blocker: clip(s.blockers, 140) })
      }

      total += entry.hours
      if (row.billable) billable += entry.hours
      person.hours += entry.hours
      person.projects.add(project.name)
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
    hours: {
      total: round(total),
      billable: round(billable),
      nonBillable: round(total - billable),
      billablePercent: total ? Math.round((billable / total) * 100) : 0
    },
    standups: {
      submitted,
      expected,
      rate: expected ? Math.round((Math.min(submitted, expected) / expected) * 100) : 0
    },
    projects: [...byProject.values()]
      .map(p => ({
        ...p,
        hours: round(p.hours),
        share: total ? Math.round((p.hours / total) * 100) : 0,
        contributors: [...p.contributors.entries()]
          .map(([name, hours]) => ({ name, hours: round(hours) }))
          .sort((a, b) => b.hours - a.hours)
      }))
      .sort((a, b) => b.hours - a.hours),
    team: [...byPerson.values()]
      .map(p => ({ name: p.name, hours: round(p.hours), standups: p.standups, projects: [...p.projects] }))
      .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name)),
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
      .select('user date today hasBlocker blockers work')
      .sort({ date: 1 })
      .lean(),
    Leave.find({ user: { $in: ids }, status: 'approved', from: { $lte: week.weekEnd }, to: { $gte: week.weekStart } })
      .select('user from to halfDay').lean()
  ])

  const projectIds = [...new Set(standups.flatMap(s => (s.work || []).map(w => String(w.project))))]
  const projects = projectIds.length
    ? await Project.find({ _id: { $in: projectIds } }).select('name code client billable').lean()
    : []

  return analyseWeek({ week, today, people, standups, projects, leaves })
}

module.exports = { analyseWeek, collectWeekFacts }
