import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Leave from '../models/Leave.js'
import Notification from '../models/Notification.js'
import Role from '../models/Role.js'
import { ensureBuiltIns, invalidate } from '../services/roleService.js'
import { workingDays, balanceFor } from '../utils/leavePolicy.js'
import { addDays, isWeekend, todayIn } from '../utils/time.js'
import { MODULE_KEYS } from '../utils/modules.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

beforeEach(() => {
  invalidate()
})

const today = () => todayIn('UTC')

/** The nth working day from today, so a test never lands on a weekend. */
const workday = (n) => {
  let date = today()
  let seen = 0
  while (seen < n) {
    date = addDays(date, 1)
    if (!isWeekend(date)) seen += 1
  }
  return date
}

/** A lead, their team, and somebody on it. */
const crew = async () => {
  const manager = await makeUser({ role: 'manager' })
  const team = await makeTeam(manager)
  const employee = await joinTeam(await makeUser(), team)
  return { manager, team, employee }
}

const ask = (user, body) =>
  request(app).post('/api/leave').set(...authHeader(user)).send({
    type: 'casual',
    from: workday(3),
    to: workday(3),
    reason: 'Family function',
    ...body
  })

const approve = (user, id, body = {}) =>
  request(app).post(`/api/leave/${id}/approve`).set(...authHeader(user)).send(body)

const reject = (user, id, body = {}) =>
  request(app).post(`/api/leave/${id}/reject`).set(...authHeader(user)).send(body)

describe('counting the days', () => {
  it('leaves weekends out', () => {
    // 2026-09-18 is a Friday; the Monday after is the 21st
    expect(workingDays('2026-09-18', '2026-09-21')).toBe(2)
  })

  it('costs half for a half day', () => {
    expect(workingDays('2026-09-18', '2026-09-18', true)).toBe(0.5)
  })

  it('holds waiting requests against what is left', () => {
    const [casual] = balanceFor([
      { type: 'casual', from: '2026-02-02', days: 3, status: 'approved' },
      { type: 'casual', from: '2026-03-02', days: 2, status: 'pending' },
      { type: 'casual', from: '2026-04-02', days: 5, status: 'rejected' },
      { type: 'casual', from: '2025-12-01', days: 4, status: 'approved' }
    ], 2026)

    expect(casual).toMatchObject({ allowance: 12, used: 3, pending: 2, remaining: 7 })
  })
})

describe('asking for time off', () => {
  it('saves the request, waiting, with the working days it costs', async () => {
    const { employee } = await crew()

    const res = await ask(employee, { from: workday(1), to: workday(3) })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ status: 'pending', days: 3, userName: employee.name })
  })

  it('tells the team\'s manager, not every admin', async () => {
    const { manager, employee } = await crew()
    const admin = await makeUser({ role: 'admin' })

    await ask(employee)

    expect(await Notification.countDocuments({ recipient: manager._id, type: 'leave_requested' })).toBe(1)
    expect(await Notification.countDocuments({ recipient: admin._id })).toBe(0)
  })

  it('goes to the admins when the manager is the one asking', async () => {
    const { manager } = await crew()
    const admin = await makeUser({ role: 'admin' })

    await ask(manager)

    expect(await Notification.countDocuments({ recipient: admin._id, type: 'leave_requested' })).toBe(1)
  })

  it('refuses a second request over the same day', async () => {
    const { employee } = await crew()
    await ask(employee, { from: workday(2), to: workday(4) })

    const res = await ask(employee, { from: workday(4), to: workday(5) })

    expect(res.status).toBe(409)
  })

  it('refuses more than is left of that kind', async () => {
    const { employee } = await crew()
    await Leave.create({
      user: employee._id, type: 'sick', from: `${today().slice(0, 4)}-01-05`,
      to: `${today().slice(0, 4)}-01-12`, days: 7, reason: 'Flu', status: 'approved'
    })

    const res = await ask(employee, { type: 'sick', from: workday(1), to: workday(2) })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Only 1 day of sick leave/)
  })

  it('does not run out of unpaid leave', async () => {
    const { employee } = await crew()
    const res = await ask(employee, { type: 'unpaid', from: workday(1), to: workday(20) })
    expect(res.status).toBe(201)
  })

  it('refuses a range that is only a weekend', async () => {
    const { employee } = await crew()
    let saturday = workday(1)
    while (new Date(`${saturday}T00:00:00Z`).getUTCDay() !== 6) saturday = addDays(saturday, 1)

    const res = await ask(employee, { from: saturday, to: addDays(saturday, 1) })

    expect(res.status).toBe(400)
  })

  it('refuses a last day before the first', async () => {
    const { employee } = await crew()
    const res = await ask(employee, { from: workday(4), to: workday(2) })
    expect(res.status).toBe(400)
  })

  it('shows me my own requests and what is left', async () => {
    const { employee } = await crew()
    await ask(employee, { from: workday(1), to: workday(2) })

    const res = await request(app).get('/api/leave/mine').set(...authHeader(employee))

    expect(res.status).toBe(200)
    expect(res.body.requests).toHaveLength(1)
    expect(res.body.balance.find(b => b.type === 'casual')).toMatchObject({ pending: 2, remaining: 10 })
  })
})

