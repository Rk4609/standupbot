import { afterEach, describe, expect, it } from 'vitest'
import {
  detectTimezone,
  isoDateIn,
  lastNDatesForUser,
  offsetLabel,
  timeIn,
  timezoneOptions,
  todayForUser
} from '../lib/timezone'

/** 2026-03-12T20:30:00Z — already the 13th in Delhi, still the 12th in London. */
const evening = new Date('2026-03-12T20:30:00.000Z')

const signIn = (timezone) =>
  localStorage.setItem(
    'standupbot_user',
    JSON.stringify({ name: 'Someone', token: 't', timezone })
  )

afterEach(() => {
  localStorage.clear()
})

describe('isoDateIn', () => {
  it('gives the date as it reads in the zone', () => {
    expect(isoDateIn('UTC', evening)).toBe('2026-03-12')
    expect(isoDateIn('Asia/Kolkata', evening)).toBe('2026-03-13')
    expect(isoDateIn('America/New_York', evening)).toBe('2026-03-12')
  })

  it('treats a missing zone as UTC', () => {
    expect(isoDateIn('', evening)).toBe('2026-03-12')
    expect(isoDateIn(undefined, evening)).toBe('2026-03-12')
  })
})

describe('todayForUser', () => {
  it('follows the signed-in account\'s zone', () => {
    signIn('Asia/Kolkata')
    expect(todayForUser(evening)).toBe('2026-03-13')
  })

  it('falls back to UTC — not the browser — when no zone is set', () => {
    // The server files an unset account under UTC. Using the browser's own
    // zone here would put the two out of step and the dashboard would report
    // a standup that was submitted as still missing.
    signIn('')
    expect(todayForUser(evening)).toBe('2026-03-12')
  })

  it('falls back to UTC when nobody is signed in', () => {
    expect(todayForUser(evening)).toBe('2026-03-12')
  })
})

describe('lastNDatesForUser', () => {
  it('ends on the account\'s today, oldest first', () => {
    signIn('Asia/Kolkata')
    const week = lastNDatesForUser(7, evening)

    expect(week).toHaveLength(7)
    expect(week.at(-1)).toBe('2026-03-13')
    expect(week[0]).toBe('2026-03-07')
    expect(week).toEqual([...week].sort())
  })

  it('crosses a month boundary without skipping a day', () => {
    signIn('UTC')
    const week = lastNDatesForUser(7, new Date('2026-03-02T12:00:00.000Z'))
    expect(week).toEqual([
      '2026-02-24',
      '2026-02-25',
      '2026-02-26',
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02'
    ])
  })
})

describe('detectTimezone', () => {
  it('returns a zone the server will accept, or nothing', () => {
    const tz = detectTimezone()
    expect(tz === '' || tz === 'UTC' || tz.includes('/')).toBe(true)
  })
})

describe('timezoneOptions', () => {
  it('always offers UTC and is free of duplicates', () => {
    const zones = timezoneOptions()
    expect(zones).toContain('UTC')
    expect(new Set(zones).size).toBe(zones.length)
  })

  it('is sorted, so the picker is scannable', () => {
    const zones = timezoneOptions()
    expect(zones).toEqual([...zones].sort())
  })
})

describe('labels', () => {
  it('shows the local clock', () => {
    expect(timeIn('UTC', evening)).toBe('20:30')
    expect(timeIn('Asia/Kolkata', evening)).toBe('02:00')
  })

  it('shows the offset as UTC±hh:mm rather than GMT', () => {
    expect(offsetLabel('Asia/Kolkata', evening)).toBe('UTC+05:30')
    expect(offsetLabel('UTC', evening)).toBe('UTC+00:00')
  })

  it('returns nothing rather than throwing on a bad zone', () => {
    expect(timeIn('Mars/Olympus_Mons', evening)).toBe('')
    expect(offsetLabel('Mars/Olympus_Mons', evening)).toBe('')
  })
})
