import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Notification from '../models/Notification.js'
import { invalidate } from '../services/roleService.js'
import { nextOccurrence, upcomingCelebrations } from '../utils/celebrations.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

beforeEach(() => {
  invalidate()
  // Thursday 17 September 2026, midday UTC
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-17T12:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

const TODAY = '2026-09-17'

describe('working out the days', () => {
  it('finds the next birthday, rolling into next year once it has passed', () => {
    expect(nextOccurrence(new Date('1995-09-20'), TODAY)).toBe('2026-09-20')
    expect(nextOccurrence(new Date('1995-03-02'), TODAY)).toBe('2027-03-02')
    expect(nextOccurrence(new Date('1995-09-17'), TODAY)).toBe('2026-09-17')
  })

  it('celebrates a 29 February birthday on the 28th in other years', () => {
    expect(nextOccurrence(new Date('2000-02-29'), '2027-02-01')).toBe('2027-02-28')
    expect(nextOccurrence(new Date('2000-02-29'), '2028-02-01')).toBe('2028-02-29')
  })

  it('lists the week ahead, soonest first, with anniversaries only from a full year', () => {
    const people = [
      { _id: 'a', name: 'Asha', dob: new Date('1996-09-19') },
      { _id: 'b', name: 'Bela', employment: { joinedOn: new Date('2023-09-17') } },
      { _id: 'c', name: 'Chirag', employment: { joinedOn: new Date('2026-09-18') } },
      { _id: 'd', name: 'Dev', dob: new Date('1990-10-30') }
    ]

    const found = upcomingCelebrations(people, TODAY, 7)

    expect(found.map(f => [f.person.name, f.kind, f.inDays, f.years])).toEqual([
      ['Bela', 'anniversary', 0, 3],
      ['Asha', 'birthday', 2, undefined]
    ])
  })
})

describe('on the dashboard', () => {
  const crew = async () => {
    const manager = await makeUser({ role: 'manager', name: 'Deepak' })
    const team = await makeTeam(manager)
    const asha = await joinTeam(await makeUser({ name: 'Asha', dob: new Date('1996-09-17') }), team)
    const bela = await joinTeam(await makeUser({ name: 'Bela', employment: { joinedOn: new Date('2024-09-20') } }), team)
    return { manager, team, asha, bela }
  }

  it('shows the team\'s days this week, without anybody\'s birth year', async () => {
    const { bela } = await crew()
    const other = await crew()

    const res = await request(app).get('/api/celebrations').set(...authHeader(bela))

    expect(res.status).toBe(200)
    expect(res.body.celebrations.map(c => [c.user.name, c.kind, c.inDays])).toEqual([
      ['Asha', 'birthday', 0],
      ['Bela', 'anniversary', 3]
    ])
    expect(res.body.celebrations.find(c => c.kind === 'anniversary')).toMatchObject({ years: 2, isMe: true })
    expect(JSON.stringify(res.body)).not.toMatch(/1996/)
    expect(res.body.celebrations.map(c => c.user._id)).not.toContain(String(other.asha._id))
  })

  it('sends a wish on the day, once, and tells the person', async () => {
    const { asha, bela } = await crew()
    const wish = () => request(app).post('/api/celebrations/wish').set(...authHeader(bela))
      .send({ to: String(asha._id), kind: 'birthday', message: 'Have a great one!' })

    expect((await wish()).status).toBe(201)
    expect((await wish()).status).toBe(409)

    const note = await Notification.findOne({ recipient: asha._id, type: 'celebration_wish' }).lean()
    expect(note.message).toBe('Bela wished you a happy birthday 🎂: “Have a great one!”')

    const list = await request(app).get('/api/celebrations').set(...authHeader(bela))
    expect(list.body.celebrations.find(c => c.kind === 'birthday').wished).toBe(true)
  })

  it('does not send a wish before the day, to yourself, or to another team', async () => {
    const { asha, bela } = await crew()
    const other = await crew()
    const send = (from, to, kind) => request(app).post('/api/celebrations/wish').set(...authHeader(from)).send({ to: String(to._id), kind })

    expect((await send(asha, bela, 'anniversary')).status).toBe(400)
    expect((await send(asha, asha, 'birthday')).status).toBe(400)
    expect((await send(other.bela, asha, 'birthday')).status).toBe(400)
  })
})
