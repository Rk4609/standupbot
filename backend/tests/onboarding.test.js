import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Candidate from '../models/Candidate.js'
import Notification from '../models/Notification.js'
import Onboarding from '../models/Onboarding.js'
import { invalidate } from '../services/roleService.js'
import { PLAN } from '../utils/onboardingPlan.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

beforeEach(() => {
  invalidate()
})

const crew = async () => {
  const manager = await makeUser({ role: 'manager' })
  const team = await makeTeam(manager)
  const joiner = await joinTeam(await makeUser({ employment: { position: 'Frontend intern', joinedOn: new Date('2026-09-14') } }), team)
  return { manager, team, joiner }
}

const start = (actor, user, body = {}) =>
  request(app).post('/api/onboarding').set(...authHeader(actor)).send({ user: String(user._id), ...body })

const tick = (actor, onboarding, task, body = { done: true }) =>
  request(app).patch(`/api/onboarding/${onboarding._id}/tasks/${task._id}`).set(...authHeader(actor)).send(body)

const taskBy = (onboarding, owner) => onboarding.tasks.find(t => t.owner === owner)

describe('starting a checklist', () => {
  it('lays out the plan from the joining date, and tells the joiner and their manager', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { manager, joiner } = await crew()

    const res = await start(admin, joiner)

    expect(res.status).toBe(201)
    const { onboarding } = res.body
    expect(onboarding.startsOn).toBe('2026-09-14')
    expect(onboarding.tasks).toHaveLength(PLAN.length)
    expect(onboarding.tasks.find(t => t.title === '30-day check-in held').dueOn).toBe('2026-10-14')
    expect(onboarding.tasks.find(t => t.title.startsWith('Signed offer')).dueOn).toBe('2026-09-13')
    expect(await Notification.countDocuments({ recipient: joiner._id, type: 'onboarding_started' })).toBe(1)
    expect(await Notification.countDocuments({ recipient: manager._id, type: 'onboarding_started' })).toBe(1)
  })

  it('lets a manager start one for their own team only', async () => {
    const { manager, joiner } = await crew()
    const other = await crew()

    expect((await start(other.manager, joiner)).status).toBe(403)
    expect((await start(manager, joiner)).status).toBe(201)
  })

  it('never makes a second checklist for the same person', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { joiner } = await crew()
    await start(admin, joiner)

    expect((await start(admin, joiner)).status).toBe(409)
  })

  it('keeps the list of everybody being onboarded from employees', async () => {
    const { joiner } = await crew()
    expect((await request(app).get('/api/onboarding').set(...authHeader(joiner))).status).toBe(403)
  })

  it('starts by itself when a hire is approved', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { manager, team } = await crew()
    const candidate = await Candidate.create({
      name: 'Kabir Sen', email: `kabir.${Date.now()}@example.com`, position: 'Backend intern',
      team: team._id, joiningOn: new Date('2026-10-01'), submittedBy: manager._id
    })

    const res = await request(app).post(`/api/hiring/${candidate._id}/approve`).set(...authHeader(admin)).send({})

    expect(res.status).toBe(200)
    const onboarding = await Onboarding.findOne({ user: res.body.account._id }).lean()
    expect(onboarding).toMatchObject({ startsOn: '2026-10-01', status: 'active', userName: 'Kabir Sen' })
    expect(String(onboarding.candidate)).toBe(String(candidate._id))
  })
})

