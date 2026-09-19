const Attendance = require('../models/Attendance')
const Leave = require('../models/Leave')
const Standup = require('../models/Standup')
const { readDay } = require('./attendancePolicy')
const { clip } = require('./promptBudget')
const { addDays } = require('./time')
const { isOffDay } = require('../services/settingsService')
const { collectWellbeing } = require('./wellbeing')

/**
 * What a lead should know about their team this morning, worked out from
 * the records rather than guessed by a model.
 *
 * The model only writes the brief from these facts. Every name and number in
 * it comes from here, and the page shows the same facts beside it, so a
 * sentence that sounds wrong can be checked against what it was written from.
 */

/** How far back "keeps happening" looks: two working weeks. */
const LOOKBACK_DAYS = 14
const STUCK_AFTER = 3
const LATE_OFTEN = 3
const LOW_MOODS = ['bad', 'stressed']

const workdaysBetween = (from, to) => {
  const days = []
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (!isOffDay(day)) days.push(day)
  }
  return days
}

/** The working day before `date`. */
const previousWorkday = (date) => {
  let day = addDays(date, -1)
  while (isOffDay(day)) day = addDays(day, -1)
  return day
}

/**
 * Pure: turn the raw rows into the brief's facts. Kept apart from the
 * queries so the rules can be tested without a database.
 */
const analyse = ({ people, date, today, standups, attendance, leaves, pendingLeave, wellbeing = new Map() }) => {
  const from = addDays(date, -LOOKBACK_DAYS)
  const window = workdaysBetween(from, date)
  const workday = !isOffDay(date)

  const group = (rows) => {
    const by = new Map()
    for (const row of rows) {
      const key = String(row.user?._id || row.user)
      if (!by.has(key)) by.set(key, [])
      by.get(key).push(row)
    }
    return by
  }
  const standupsBy = group(standups)
  const attendanceBy = group(attendance)
  const leavesBy = group(leaves)

  const offOn = (id, day) => (leavesBy.get(id) || []).find(l => l.from <= day && l.to >= day && !l.halfDay)

  const facts = {
    date,
    isToday: date === today,
    workday,
    people: people.length,
    standups: { submitted: 0, expected: 0, missing: [] },
    blockers: [],
    stuck: [],
    lowMood: [],
    missingOften: [],
    attendance: { in: 0, late: [], notIn: [], lateOften: [], noCheckout: [] },
    leave: { today: [], upcoming: [], pending: pendingLeave },
    // Only people showing two or more signs of strain: one on its own is
    // ordinary, and a lead's morning should not fill up with ordinary
    wellbeing: people
      .filter(p => wellbeing.get(String(p._id))?.level === 'check-in')
      .map(p => ({ name: p.name, signs: wellbeing.get(String(p._id)).signals.map(s => s.detail) })),
    goodNews: []
  }

  for (const person of people) {
    const id = String(person._id)
    const name = person.name
    const theirs = (standupsBy.get(id) || []).sort((a, b) => a.date.localeCompare(b.date))
    const onDay = theirs.find(s => s.date === date)
    const away = offOn(id, date)

    /* standups ------------------------------------------------------ */
    if (workday && !away) {
      facts.standups.expected += 1
      if (onDay) facts.standups.submitted += 1
      else facts.standups.missing.push(name)
    }

    if (onDay?.hasBlocker) {
      // How many standups in a row, ending today, carried a blocker
      let run = 0
      for (let i = theirs.length - 1; i >= 0 && theirs[i].hasBlocker; i--) run += 1
      const entry = { name, blocker: clip(onDay.blockers, 160), days: run }
      facts.blockers.push(entry)
      if (run >= STUCK_AFTER) facts.stuck.push(entry)
    }

    const lastThree = theirs.slice(-3)
    const low = lastThree.filter(s => LOW_MOODS.includes(s.mood)).length
    if (lastThree.length >= 2 && low >= 2) {
      facts.lowMood.push({ name, moods: lastThree.map(s => s.mood) })
    }

    // Missed standups, only once they had started filing them
    if (theirs.length > 0) {
      const since = theirs[0].date
      const lastFive = window.filter(d => d >= since && d < date && !offOn(id, d)).slice(-5)
      const filed = new Set(theirs.map(s => s.date))
      const missed = lastFive.filter(d => !filed.has(d)).length
      if (lastFive.length >= 3 && missed >= 3) facts.missingOften.push({ name, missed, of: lastFive.length })
    }

    /* attendance ---------------------------------------------------- */
    const rows = attendanceBy.get(id) || []
    const inToday = rows.find(r => r.date === date)
    if (inToday) {
      facts.attendance.in += 1
      const read = readDay(inToday, { today })
      if (read.late) facts.attendance.late.push({ name, lateBy: read.lateBy, inAt: read.inAt })
    } else if (workday && !away && rows.length > 0) {
      facts.attendance.notIn.push(name)
    }

    const lateDays = rows.filter(r => r.date >= from && r.date <= date && readDay(r, { today }).late).length
    if (lateDays >= LATE_OFTEN) facts.attendance.lateOften.push({ name, days: lateDays })

    const yesterday = previousWorkday(date)
    if (rows.some(r => r.date === yesterday && !r.checkOut)) facts.attendance.noCheckout.push(name)

    /* leave --------------------------------------------------------- */
    if (away) facts.leave.today.push({ name, type: away.type, until: away.to })
    const next = (leavesBy.get(id) || []).find(l => l.from > date && l.from <= addDays(date, 7))
    if (next) facts.leave.upcoming.push({ name, type: next.type, from: next.from, to: next.to })

    /* good news ----------------------------------------------------- */
    const cleared = theirs.length >= 2 && theirs[theirs.length - 2].hasBlocker && onDay && !onDay.hasBlocker
    if (cleared) facts.goodNews.push(`${name} is no longer blocked`)
  }

  const great = standups.filter(s => s.date === date && s.mood === 'great').length
  if (great >= 2) facts.goodNews.push(`${great} people feel great today`)
  if (facts.standups.expected > 0 && facts.standups.submitted === facts.standups.expected) {
    facts.goodNews.push('Everybody expected has filed their standup')
  }

  facts.stuck.sort((a, b) => b.days - a.days)
  facts.attendance.late.sort((a, b) => b.lateBy - a.lateBy)
  facts.attention = facts.stuck.length + facts.lowMood.length + facts.missingOften.length +
    facts.attendance.lateOften.length + facts.wellbeing.length

  return facts
}

/** Read the rows for `people` around `date` and work out the facts. */
const collectFacts = async ({ people, date, today }) => {
  const ids = people.map(p => p._id)
  const from = addDays(date, -LOOKBACK_DAYS)

  const [standups, attendance, leaves, pendingLeave, wellbeing] = await Promise.all([
    Standup.find({ user: { $in: ids }, date: { $gte: from, $lte: date } })
      .select('user date hasBlocker blockers mood').lean(),
    Attendance.find({ user: { $in: ids }, date: { $gte: from, $lte: date } })
      .select('user date checkIn checkOut timezone').lean(),
    Leave.find({ user: { $in: ids }, status: 'approved', from: { $lte: addDays(date, 7) }, to: { $gte: from } })
      .select('user type from to halfDay').lean(),
    Leave.countDocuments({ user: { $in: ids }, status: 'pending' }),
    collectWellbeing({ people, today: date })
  ])

  return analyse({ people, date, today, standups, attendance, leaves, pendingLeave, wellbeing })
}

module.exports = { analyse, collectFacts, LOOKBACK_DAYS, STUCK_AFTER, LATE_OFTEN }
