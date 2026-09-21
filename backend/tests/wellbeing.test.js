import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Attendance from '../models/Attendance.js'
import { invalidate } from '../services/roleService.js'
import { analyseWellbeing } from '../utils/wellbeing.js'
import { analyse } from '../utils/briefFacts.js'
import { addDays, todayIn } from '../utils/time.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

beforeEach(() => {
  invalidate()
})

// Thursday 17 September 2026
const TODAY = '2026-09-17'
const asha = { _id: 'a', name: 'Asha', employment: { joinedOn: new Date('2025-01-06') } }

const day = (date, inAt, outAt) => ({
  user: 'a', date, timezone: 'UTC',
  checkIn: new Date(`${date}T${inAt}:00.000Z`),
  checkOut: outAt ? new Date(`${date}T${outAt}:00.000Z`) : null
})

const standup = (date, over = {}) => ({ user: 'a', date, mood: 'good', hasBlocker: false, ...over })

const signalsFor = (rows) => analyseWellbeing({
  people: [asha],
  today: TODAY,
  attendance: [],
  standups: [],
  leaves: [{ user: 'a', from: '2026-08-10', to: '2026-08-12' }],
  ...rows
}).get('a')

describe('signs of strain', () => {
  it('sees nothing in an ordinary month', () => {
    const attendance = ['2026-09-14', '2026-09-15', '2026-09-16'].map(d => day(d, '09:55', '18:30'))
    expect(signalsFor({ attendance })).toBeUndefined()
  })

  it('notices four long days in two weeks', () => {
    const attendance = ['2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15'].map(d => day(d, '09:00', '19:45'))
    expect(signalsFor({ attendance }).signals).toEqual([
      { kind: 'long-days', detail: '4 days over 9½ hours in two weeks' }
    ])
  })

  it('notices weekends worked, from check-ins', () => {
    const signals = signalsFor({
      attendance: [day('2026-09-06', '11:00', '15:00'), day('2026-09-12', '11:00', '15:00')]
    }).signals
    expect(signals).toContainEqual({ kind: 'weekends', detail: 'Worked 2 weekend days this month' })
  })

  it('notices a week of more than fifty hours worked', () => {
    const attendance = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']
      .map(d => day(d, '08:00', '18:30'))
    expect(signalsFor({ attendance }).signals).toContainEqual({
      kind: 'heavy-week', detail: '52.5h worked in the week of 2026-09-07'
    })
  })

  it('notices moods that stay low, and a mood that drops', () => {
    const low = ['2026-09-11', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17']
      .map((d, i) => standup(d, { mood: i < 3 ? 'stressed' : 'okay' }))
    expect(signalsFor({ standups: low }).signals[0].kind).toBe('mood')

    const dropping = [
      ...['2026-09-03', '2026-09-04', '2026-09-07', '2026-09-08', '2026-09-09'].map(d => standup(d, { mood: 'great' })),
      ...['2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15', '2026-09-16'].map(d => standup(d, { mood: 'okay' }))
    ]
    expect(signalsFor({ standups: dropping }).signals).toEqual([
      { kind: 'mood', detail: 'Mood noticeably lower than the week before' }
    ])
  })

  it('notices a long stretch without leave, counted from joining when there was none', () => {
    const none = analyseWellbeing({ people: [asha], today: TODAY, attendance: [], standups: [], leaves: [] }).get('a')
    expect(none.signals[0]).toMatchObject({ kind: 'no-break' })
    expect(none.signals[0].detail).toMatch(/No leave since joining \d+ days ago/)

    const newcomer = { ...asha, employment: { joinedOn: new Date('2026-08-01') } }
    expect(analyseWellbeing({ people: [newcomer], today: TODAY, attendance: [], standups: [], leaves: [] }).get('a')).toBeUndefined()
  })

  it('asks for a check-in only when two or more signs come together', () => {
    const attendance = ['2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15'].map(d => day(d, '09:00', '19:45'))
    const one = signalsFor({ attendance })
    const two = signalsFor({ attendance, leaves: [] })

    expect(one.level).toBe('watch')
    expect(two.level).toBe('check-in')
  })

  it('puts only check-ins in the morning brief, and counts them as needing attention', () => {
    const wellbeing = new Map([
      ['a', { level: 'check-in', signals: [{ detail: 'Worked 3 weekend days this month' }, { detail: 'No leave in 140 days' }] }],
      ['b', { level: 'watch', signals: [{ detail: 'No leave in 95 days' }] }]
    ])
    const facts = analyse({
      people: [{ _id: 'a', name: 'Asha' }, { _id: 'b', name: 'Bela' }],
      date: TODAY, today: TODAY, standups: [], attendance: [], leaves: [], pendingLeave: 0, wellbeing
    })

    expect(facts.wellbeing).toEqual([{ name: 'Asha', signs: ['Worked 3 weekend days this month', 'No leave in 140 days'] }])
    expect(facts.attention).toBe(1)
  })
})

describe('on the employees list', () => {
  it('shows a lead the signs beside the person', async () => {
    const manager = await makeUser({ role: 'manager' })
    const team = await makeTeam(manager)
    const tired = await joinTeam(await makeUser({ name: 'Tired Person', employment: { joinedOn: new Date('2024-01-01') } }), team)
    const today = todayIn('UTC')
    for (let i = 1; i <= 6; i++) {
      const date = addDays(today, -i)
      await Attendance.create({
        user: tired._id, date, timezone: 'UTC',
        checkIn: new Date(`${date}T08:00:00.000Z`), checkOut: new Date(`${date}T19:30:00.000Z`)
      })
    }

    const res = await request(app).get('/api/employees').set(...authHeader(manager))

    const row = res.body.employees.find(e => e.name === 'Tired Person')
    expect(row.wellbeing.level).toBe('check-in')
    expect(row.wellbeing.signals.map(s => s.kind)).toEqual(expect.arrayContaining(['long-days', 'no-break']))
  })
})
