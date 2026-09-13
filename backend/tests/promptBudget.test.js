import { describe, expect, it } from 'vitest'
import { condenseWeek, clip, WORK_BUDGET } from '../utils/promptBudget.js'

/** A week of standups for `people` people, five days each. */
const makeWeek = (people, { text = 'Worked on the checkout flow', blockers = 0 } = {}) => {
  const out = []
  for (let p = 0; p < people; p++) {
    for (let d = 0; d < 5; d++) {
      const blocked = p < blockers && d === 0
      out.push({
        user: { name: `Person ${p}` },
        date: `2026-06-0${d + 1}`,
        yesterday: `${text} yesterday`,
        today: `${text} today`,
        hasBlocker: blocked,
        blockers: blocked ? `Person ${p} is waiting on the staging credentials` : 'None',
        mood: 'good'
      })
    }
  }
  return out
}

describe('clip', () => {
  it('shortens long text and says it did', () => {
    const long = 'x'.repeat(500)
    expect(clip(long, 100)).toHaveLength(100)
    expect(clip(long, 100).endsWith('…')).toBe(true)
  })

  it('collapses the whitespace that inflates a prompt', () => {
    expect(clip('a\n\n   b   \n c')).toBe('a b c')
  })

  it('handles nothing at all', () => {
    expect(clip(undefined)).toBe('')
    expect(clip('')).toBe('')
  })
})

describe('condenseWeek', () => {
  it('sends a small week exactly as it is, day by day', () => {
    const { json, note } = condenseWeek(makeWeek(4))

    expect(note).toBe('')
    const parsed = JSON.parse(json)
    expect(parsed).toHaveLength(20)
    expect(parsed[0]).toHaveProperty('date')
  })

  it('groups a big week by person rather than refusing to send it', () => {
    // Two full teams is what broke this: the request was rejected before the
    // model ever read it
    const { json, note } = condenseWeek(makeWeek(20))

    expect(json.length).toBeLessThanOrEqual(WORK_BUDGET)
    expect(note).toMatch(/grouped by person/i)

    const parsed = JSON.parse(json)
    expect(parsed[0]).toHaveProperty('member')
    expect(parsed[0]).toHaveProperty('days')
  })

  it('condenses further rather than overrunning, however many people there are', () => {
    for (const people of [20, 60, 200, 400]) {
      const { json } = condenseWeek(makeWeek(people))
      expect(json.length, `${people} people`).toBeLessThanOrEqual(WORK_BUDGET)
      // Whatever is sent has to be readable as JSON
      expect(() => JSON.parse(json)).not.toThrow()
    }
  })

  it('keeps every blocker even when it drops the detail around them', () => {
    const { json } = condenseWeek(makeWeek(60, { blockers: 12 }))

    const parsed = JSON.parse(json)
    const withBlockers = parsed.filter(p => p.blockers?.length > 0)

    // Blockers are the one thing a reader cannot work out from anything else
    expect(withBlockers).toHaveLength(12)
    expect(withBlockers[0].blockers[0]).toMatch(/staging credentials/)
  })

  it('stays inside the budget however long the entries are', () => {
    const wordy = makeWeek(80, { text: 'a very long description '.repeat(40) })
    const { json, note } = condenseWeek(wordy)

    expect(json.length).toBeLessThanOrEqual(WORK_BUDGET)
    expect(note).not.toBe('')
  })

  it('keeps whole people rather than cutting one in half', () => {
    const { json, note } = condenseWeek(makeWeek(400))

    const parsed = JSON.parse(json)
    expect(json.length).toBeLessThanOrEqual(WORK_BUDGET)
    // Every entry that made it is complete
    for (const p of parsed) {
      expect(p).toHaveProperty('member')
      expect(p).toHaveProperty('days')
    }
    // And the report is told not to claim it covered everybody
    expect(note).toMatch(/not included/i)
  })

  it('copes with a week that has nothing in it', () => {
    const { json, note } = condenseWeek([])

    expect(JSON.parse(json)).toEqual([])
    expect(note).toBe('')
  })
})
