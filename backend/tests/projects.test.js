import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Project from '../models/Project.js'
import Team from '../models/Team.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

afterEach(() => {
  vi.useRealTimers()
})

/** A day well clear of any other test's dates. */
const TUESDAY = '2026-06-02'

/** Freeze the clock on that day. */
const onTuesday = () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${TUESDAY}T09:00:00.000Z`))
}

const withTeam = async () => {
  const manager = await makeUser({ role: 'manager' })
  const team = await makeTeam(manager, { name: `Team ${Date.now()}${Math.random()}` })
  const member = await joinTeam(await makeUser({ name: 'Member' }), team)
  return { manager, team, member }
}

const makeProject = (overrides = {}) =>
  Project.create({ name: 'Acme rebuild', client: 'Acme', ...overrides })

const submitStandup = (user, body) =>
  request(app).post('/api/standups').set(...authHeader(user)).send({
    yesterday: 'a',
    today: 'b',
    ...body
  })

describe('the project catalogue', () => {
  it('offers a team its own projects and the shared ones', async () => {
    const { team, member } = await withTeam()
    await makeProject({ name: 'Team work', team: team._id })
    await makeProject({ name: 'Internal', team: null })
    const otherTeam = await makeTeam(await makeUser({ role: 'manager' }), { name: 'Other' })
    await makeProject({ name: 'Someone else', team: otherTeam._id })

    const res = await request(app).get('/api/projects').set(...authHeader(member))

    const names = res.body.map(p => p.name)
    expect(names).toContain('Team work')
    // Training and internal work belong to nobody's team but are open to all
    expect(names).toContain('Internal')
    expect(names).not.toContain('Someone else')
  })

  it('leaves an archived project out of the pickable list', async () => {
    const { team, member } = await withTeam()
    await makeProject({ name: 'Finished', team: team._id, active: false })

    const res = await request(app).get('/api/projects').set(...authHeader(member))
    expect(res.body.map(p => p.name)).not.toContain('Finished')
  })

  it('lets a manager create one for their own team only', async () => {
    const { manager, team } = await withTeam()

    const mine = await request(app).post('/api/projects').set(...authHeader(manager))
      .send({ name: 'New build', client: 'Acme' })
    expect(mine.status).toBe(201)
    expect(String(mine.body.team)).toBe(String(team._id))

    const other = await withTeam()
    const theirs = await request(app).post('/api/projects').set(...authHeader(manager))
      .send({ name: 'Reaching', team: String(other.team._id) })
    expect(theirs.status).toBe(400)
  })

  it('is closed to employees', async () => {
    const employee = await makeUser()
    const res = await request(app).post('/api/projects').set(...authHeader(employee))
      .send({ name: 'Nope' })
    expect(res.status).toBe(403)
  })
})

describe('hours from a form opened before the timesheet went', () => {
  it('are dropped, and the standup still goes in', async () => {
    const { team, member } = await withTeam()
    const project = await makeProject({ team: team._id })

    onTuesday()
    const res = await submitStandup(member, {
      work: [{ project: String(project._id), hours: 4, note: 'Checkout flow' }]
    })

    expect(res.status).toBe(201)
    expect(res.body.work).toBeUndefined()
    const { default: Standup } = await import('../models/Standup.js')
    const saved = await Standup.findById(res.body._id).lean()
    expect(saved.work).toBeUndefined()
  })
})

describe('who a project belongs to', () => {
  it('gives a new project to the team the admin runs, not to everyone', async () => {
    // Defaulting to shared put a named client in front of every team
    const { team } = await withTeam()
    const admin = await makeUser({ role: 'admin' })
    await Team.updateOne({ _id: team._id }, { manager: admin._id })

    const res = await request(app).post('/api/projects').set(...authHeader(admin))
      .send({ name: 'Zephyr Systems', client: 'Zephyr' })

    expect(res.status).toBe(201)
    expect(String(res.body.team)).toBe(String(team._id))
  })

  it('still makes a shared one when that is asked for', async () => {
    const admin = await makeUser({ role: 'admin' })

    const res = await request(app).post('/api/projects').set(...authHeader(admin))
      .send({ name: 'Leave', team: null, billable: false })

    expect(res.status).toBe(201)
    expect(res.body.team).toBeNull()
  })

  it('offers an admin the teams to choose from, and a manager none', async () => {
    const { manager, team } = await withTeam()
    const admin = await makeUser({ role: 'admin' })

    const asAdmin = await request(app).get('/api/projects/all').set(...authHeader(admin))
    expect(asAdmin.body.canShare).toBe(true)
    expect(asAdmin.body.teams.map(t => String(t._id))).toContain(String(team._id))

    const asManager = await request(app).get('/api/projects/all').set(...authHeader(manager))
    expect(asManager.body.canShare).toBe(false)
    expect(asManager.body.teams).toEqual([])
    expect(String(asManager.body.defaultTeam)).toBe(String(team._id))
  })
})

describe('one standup per person per day', () => {
  it('is held by the database, not just by the check before the insert', async () => {
    const { member } = await withTeam()

    onTuesday()

    // Two submissions at once: the findOne check can let both through, and
    // only the unique index can decide
    const [a, b] = await Promise.all([submitStandup(member, {}), submitStandup(member, {})])
    vi.useRealTimers()

    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([201, 400])

    const loser = [a, b].find(r => r.status === 400)
    // A duplicate-key error would be a 500 with a mongo message in it
    expect(loser.body.message).toMatch(/already submitted/i)

    const { default: Standup } = await import('../models/Standup.js')
    expect(await Standup.countDocuments({ user: member._id, date: TUESDAY })).toBe(1)
  })
})
