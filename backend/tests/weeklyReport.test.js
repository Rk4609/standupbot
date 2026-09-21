import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Standup from '../models/Standup.js'
import WeeklyReport from '../models/WeeklyReport.js'
import { invalidate } from '../services/roleService.js'
import { analyseWeek } from '../utils/weeklyReportFacts.js'
import { buildPrompt, weekOf } from '../controllers/weeklyReportController.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

beforeEach(() => {
  invalidate()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  delete process.env.GROQ_API_KEY
})

const WEEK = { weekStart: '2026-09-07', weekEnd: '2026-09-11', weekLabel: 'Week 37 · Sep 7–11' }

const standup = (user, date, over = {}) => ({
  user, date, today: 'Keep going', hasBlocker: false, blockers: 'None', ...over
})

describe('working out the week', () => {
  const people = [{ _id: 'a', name: 'Asha' }, { _id: 'b', name: 'Bela' }]

  it('keeps what each person said they were on, in order, once each', () => {
    const facts = analyseWeek({
      week: WEEK,
      today: '2026-09-17',
      people,
      leaves: [],
      standups: [
        standup('a', '2026-09-07', { today: 'Build the payment form' }),
        standup('a', '2026-09-08', { today: 'Wire up Razorpay' }),
        standup('a', '2026-09-09', { today: 'Wire up Razorpay' }),
        standup('b', '2026-09-07', { today: 'Test the payment form' })
      ]
    })

    expect(facts.team[0]).toMatchObject({
      name: 'Asha',
      standups: 3,
      updates: [
        { date: '2026-09-07', text: 'Build the payment form' },
        { date: '2026-09-08', text: 'Wire up Razorpay' }
      ]
    })
    expect(facts.team[1]).toMatchObject({ name: 'Bela', standups: 1 })
    // Hours are no longer booked on a standup, so the report has none
    expect(facts.hours).toBeUndefined()
    expect(facts.projects).toBeUndefined()
  })

  it('keeps a blocker still open at the end of the week, and drops one that cleared', () => {
    const facts = analyseWeek({
      week: WEEK,
      today: '2026-09-17',
      people,
      leaves: [],
      standups: [
        standup('a', '2026-09-10', { hasBlocker: true, blockers: 'Waiting on API keys' }),
        standup('a', '2026-09-11', { hasBlocker: true, blockers: 'Waiting on API keys' }),
        standup('b', '2026-09-10', { hasBlocker: true, blockers: 'Flaky CI' }),
        standup('b', '2026-09-11', { today: 'Ship the refund flow' })
      ]
    })

    expect(facts.openBlockers).toEqual([{ name: 'Asha', blocker: 'Waiting on API keys', since: '2026-09-11' }])
    expect(facts.blockersRaised).toBe(3)
    expect(facts.team.map(p => p.blocked)).toEqual([2, 1])
    expect(facts.nextWeek).toContainEqual({ name: 'Bela', plan: 'Ship the refund flow' })
  })

  it('does not expect standups on days somebody was on leave', () => {
    const facts = analyseWeek({
      week: WEEK,
      today: '2026-09-17',
      people,
      leaves: [{ user: 'b', from: '2026-09-07', to: '2026-09-11', halfDay: false }],
      standups: [standup('a', '2026-09-07')]
    })

    expect(facts.standups).toEqual({ submitted: 1, expected: 5, rate: 20 })
    expect(facts.leave).toEqual({ days: 5, people: [{ name: 'Bela', days: 5 }] })
  })

  it('keeps moods and lateness out of what the model is asked to write', () => {
    const empty = analyseWeek({ week: WEEK, today: '2026-09-17', people, leaves: [], standups: [] })
    const prompt = buildPrompt({ title: 'MERN', facts: empty })
    expect(prompt).toContain('Do not mention moods, lateness or attendance')
    expect(prompt).toContain('No standups were filed')
    expect(prompt).not.toMatch(/hours/i)
  })

  it('stays inside what the model takes, however big the week', () => {
    // Forty people, a long plan every day, all blocked
    const many = Array.from({ length: 40 }, (_, i) => ({ _id: `u${i}`, name: `Person ${i}` }))
    const long = 'Refactored the ingestion workers and wrote the migration notes for the ops team '.repeat(4)
    const standups = many.flatMap(p => ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'].map(date =>
      standup(p._id, date, { hasBlocker: true, blockers: long, today: `${long} ${date}` })
    ))
    const facts = analyseWeek({ week: WEEK, today: '2026-09-17', people: many, leaves: [], standups })

    const prompt = buildPrompt({ title: 'Everybody', facts })

    // Roughly four characters a token: well under 8,000 with the reply
    expect(prompt.length).toBeLessThan(16000)
    expect(prompt).toContain('Person 0')
  })
})

describe('the weekly report page', () => {
  const crew = async () => {
    const manager = await makeUser({ role: 'manager' })
    const team = await makeTeam(manager, { name: 'MERN' })
    const asha = await joinTeam(await makeUser({ name: 'Asha' }), team)
    return { manager, team, asha }
  }

  // Monday of this week: inside the week whatever day the suite runs on
  const monday = weekOf(new Date().toISOString().slice(0, 10)).weekStart

  it('shows this week\'s facts for the manager\'s team', async () => {
    const { manager, asha } = await crew()
    await Standup.create({ user: asha._id, date: monday, today: 'Payments' })

    const res = await request(app).get('/api/reports/weekly').set(...authHeader(manager))

    expect(res.status).toBe(200)
    expect(res.body.title).toBe('MERN')
    expect(res.body.report).toBeNull()
    expect(res.body.isCurrentWeek).toBe(true)
    expect(res.body.facts.team[0]).toMatchObject({ name: 'Asha', standups: 1, updates: [{ date: monday, text: 'Payments' }] })
  })

  it('carries last week\'s headline numbers to compare against', async () => {
    const { manager, asha } = await crew()
    const lastMonday = weekOf(new Date(Date.parse(`${monday}T12:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10)).weekStart
    await Standup.create({ user: asha._id, date: lastMonday, today: 'Payments', hasBlocker: true, blockers: 'API keys' })

    const res = await request(app).get('/api/reports/weekly').set(...authHeader(manager))

    expect(res.body.facts.openBlockers).toHaveLength(0)
    expect(res.body.lastWeek.openBlockers).toBe(1)
    expect(res.body.lastWeek.standupRate).toBeGreaterThan(0)
  })

  it('writes the report, keeps it, and serves it after', async () => {
    const { manager } = await crew()
    process.env.GROQ_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '**Summary**\nA steady week.' }, finish_reason: 'stop' }] })
    }))

    const written = await request(app).post('/api/reports/weekly').set(...authHeader(manager)).send({})
    const read = await request(app).get('/api/reports/weekly').set(...authHeader(manager))

    expect(written.status).toBe(200)
    expect(read.body.report.content).toContain('A steady week.')
    expect(await WeeklyReport.countDocuments()).toBe(1)
  })

  it('refuses a week that has not started', async () => {
    const { manager } = await crew()
    const res = await request(app).get('/api/reports/weekly?week=2099-01-05').set(...authHeader(manager))
    expect(res.status).toBe(400)
  })

  it('is not for employees', async () => {
    const { asha } = await crew()
    expect((await request(app).get('/api/reports/weekly').set(...authHeader(asha))).status).toBe(403)
  })
})