describe('working through it', () => {
  it('lets the joiner tick their own tasks, but not the manager\'s or HR\'s', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { joiner } = await crew()
    const { body: { onboarding } } = await start(admin, joiner)

    expect((await tick(joiner, onboarding, taskBy(onboarding, 'employee'))).status).toBe(200)
    expect((await tick(joiner, onboarding, taskBy(onboarding, 'manager'))).status).toBe(403)
    expect((await tick(joiner, onboarding, taskBy(onboarding, 'hr'))).status).toBe(403)
  })

  it('lets the manager tick theirs and the joiner\'s, and records who did', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { manager, joiner } = await crew()
    const { body: { onboarding } } = await start(admin, joiner)

    const res = await tick(manager, onboarding, taskBy(onboarding, 'manager'))

    expect(res.status).toBe(200)
    const task = res.body.onboarding.tasks.find(t => t._id === taskBy(onboarding, 'manager')._id)
    expect(task).toMatchObject({ done: true, doneByName: manager.name })
    expect(res.body.onboarding.progress).toMatchObject({ done: 1, total: PLAN.length })
    expect((await tick(manager, onboarding, taskBy(onboarding, 'hr'))).status).toBe(403)
  })

  it('is invisible to somebody outside it', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { joiner } = await crew()
    const stranger = await makeUser()
    const { body: { onboarding } } = await start(admin, joiner)

    const res = await request(app).get(`/api/onboarding/${onboarding._id}`).set(...authHeader(stranger))

    expect(res.status).toBe(404)
  })

  it('finishes when the last task is ticked, tells both, and reopens if one is unticked', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { manager, joiner } = await crew()
    const { body: { onboarding } } = await start(admin, joiner)

    let last
    for (const task of onboarding.tasks) last = await tick(admin, onboarding, task)

    expect(last.body.onboarding.status).toBe('complete')
    expect(await Notification.countDocuments({ type: 'onboarding_complete', recipient: joiner._id })).toBe(1)
    expect(await Notification.countDocuments({ type: 'onboarding_complete', recipient: manager._id })).toBe(1)

    const reopened = await tick(admin, onboarding, onboarding.tasks[0], { done: false })
    expect(reopened.body.onboarding.status).toBe('active')
  })

  it('lets the manager add a task that applies and drop one that does not', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { manager, joiner } = await crew()
    const { body: { onboarding } } = await start(admin, joiner)

    const added = await request(app)
      .post(`/api/onboarding/${onboarding._id}/tasks`).set(...authHeader(manager))
      .send({ title: 'Access to the client VPN', owner: 'manager', dueOn: '2026-09-16' })
    expect(added.status).toBe(201)
    expect(added.body.onboarding.tasks).toHaveLength(PLAN.length + 1)

    const dropped = await request(app)
      .delete(`/api/onboarding/${onboarding._id}/tasks/${onboarding.tasks[0]._id}`).set(...authHeader(manager))
    expect(dropped.body.onboarding.tasks).toHaveLength(PLAN.length)

    const byJoiner = await request(app)
      .post(`/api/onboarding/${onboarding._id}/tasks`).set(...authHeader(joiner))
      .send({ title: 'Something', owner: 'employee', dueOn: '2026-09-16' })
    expect(byJoiner.status).toBe(403)
  })

  it('lists a manager\'s joiners with progress, and the people still without a checklist', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { manager, team, joiner } = await crew()
    const colleague = await joinTeam(await makeUser({ name: 'Not started yet' }), team)
    const { body: { onboarding } } = await start(admin, joiner)
    await tick(manager, onboarding, taskBy(onboarding, 'manager'))

    const res = await request(app).get('/api/onboarding').set(...authHeader(manager))

    expect(res.status).toBe(200)
    expect(res.body.onboardings).toHaveLength(1)
    expect(res.body.onboardings[0].progress.done).toBe(1)
    expect(res.body.counts.active).toBe(1)
    expect(res.body.people.map(p => String(p._id))).toContain(String(colleague._id))
    expect(res.body.people.map(p => String(p._id))).not.toContain(String(joiner._id))
  })

  it('shows the joiner their own checklist', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { joiner } = await crew()
    await start(admin, joiner)

    const res = await request(app).get('/api/onboarding/mine').set(...authHeader(joiner))

    expect(res.body.onboarding.tasks.filter(t => t.canTick).every(t => t.owner === 'employee')).toBe(true)
    expect(res.body.onboarding.canEdit).toBe(false)
  })
})
