import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Project from '../models/Project.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

afterEach(() => {
  vi.useRealTimers()
})

const TUESDAY = '2026-06-02'
const onTuesday = () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${TUESDAY}T09:00:00.000Z`))
}

const withTeam = async () => {
  const manager = await makeUser({ role: 'manager' })
  const team = await makeTeam(manager, { name: `Team ${Date.now()}${Math.random()}` })
  const asha = await joinTeam(await makeUser({ name: 'Asha' }), team)
  const rohit = await joinTeam(await makeUser({ name: 'Rohit' }), team)
  return { manager, team, asha, rohit }
}

const makeProject = (overrides = {}) =>
  Project.create({ name: 'Acme rebuild', client: 'Acme', ...overrides })

const assign = (user, project, body) =>
  request(app).patch(`/api/projects/${project._id}/members`)
    .set(...authHeader(user)).send(body)

const submit = (user, work) =>
  request(app).post('/api/standups').set(...authHeader(user))
    .send({ today: 'b', work })

describe('putting people on a project', () => {
  it('adds them, and hands back who is on it', async () => {
    const { manager, team, asha, rohit } = await withTeam()
    const project = await makeProject({ team: team._id })

    const res = await assign(manager, project, {
      add: [String(asha._id), String(rohit._id)]
    })

    expect(res.status).toBe(200)
    expect(res.body.members.map(m => m.name).sort()).toEqual(['Asha', 'Rohit'])
  })

  it('takes them off again', async () => {
    const { manager, team, asha, rohit } = await withTeam()
    const project = await makeProject({ team: team._id, members: [asha._id, rohit._id] })

    const res = await assign(manager, project, { remove: [String(asha._id)] })

    expect(res.body.members.map(m => m.name)).toEqual(['Rohit'])
  })

  it('does not add the same person twice', async () => {
    const { manager, team, asha } = await withTeam()
    const project = await makeProject({ team: team._id, members: [asha._id] })

    await assign(manager, project, { add: [String(asha._id)] })

    const stored = await Project.findById(project._id).lean()
    expect(stored.members).toHaveLength(1)
  })

  it('refuses somebody from another team', async () => {
    const { manager, team } = await withTeam()
    const project = await makeProject({ team: team._id })
    const outsider = await withTeam()

    const res = await assign(manager, project, { add: [String(outsider.asha._id)] })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/not on this team/i)
  })

  it('refuses a project that belongs to another team', async () => {
    const { manager } = await withTeam()
    const other = await withTeam()
    const theirs = await makeProject({ team: other.team._id })

    const res = await assign(manager, theirs, { add: [String(other.asha._id)] })
    expect(res.status).toBe(403)
  })

  it('is closed to employees', async () => {
    const { team, asha } = await withTeam()
    const project = await makeProject({ team: team._id })

    const res = await assign(asha, project, { add: [String(asha._id)] })
    expect(res.status).toBe(403)
  })
})

describe('what a person may book to', () => {
  it('is the whole team while nobody is named', async () => {
    // Every project worked this way before anyone could be assigned, and
    // turning assignment on must not make existing work unbookable
    const { team, asha } = await withTeam()
    await makeProject({ name: 'Open to all', team: team._id })

    const res = await request(app).get('/api/projects').set(...authHeader(asha))

    expect(res.body.map(p => p.name)).toContain('Open to all')
  })

  it('narrows to the named people once there are any', async () => {
    const { team, asha, rohit } = await withTeam()
    await makeProject({ name: 'Ashas project', team: team._id, members: [asha._id] })

    const hers = await request(app).get('/api/projects').set(...authHeader(asha))
    const his = await request(app).get('/api/projects').set(...authHeader(rohit))

    expect(hers.body.map(p => p.name)).toContain('Ashas project')
    expect(his.body.map(p => p.name)).not.toContain('Ashas project')
  })

  it('always includes the shared ones, whoever is named on what', async () => {
    const { team, rohit, asha } = await withTeam()
    await makeProject({ name: 'Ashas project', team: team._id, members: [asha._id] })
    await makeProject({ name: 'Leave', team: null, billable: false })

    const res = await request(app).get('/api/projects').set(...authHeader(rohit))

    // Without these a week never adds up to a week
    expect(res.body.map(p => p.name)).toContain('Leave')
  })

  it('follows an assignment across a team boundary', async () => {
    const { team, asha } = await withTeam()
    const other = await withTeam()
    await makeProject({
      name: 'Lent out',
      team: other.team._id,
      members: [asha._id]
    })

    const res = await request(app).get('/api/projects').set(...authHeader(asha))
    expect(res.body.map(p => p.name)).toContain('Lent out')
  })

  it('refuses hours against a project somebody is not on', async () => {
    const { team, asha, rohit } = await withTeam()
    const hers = await makeProject({ team: team._id, members: [asha._id] })

    onTuesday()
    const res = await submit(rohit, [{ project: String(hers._id), hours: 4 }])

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/not available/i)
  })

  it('accepts hours from somebody who is', async () => {
    const { team, asha } = await withTeam()
    const hers = await makeProject({ team: team._id, members: [asha._id] })

    onTuesday()
    const res = await submit(asha, [{ project: String(hers._id), hours: 4 }])

    expect(res.status).toBe(201)
  })
})

describe('moving somebody between projects', () => {
  const transfer = (user, from, body) =>
    request(app).post(`/api/projects/${from._id}/transfer`)
      .set(...authHeader(user)).send(body)

  it('takes them off one and puts them on the other', async () => {
    const { manager, team, asha } = await withTeam()
    const from = await makeProject({ name: 'Old', team: team._id, members: [asha._id] })
    const to = await makeProject({ name: 'New', team: team._id })

    const res = await transfer(manager, from, {
      user: String(asha._id),
      toProject: String(to._id)
    })

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/Asha moved to New/)

    const [oldOne, newOne] = await Promise.all([
      Project.findById(from._id).lean(),
      Project.findById(to._id).lean()
    ])
    expect(oldOne.members).toHaveLength(0)
    expect(newOne.members.map(String)).toContain(String(asha._id))
  })

  it('leaves the hours they already booked where they were worked', async () => {
    const { manager, team, asha } = await withTeam()
    const from = await makeProject({ name: 'Old', team: team._id, members: [asha._id] })
    const to = await makeProject({ name: 'New', team: team._id })

    onTuesday()
    const standup = await submit(asha, [{ project: String(from._id), hours: 6 }])
    vi.useRealTimers()

    await transfer(manager, from, { user: String(asha._id), toProject: String(to._id) })

    // A timesheet that changes retrospectively is worth nothing
    const { default: Standup } = await import('../models/Standup.js')
    const saved = await Standup.findById(standup.body._id).lean()
    expect(String(saved.work[0].project)).toBe(String(from._id))
  })

  it('refuses a move to the same project', async () => {
    const { manager, team, asha } = await withTeam()
    const project = await makeProject({ team: team._id, members: [asha._id] })

    const res = await transfer(manager, project, {
      user: String(asha._id),
      toProject: String(project._id)
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/same project/i)
  })

  it('refuses a destination that belongs to another team', async () => {
    const { manager, team, asha } = await withTeam()
    const from = await makeProject({ team: team._id, members: [asha._id] })
    const other = await withTeam()
    const theirs = await makeProject({ team: other.team._id })

    const res = await transfer(manager, from, {
      user: String(asha._id),
      toProject: String(theirs._id)
    })

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/destination/i)
  })

  it('leaves a trail, because somebody will ask who moved them', async () => {
    const { manager, team, asha } = await withTeam()
    const from = await makeProject({ name: 'Old', team: team._id, members: [asha._id] })
    const to = await makeProject({ name: 'New', team: team._id })

    await transfer(manager, from, { user: String(asha._id), toProject: String(to._id) })

    const { default: AuditLog } = await import('../models/AuditLog.js')
    const [entry] = await AuditLog.find({ action: 'project.transfer' })
      .sort({ createdAt: -1 }).limit(1).lean()

    expect(entry.subjectName).toBe('Asha')
    expect(entry.changes[0]).toEqual({ field: 'project', from: 'Old', to: 'New' })
  })
})

describe('who is on what today', () => {
  it('reports each person, what they booked and how often they report', async () => {
    const { manager, team, asha } = await withTeam()
    const project = await makeProject({ name: 'Acme', team: team._id, members: [asha._id] })

    onTuesday()
    await submit(asha, [{ project: String(project._id), hours: 6 }])
    vi.useRealTimers()

    onTuesday()
    const res = await request(app).get('/api/projects/activity').set(...authHeader(manager))
    vi.useRealTimers()

    const row = res.body.people.find(p => p.name === 'Asha')
    expect(row.submittedToday).toBe(true)
    expect(row.workedOn[0].project).toBe('Acme')
    expect(row.workedOn[0].hours).toBe(6)
    expect(row.assigned.map(a => a.name)).toContain('Acme')
    expect(row.daysThisWeek).toBe(1)
  })

  it('says plainly when somebody has not reported today', async () => {
    const { manager, team } = await withTeam()
    await makeProject({ team: team._id })

    const res = await request(app).get('/api/projects/activity').set(...authHeader(manager))

    const rohit = res.body.people.find(p => p.name === 'Rohit')
    expect(rohit.submittedToday).toBe(false)
    expect(rohit.daysThisWeek).toBe(0)
  })

  it('shows a manager only their own team', async () => {
    const { manager } = await withTeam()
    const other = await withTeam()

    const res = await request(app).get('/api/projects/activity').set(...authHeader(manager))

    expect(res.body.people.map(p => String(p._id)))
      .not.toContain(String(other.asha._id))
  })

  it('is closed to employees', async () => {
    const { asha } = await withTeam()
    const res = await request(app).get('/api/projects/activity').set(...authHeader(asha))
    expect(res.status).toBe(403)
  })
})
