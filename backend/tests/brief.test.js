import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import DailyBrief from '../models/DailyBrief.js'
import { invalidate } from '../services/roleService.js'
import { analyse } from '../utils/briefFacts.js'
import { buildPrompt } from '../controllers/briefController.js'
import { authHeader, joinTeam, makeStandup, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

beforeEach(() => {
  invalidate()
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.GROQ_API_KEY
})

const person = (id, name) => ({ _id: id, name })
const standup = (user, date, over = {}) => ({ user, date, hasBlocker: false, blockers: 'None', mood: 'good', ...over })

// Thursday 17 September 2026, and the working days before it
const DAY = '2026-09-17'

describe('working out the facts', () => {
  it('names who has not filed, leaving out people on leave', () => {
    const facts = analyse({
      people: [person('a', 'Asha'), person('b', 'Bela'), person('c', 'Chirag')],
      date: DAY,
      today: DAY,
      standups: [standup('a', DAY)],
      attendance: [],
      leaves: [{ user: 'c', type: 'sick', from: DAY, to: DAY, halfDay: false }],
      pendingLeave: 2
    })

    expect(facts.standups).toEqual({ submitted: 1, expected: 2, missing: ['Bela'] })
    expect(facts.leave.today).toEqual([{ name: 'Chirag', type: 'sick', until: DAY }])
    expect(facts.leave.pending).toBe(2)
  })

  it('calls a blocker carried three standups running "stuck"', () => {
    const blocked = { hasBlocker: true, blockers: 'Waiting on staging credentials' }
    const facts = analyse({
      people: [person('a', 'Asha'), person('b', 'Bela')],
      date: DAY,
      today: DAY,
      standups: [
        standup('a', '2026-09-15', blocked), standup('a', '2026-09-16', blocked), standup('a', DAY, blocked),
        standup('b', '2026-09-16'), standup('b', DAY, { hasBlocker: true, blockers: 'Flaky test' })
      ],
      attendance: [],
      leaves: [],
      pendingLeave: 0
    })

    expect(facts.blockers).toHaveLength(2)
    expect(facts.stuck).toEqual([{ name: 'Asha', blocker: 'Waiting on staging credentials', days: 3 }])
  })

  it('notices a low mood that keeps coming back, and a blocker that cleared', () => {
    const facts = analyse({
      people: [person('a', 'Asha'), person('b', 'Bela')],
      date: DAY,
      today: DAY,
      standups: [
        standup('a', '2026-09-15', { mood: 'stressed' }), standup('a', '2026-09-16', { mood: 'okay' }), standup('a', DAY, { mood: 'bad' }),
        standup('b', '2026-09-16', { hasBlocker: true, blockers: 'Access' }), standup('b', DAY)
      ],
      attendance: [],
      leaves: [],
      pendingLeave: 0
    })

    expect(facts.lowMood.map(p => p.name)).toEqual(['Asha'])
    expect(facts.goodNews).toContain('Bela is no longer blocked')
  })

  it('counts lateness today and lateness that keeps happening', () => {
    const at = (date, hhmm) => new Date(`${date}T${hhmm}:00.000Z`)
    const row = (user, date, hhmm) => ({ user, date, timezone: 'UTC', checkIn: at(date, hhmm), checkOut: at(date, '18:30') })
    const facts = analyse({
      people: [person('a', 'Asha'), person('b', 'Bela')],
      date: DAY,
      today: DAY,
      standups: [],
      attendance: [
        row('a', '2026-09-14', '10:40'), row('a', '2026-09-15', '10:50'), row('a', DAY, '10:35'),
        row('b', '2026-09-16', '09:50')
      ],
      leaves: [],
      pendingLeave: 0
    })

    expect(facts.attendance.late).toEqual([{ name: 'Asha', lateBy: 20, inAt: '10:35' }])
    expect(facts.attendance.lateOften).toEqual([{ name: 'Asha', days: 3 }])
    expect(facts.attendance.notIn).toEqual(['Bela'])
  })

  it('puts only the facts in the prompt, and asks for nothing beyond them', () => {
    const prompt = buildPrompt({ title: 'MERN', facts: { date: DAY, workday: true, standups: { missing: ['Bela'] } } })
    expect(prompt).toContain('"Bela"')
    expect(prompt).toContain('Use only these facts')
    // Nothing to celebrate means no section to fill with "(none)"
    expect(prompt).not.toContain('**Good news**')
    expect(buildPrompt({ title: 'MERN', facts: { date: DAY, workday: true, goodNews: ['Bela is no longer blocked'] } }))
      .toContain('**Good news**')
  })
})

describe('the brief page', () => {
  const crew = async () => {
    const manager = await makeUser({ role: 'manager' })
    const team = await makeTeam(manager, { name: 'MERN' })
    const asha = await joinTeam(await makeUser({ name: 'Asha' }), team)
    const bela = await joinTeam(await makeUser({ name: 'Bela' }), team)
    return { manager, team, asha, bela }
  }

  /** The model's reply, without calling Groq. */
  const modelSays = (text) => {
    process.env.GROQ_API_KEY = 'test-key'
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: text }, finish_reason: 'stop' }] })
    })
    vi.stubGlobal('fetch', fetch)
    return fetch
  }

  it('shows the manager their team\'s facts before any brief is written', async () => {
    const { manager, asha } = await crew()
    await makeStandup(asha)

    const res = await request(app).get('/api/brief').set(...authHeader(manager))

    expect(res.status).toBe(200)
    expect(res.body.title).toBe('MERN')
    expect(res.body.brief).toBeNull()
    expect(res.body.facts.people).toBe(2)
  })

  it('writes the brief from the facts, keeps it, and serves it after', async () => {
    const { manager, asha } = await crew()
    await makeStandup(asha)
    const fetch = modelSays('**Headline**\nA quiet day.')

    const written = await request(app).post('/api/brief').set(...authHeader(manager)).send({})

    expect(written.status).toBe(200)
    expect(written.body.brief.summary).toContain('A quiet day.')
    const sent = JSON.parse(fetch.mock.calls[0][1].body)
    expect(sent.messages[1].content).toContain('"Bela"')
    expect(await DailyBrief.countDocuments()).toBe(1)

    const read = await request(app).get('/api/brief').set(...authHeader(manager))
    expect(read.body.brief.summary).toContain('A quiet day.')
  })

  it('says so when the model cannot be reached, and keeps nothing', async () => {
    const { manager } = await crew()
    process.env.GROQ_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }))

    const res = await request(app).post('/api/brief').set(...authHeader(manager)).send({})

    expect(res.status).toBe(502)
    expect(await DailyBrief.countDocuments()).toBe(0)
  })

  it('will not read another manager\'s team', async () => {
    const { team } = await crew()
    const other = await makeUser({ role: 'manager' })
    await makeTeam(other)

    const res = await request(app).get(`/api/brief?team=${team._id}`).set(...authHeader(other))

    expect(res.status).toBe(403)
  })

  it('is not for employees', async () => {
    const { asha } = await crew()
    expect((await request(app).get('/api/brief').set(...authHeader(asha))).status).toBe(403)
  })
})