describe('answering a request', () => {
  it('lets the team\'s manager approve, and tells the person', async () => {
    const { manager, employee } = await crew()
    const { body: leave } = await ask(employee)

    const res = await approve(manager, leave._id)

    expect(res.status).toBe(200)
    expect(res.body.leave).toMatchObject({ status: 'approved', decidedByName: manager.name })
    expect(await Notification.countDocuments({ recipient: employee._id, type: 'leave_decided' })).toBe(1)
  })

  it('will not reject without a reason', async () => {
    const { manager, employee } = await crew()
    const { body: leave } = await ask(employee)

    expect((await reject(manager, leave._id)).status).toBe(400)
    expect((await reject(manager, leave._id, { note: 'Release week' })).status).toBe(200)
  })

  it('is not another team\'s manager to answer', async () => {
    const { employee } = await crew()
    const other = await crew()
    const { body: leave } = await ask(employee)

    expect((await approve(other.manager, leave._id)).status).toBe(403)
  })

  it('is never your own to answer, even as an admin', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { body: leave } = await ask(admin)

    expect((await approve(admin, leave._id)).status).toBe(403)
  })

  it('is not an employee\'s to answer', async () => {
    const { employee } = await crew()
    const colleague = await makeUser()
    const { body: leave } = await ask(employee)

    expect((await approve(colleague, leave._id)).status).toBe(403)
  })

  it('cannot be answered twice', async () => {
    const { manager, employee } = await crew()
    const { body: leave } = await ask(employee)
    await approve(manager, leave._id)

    expect((await reject(manager, leave._id, { note: 'Changed my mind' })).status).toBe(400)
  })

  it('lists only the manager\'s own teams, waiting first, with what is left', async () => {
    const { manager, employee } = await crew()
    const other = await crew()
    await ask(employee, { from: workday(1), to: workday(2) })
    await ask(other.employee)

    const res = await request(app).get('/api/leave/team').set(...authHeader(manager))

    expect(res.status).toBe(200)
    expect(res.body.requests).toHaveLength(1)
    expect(res.body.pendingCount).toBe(1)
    expect(res.body.requests[0].balance).toMatchObject({ allowance: 12, remaining: 10 })
  })

  it('keeps the approvals list from employees', async () => {
    const { employee } = await crew()
    const res = await request(app).get('/api/leave/team').set(...authHeader(employee))
    expect(res.status).toBe(403)
  })
})

