import { describe, expect, it } from 'vitest'
import { resolveWeek, previousWeek, mondayOf, isoWeekNumber } from '../utils/week.js'

/**
 * These are pure date helpers, but they decide which standups a retro reads,
 * so an off-by-one here silently produces a retro for the wrong week. The
 * seed script had exactly that bug by mixing local and UTC.
 */
describe('week helpers', () => {
  it('anchors a mid-week date to that week Mon-Fri', () => {
    // Wednesday 9 September 2026
    expect(resolveWeek(new Date('2026-09-09T12:00:00Z'))).toMatchObject({
      weekStart: '2026-09-07',
      weekEnd: '2026-09-11'
    })
  })

  it('treats Monday as the start of its own week, not the previous one', () => {
    expect(resolveWeek(new Date('2026-09-07T00:00:00Z')).weekStart).toBe('2026-09-07')
  })

  it('keeps Saturday and Sunday with the week that just ended', () => {
    expect(resolveWeek(new Date('2026-09-12T23:59:00Z')).weekStart).toBe('2026-09-07')
    expect(resolveWeek(new Date('2026-09-13T23:59:00Z')).weekStart).toBe('2026-09-07')
  })

  it('is stable across the whole day regardless of the hour', () => {
    const early = resolveWeek(new Date('2026-09-09T00:00:01Z')).weekStart
    const late = resolveWeek(new Date('2026-09-09T23:59:59Z')).weekStart
    expect(early).toBe(late)
  })

  it('steps back exactly one week', () => {
    expect(previousWeek(new Date('2026-09-09T12:00:00Z'))).toMatchObject({
      weekStart: '2026-08-31',
      weekEnd: '2026-09-04'
    })
  })

  it('labels a week that spans two months with both', () => {
    expect(resolveWeek(new Date('2026-10-01T12:00:00Z')).weekLabel).toContain('Sep 28')
    expect(resolveWeek(new Date('2026-10-01T12:00:00Z')).weekLabel).toContain('Oct 2')
  })

  it('labels a single-month week compactly', () => {
    expect(resolveWeek(new Date('2026-09-09T12:00:00Z')).weekLabel).toBe('Week 37 · Sep 7–11')
  })

  it('mondayOf returns UTC midnight', () => {
    const m = mondayOf(new Date('2026-09-09T18:30:00Z'))
    expect(m.toISOString()).toBe('2026-09-07T00:00:00.000Z')
  })

  it('numbers ISO weeks across a year boundary', () => {
    // 31 Dec 2026 is a Thursday, so it belongs to week 53 of 2026
    expect(isoWeekNumber(new Date('2026-12-31T12:00:00Z'))).toBe(53)
    expect(isoWeekNumber(new Date('2026-01-05T12:00:00Z'))).toBe(2)
  })
})
