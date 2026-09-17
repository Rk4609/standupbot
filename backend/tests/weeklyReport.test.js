import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Project from '../models/Project.js'
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

const standup = (user, date, work, over = {}) => ({
  user, date, today: 'Keep going', hasBlocker: false, blockers: 'None', work, ...over
})

describe('working out the week', () => {
  const people = [{ _id: 'a', name: 'Asha' }, { _id: 'b', name: 'Bela' }]
  const projects = [
    { _id: 'p1', name: 'Checkout', code: 'CHK', client: 'Acme', billable: true },
    { _id: 'p2', name: 'Internal tooling', billable: false }
  ]

  it('adds hours up by project and person, and splits billable time', () => {
    const facts = analyseWeek({
      week: WEEK,
      today: '2026-09-17',
      people,
      projects,
      leaves: [],
      standups: [
        standup('a', '2026-09-07', [{ project: 'p1', hours: 6, note: 'Built the payment form' }, { project: 'p2', hours: 2 }]),
        standup('a', '2026-09-08', [{ project: 'p1', hours: 8, note: 'Wired up Razorpay' }]),
        standup('b', '2026-09-07', [{ project: 'p1', hours: 4, note: 'Tested the payment form' }])
      ]
    })

    expect(facts.hours).toEqual({ total: 20, billable: 18, nonBillable: 2, billablePercent: 90 })
    expect(facts.projects[0]).toMatchObject({
      name: 'Checkout', hours: 18, share: 90,
      contributors: [{ name: 'Asha', hours: 14 }, { name: 'Bela', hours: 4 }]
    })
    expect(facts.projects[0].notes.map(n => n.note)).toContain('Wired up Razorpay')
    expect(facts.team[0]).toMatchObject({ name: 'Asha', hours: 16, standups: 2 })
  })

  it('keeps a blocker still open at the end of the week, and drops one that cleared', () => {
    const facts = analyseWeek({
      week: WEEK,
      today: '2026-09-17',
      people,
      projects,
      leaves: [],
      standups: [
        standup('a', '2026-09-10', [{ project: 'p1', hours: 8 }], { hasBlocker: true, blockers: 'Waiting on API keys' }),
        standup('a', '2026-09-11', [{ project: 'p1', hours: 8 }], { hasBlocker: true, blockers: 'Waiting on API keys' }),
        standup('b', '2026-09-10', [{ project: 'p1', hours: 8 }], { hasBlocker: true, blockers: 'Flaky CI' }),
        standup('b', '2026-09-11', [{ project: 'p1', hours: 8 }], { today: 'Ship the refund flow' })
      ]
    })

    expect(facts.openBlockers).toEqual([{ name: 'Asha', blocker: 'Waiting on API keys', since: '2026-09-11' }])
    expect(facts.projects[0].blockers.map(b => b.name).sort()).toEqual(['Asha', 'Bela'])
    expect(facts.nextWeek).toContainEqual({ name: 'Bela', plan: 'Ship the refund flow' })
  })

  it('does not expect standups on days somebody was on leave', () => {
    const facts = analyseWeek({
      week: WEEK,
      today: '2026-09-17',
      people,
      projects,
      leaves: [{ user: 'b', from: '2026-09-07', to: '2026-09-11', halfDay: false }],
      standups: [standup('a', '2026-09-07', [])]
    })

    expect(facts.standups).toEqual({ submitted: 1, expected: 5, rate: 20 })
    expect(facts.leave).toEqual({ days: 5, people: [{ name: 'Bela', days: 5 }] })
  })

  it('keeps moods and lateness out of what the model is asked to write', () => {
    const empty = analyseWeek({ week: WEEK, today: '2026-09-17', people, projects, leaves: [], standups: [] })
    const prompt = buildPrompt({ title: 'MERN', facts: empty })
    expect(prompt).toContain('Do not mention moods, lateness or attendance')
    expect(prompt).toContain('No hours were logged')
  })

  it('stays inside what the model takes, however big the week', () => {
    // Forty people, ten projects, a long note on every entry, all blocked
    const many = Array.from({ length: 40 }, (_, i) => ({ _id: `u${i}`, name: `Person ${i}` }))
    const projectsMany = Array.from({ length: 10 }, (_, i) => ({ _id: `p${i}`, name: `Project ${i}`, billable: true }))
    const long = 'Refactored the ingestion workers and wrote the migration notes for the ops team '.repeat(4)
    const standups = many.flatMap((p, i) => ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'].map(date =>
      standup(p._id, date, [{ project: `p${i % 10}`, hours: 8, note: `${long} ${date}` }], { hasBlocker: true, blockers: long, today: long })
    ))
    const facts = analyseWeek({ week: WEEK, today: '2026-09-17', people: many, projects: projectsMany, leaves: [], standups })

    const prompt = buildPrompt({ title: 'Everybody', facts })

    // Roughly four characters a token: well under 8,000 with the reply
    expect(prompt.length).toBeLessThan(16000)
    expect(prompt).toContain('Project 0')
  })
})

describe('the weekly report page', () => {
  const crew = async () => {
    const manager = await makeUser({ role: 'manager' })
    const team = await makeTeam(manager, { name: 'MERN' })
    const asha = await joinTeam(await makeUser({ name: 'Asha' }), team)
    const project = await Project.create({ name: 'Checkout', team: team._id, billable: true })
    return { manager, team, asha, project }
  }

  // Monday of this week: inside the week whatever day the suite runs on
  const monday = weekOf(new Date().toISOString().slice(0, 10)).weekStart

  it('shows this week\'s facts for the manager\'s team', async () => {
    const { manager, asha, project } = await crew()
    await Standup.create({ user: asha._id, date: monday, today: 'Payments', work: [{ project: project._id, hours: 6, note: 'Form' }] })

    const res = await request(app).get('/api/reports/weekly').set(...authHeader(manager))

    expect(res.status).toBe(200)
    expect(res.body.title).toBe('MERN')
    expect(res.body.report).toBeNull()
    expect(res.body.isCurrentWeek).toBe(true)
    expect(res.body.facts.projects[0]).toMatchObject({ name: 'Checkout', hours: 6 })
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