describe('taking it back', () => {
  it('cancels a request still waiting', async () => {
    const { employee } = await crew()
    const { body: leave } = await ask(employee)

    const res = await request(app).post(`/api/leave/${leave._id}/cancel`).set(...authHeader(employee))

    expect(res.status).toBe(200)
    expect(res.body.leave.status).toBe('cancelled')
  })

  it('is not somebody else\'s to cancel', async () => {
    const { employee } = await crew()
    const colleague = await makeUser()
    const { body: leave } = await ask(employee)

    const res = await request(app).post(`/api/leave/${leave._id}/cancel`).set(...authHeader(colleague))

    expect(res.status).toBe(403)
  })

  it('frees the days again', async () => {
    const { employee } = await crew()
    const { body: leave } = await ask(employee)
    await request(app).post(`/api/leave/${leave._id}/cancel`).set(...authHeader(employee))

    expect((await ask(employee)).status).toBe(201)
  })
})

describe('who is away', () => {
  it('shows a teammate the approved days but not the reason', async () => {
    const { manager, team, employee } = await crew()
    const teammate = await joinTeam(await makeUser(), team)
    const { body: leave } = await ask(employee)
    await approve(manager, leave._id)

    const res = await request(app)
      .get(`/api/leave/calendar?month=${leave.from.slice(0, 7)}`)
      .set(...authHeader(teammate))

    expect(res.status).toBe(200)
    expect(res.body.entries).toHaveLength(1)
    expect(res.body.entries[0].userName).toBe(employee.name)
    expect(res.body.entries[0].reason).toBeUndefined()
  })

  it('keeps a waiting request between the person and whoever answers it', async () => {
    const { manager, team, employee } = await crew()
    const teammate = await joinTeam(await makeUser(), team)
    const { body: leave } = await ask(employee)
    const month = `?month=${leave.from.slice(0, 7)}`

    const seenByTeammate = await request(app).get(`/api/leave/calendar${month}`).set(...authHeader(teammate))
    const seenByManager = await request(app).get(`/api/leave/calendar${month}`).set(...authHeader(manager))

    expect(seenByTeammate.body.entries).toHaveLength(0)
    expect(seenByManager.body.entries).toHaveLength(1)
  })

  it('does not show another team\'s leave', async () => {
    const { manager, employee } = await crew()
    const other = await crew()
    const { body: leave } = await ask(employee)
    await approve(manager, leave._id)

    const res = await request(app)
      .get(`/api/leave/calendar?month=${leave.from.slice(0, 7)}`)
      .set(...authHeader(other.employee))

    expect(res.body.entries).toHaveLength(0)
  })
})

describe('reaching roles saved before leave existed', () => {
  it('gives the stored manager and employee roles leave, once', async () => {
    // Roles as an earlier release wrote them: no leave, and no record of
    // what they had been offered
    await Role.collection.insertMany([
      { key: 'employee', name: 'Employee', base: 'employee', builtIn: true, modules: ['dashboard', 'standup', 'support'] },
      { key: 'manager', name: 'Manager', base: 'manager', builtIn: true, modules: ['dashboard', 'team', 'support'] }
    ])

    await ensureBuiltIns()

    const employee = await Role.findOne({ key: 'employee' }).lean()
    const manager = await Role.findOne({ key: 'manager' }).lean()
    expect(employee.modules).toContain('leave')
    expect(employee.modules).not.toContain('leaves')
    expect(manager.modules).toEqual(expect.arrayContaining(['leave', 'leaves']))
    // Nothing that was already there by choice comes back
    expect(employee.modules).not.toContain('history')
    expect(employee.offered).toEqual(MODULE_KEYS)
  })

  it('does not give it back after an admin takes it away', async () => {
    await ensureBuiltIns()
    await Role.updateOne({ key: 'employee' }, { $pull: { modules: 'leave' } })

    await ensureBuiltIns()

    expect((await Role.findOne({ key: 'employee' }).lean()).modules).not.toContain('leave')
  })
})
