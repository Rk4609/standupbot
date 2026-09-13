/**
 * Keep a week of standups inside what the model will accept.
 *
 * The retro prompt listed every standup in the week, verbatim. That is fine
 * for six people and impossible for sixty: a full week across two teams came
 * to fifty thousand characters, and the request was refused before it was
 * ever read. A report that stops working once a team grows is not a report.
 *
 * So the week is condensed rather than truncated. Day-by-day detail is the
 * first thing to go, because a retrospective is about the shape of the week;
 * blockers are the last, because they are the part nobody can infer.
 */

/** Roughly four characters to a token, with room for the reply. */
const WORK_BUDGET = 12000
const FIELD_LIMIT = 200
const PLANS_PER_PERSON = 5

const clip = (text, limit = FIELD_LIMIT) => {
  const clean = String(text || '').trim().replace(/\s+/g, ' ')
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean
}

const asJson = (value) => JSON.stringify(value, null, 2)

/** Every standup, one entry each. What the prompt always used to send. */
const dayByDay = (standups) =>
  standups.map(s => ({
    member: s.user?.name || 'Unknown',
    date: s.date,
    ...(s.yesterday?.trim() ? { shipped: clip(s.yesterday) } : {}),
    planned: clip(s.today),
    ...(s.hasBlocker ? { blocker: clip(s.blockers) } : {}),
    mood: s.mood
  }))

/** One entry per person: what they worked on, what blocked them, how they felt. */
const byPerson = (standups, plansEach = PLANS_PER_PERSON) => {
  const people = new Map()

  for (const s of standups) {
    const name = s.user?.name || 'Unknown'
    if (!people.has(name)) {
      people.set(name, { member: name, days: 0, planned: [], blockers: [], moods: {} })
    }

    const p = people.get(name)
    p.days += 1
    if (p.planned.length < plansEach) p.planned.push(clip(s.today, 120))
    // Blockers are never dropped — they are the one thing a reader cannot
    // work out from anything else in the report
    if (s.hasBlocker) p.blockers.push(clip(s.blockers, 160))
    p.moods[s.mood] = (p.moods[s.mood] || 0) + 1
  }

  return [...people.values()]
}

/**
 * The week, as small as it needs to be.
 *
 * Returns the JSON to embed and a note saying what was left out, so the
 * prompt can tell the model it is not looking at everything.
 */
const condenseWeek = (standups) => {
  const daily = asJson(dayByDay(standups))
  if (daily.length <= WORK_BUDGET) {
    return { json: daily, note: '' }
  }

  const grouped = asJson(byPerson(standups))
  if (grouped.length <= WORK_BUDGET) {
    return {
      json: grouped,
      note: 'This week was too large to list day by day, so it is grouped by person. Every blocker is included; the plans are a sample of each person\'s week.'
    }
  }

  // A very large team: fewer plans each, blockers still kept in full
  const tight = asJson(byPerson(standups, 2))
  if (tight.length <= WORK_BUDGET) {
    return {
      json: tight,
      note: 'This week was large, so each person is summarised by two of their plans. Every blocker is included.'
    }
  }

  // Larger still — keep whole people rather than cutting one in half.
  // Measured on the serialised array each time: an entry costs more inside an
  // array than on its own, and estimating that was how this overran.
  const people = byPerson(standups, 1)
  const kept = []

  for (const p of people) {
    if (asJson([...kept, p]).length > WORK_BUDGET) break
    kept.push(p)
  }

  // One person whose week alone is bigger than the budget: keep them, with
  // only what cannot be inferred from anywhere else
  if (kept.length === 0 && people.length > 0) {
    const [first] = people
    kept.push({
      member: first.member,
      days: first.days,
      blockers: first.blockers.slice(0, 3)
    })
  }

  return {
    json: asJson(kept),
    note: `This week was too large to summarise in full. ${kept.length} of ${people.length} people are shown, one plan each. Report only on those, and say that the rest were not included.`
  }
}

module.exports = { condenseWeek, clip, WORK_BUDGET }
