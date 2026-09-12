import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  hourIn,
  isValidTimezone,
  isWeekend,
  lastNDates,
  todayIn,
  weekdayIn,
  zoneOf
} from '../utils/time.js'

/** 2026-03-12T20:30:00Z — already the 13th in Delhi, still the 12th in London. */
const evening = new Date('2026-03-12T20:30:00.000Z')

describe('todayIn', () => {
  it('gives the date as the person sees it, not as the server does', () => {
    expect(todayIn('UTC', evening)).toBe('2026-03-12')
    expect(todayIn('Asia/Kolkata', evening)).toBe('2026-03-13')
    expect(todayIn('America/Los_Angeles', evening)).toBe('2026-03-12')
  })

  it('rolls the date back for a zone behind UTC', () => {
    // 00:30 UTC on the 13th is still the evening of the 12th in New York
    const justAfterMidnight = new Date('2026-03-13T00:30:00.000Z')
    expect(todayIn('UTC', justAfterMidnight)).toBe('2026-03-13')
    expect(todayIn('America/New_York', justAfterMidnight)).toBe('2026-03-12')
  })

  it('treats an unknown zone as UTC rather than throwing', () => {
    // A stored zone going bad must not take a standup submission down with it
    expect(todayIn('Mars/Olympus_Mons', evening)).toBe('2026-03-12')
    expect(todayIn(undefined, evening)).toBe('2026-03-12')
    expect(todayIn('', evening)).toBe('2026-03-12')
  })

  it('reports midnight as the new day, not as hour 24 of the old one', () => {
    // 18:30 UTC is exactly midnight in Kolkata
    const midnightIST = new Date('2026-03-12T18:30:00.000Z')
    expect(todayIn('Asia/Kolkata', midnightIST)).toBe('2026-03-13')
    expect(hourIn('Asia/Kolkata', midnightIST)).toBe(0)
  })
})

describe('hourIn and weekdayIn', () => {
  it('reads the local hour', () => {
    expect(hourIn('UTC', evening)).toBe(20)
    expect(hourIn('Asia/Kolkata', evening)).toBe(2)
  })

  it('reads the local weekday, and can differ from UTC', () => {
    // Thursday evening in UTC is already Friday in Kolkata
    expect(weekdayIn('UTC', evening)).toBe(4)
    expect(weekdayIn('Asia/Kolkata', evening)).toBe(5)
  })

  it('survives a daylight-saving shift', () => {
    // London is UTC+1 in July and UTC+0 in January
    const july = new Date('2026-07-01T12:00:00.000Z')
    const january = new Date('2026-01-01T12:00:00.000Z')
    expect(hourIn('Europe/London', july)).toBe(13)
    expect(hourIn('Europe/London', january)).toBe(12)
  })
})

describe('addDays', () => {
  it('steps forward and back', () => {
    expect(addDays('2026-03-12', 1)).toBe('2026-03-13')
    expect(addDays('2026-03-12', -1)).toBe('2026-03-11')
  })

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
  })

  it('does not lose a day to a daylight-saving change', () => {
    // The clocks go forward in London on 29 March 2026
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
  })

  it('refuses anything that is not a calendar date', () => {
    expect(() => addDays('12/03/2026', 1)).toThrow(/YYYY-MM-DD/)
    expect(() => addDays('2026-03-12T00:00:00Z', 1)).toThrow(/YYYY-MM-DD/)
  })
})

describe('daysBetween, isWeekend and lastNDates', () => {
  it('counts whole days in either direction', () => {
    expect(daysBetween('2026-03-10', '2026-03-12')).toBe(2)
    expect(daysBetween('2026-03-12', '2026-03-10')).toBe(-2)
    expect(daysBetween('2026-03-12', '2026-03-12')).toBe(0)
  })

  it('knows the weekend', () => {
    expect(isWeekend('2026-03-14')).toBe(true) // Saturday
    expect(isWeekend('2026-03-15')).toBe(true) // Sunday
    expect(isWeekend('2026-03-13')).toBe(false) // Friday
  })

  it('ends the window on the caller\'s today, oldest first', () => {
    const week = lastNDates(7, 'Asia/Kolkata', evening)
    expect(week).toHaveLength(7)
    expect(week.at(-1)).toBe('2026-03-13')
    expect(week[0]).toBe('2026-03-07')
    expect(week).toEqual([...week].sort())
  })
})

describe('zoneOf', () => {
  it('falls back to UTC for an account that never chose one', () => {
    expect(zoneOf({ timezone: 'Asia/Kolkata' })).toBe('Asia/Kolkata')
    expect(zoneOf({ timezone: '' })).toBe('UTC')
    expect(zoneOf({})).toBe('UTC')
    expect(zoneOf(null)).toBe('UTC')
  })

  it('falls back rather than trusting a zone that no longer exists', () => {
    expect(zoneOf({ timezone: 'Europe/Atlantis' })).toBe('UTC')
  })
})

describe('isValidTimezone', () => {
  it('accepts real IANA names and rejects the rest', () => {
    expect(isValidTimezone('Asia/Kolkata')).toBe(true)
    expect(isValidTimezone('UTC')).toBe(true)
    expect(isValidTimezone('America/Argentina/Ushuaia')).toBe(true)
    expect(isValidTimezone('IST')).toBe(false)
    expect(isValidTimezone('')).toBe(false)
    expect(isValidTimezone(null)).toBe(false)
    expect(isValidTimezone(5)).toBe(false)
  })
})
