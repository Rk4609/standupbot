import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import User from '../models/User.js'
import { invalidate } from '../services/roleService.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

beforeEach(() => {
  invalidate()
})

const withTeam = async (who = 'Asha Rao') => {
  const manager = await makeUser({ role: 'manager' })
  const team = await makeTeam(manager, { name: `Team ${Date.now()}${Math.random()}` })
  const asha = await joinTeam(await makeUser({ name: who }), team)
  return { manager, team, asha }
}

const list = (user, query = '') =>
  request(app).get(`/api/people${query}`).set(...authHeader(user))

const patch = (user, person, body) =>
  request(app).patch(`/api/people/${person._id}`).set(...authHeader(user)).send(body)

describe('the directory', () => {
  it('shows an admin the whole workspace', async () => {
    const admin = await makeUser({ role: 'admin' })
    await withTeam()

    const res = await list(admin)

    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThanOrEqual(2)
  })

  it('shows a manager their own team and nobody else', async () => {
    const { manager, asha } = await withTeam('Asha Rao')
    const other = await withTeam('Somebody Else')

    const res = await list(manager)

    const names = res.body.people.map(p => p.name)
    expect(names).toContain(asha.name)
    expect(names).not.toContain(other.asha.name)
  })

  it('is closed to employees whatever else they have', async () => {
    const { asha } = await withTeam()
    expect((await list(asha)).status).toBe(403)
  })

  it('finds somebody by name, email or position', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser({ name: 'Priya Nair' })
    await patch(admin, person, { employment: { position: 'Platform engineer' } })

    const byName = await list(admin, '?search=priya')
    const byRole = await list(admin, '?search=platform')

    expect(byName.body.people.map(p => p.name)).toContain('Priya Nair')
    expect(byRole.body.people.map(p => p.name)).toContain('Priya Nair')
  })

  it('names whose internship runs out inside the month', async () => {
    const admin = await makeUser({ role: 'admin' })
    const intern = await makeUser({ name: 'Kabir Intern' })
    const soon = new Date()
    soon.setDate(soon.getDate() + 10)

    await patch(admin, intern, {
      employment: { type: 'intern', endsOn: soon.toISOString() }
    })

    const res = await list(admin)
    expect(res.body.ending.map(p => p.name)).toContain('Kabir Intern')
  })
})

describe('what somebody is paid', () => {
  it('is not in a manager\'s copy of the record', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { manager, asha } = await withTeam()
    await patch(admin, asha, { salary: { amount: 900000, period: 'year' } })

    const res = await list(manager)
    const record = res.body.people.find(p => p.name === 'Asha Rao')

    expect(res.body.maySeePay).toBe(false)
    expect(record.salary).toBeUndefined()
  })

  it('is there for somebody whose role includes pay', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()
    await patch(admin, person, { salary: { amount: 1200000, period: 'year' } })

    const res = await request(app).get(`/api/people/${person._id}`).set(...authHeader(admin))

    expect(res.body.maySeePay).toBe(true)
    expect(res.body.person.salary.amount).toBe(1200000)
  })

  it('cannot be set by a manager who sends the field anyway', async () => {
    const { manager, asha } = await withTeam()

    const res = await patch(manager, asha, { salary: { amount: 5000000 } })

    expect(res.status).toBe(403)
    const after = await User.findById(asha._id).lean()
    expect(after.salary.amount).toBeNull()
  })

  it('is recorded as having moved, not as the figure it moved to', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()

    await patch(admin, person, { salary: { amount: 750000 } })

    const { default: AuditLog } = await import('../models/AuditLog.js')
    const [entry] = await AuditLog.find({ action: 'user.record_updated' })
      .sort({ createdAt: -1 }).limit(1).lean()

    expect(entry.changes[0].field).toBe('salary.amount')
    expect(entry.changes[0].to).toBe('•••')
  })
})

describe('editing a record', () => {
  it('keeps the joining date, the internship window and the experience', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()

    const res = await patch(admin, person, {
      employment: {
        position: 'Frontend intern',
        type: 'intern',
        joinedOn: '2026-07-01',
        startsOn: '2026-07-01',
        endsOn: '2026-12-31',
        experienceYears: 1.5
      }
    })

    expect(res.status).toBe(200)
    const after = await User.findById(person._id).lean()
    expect(after.employment.type).toBe('intern')
    expect(after.employment.experienceYears).toBe(1.5)
    expect(after.employment.endsOn.toISOString()).toMatch(/^2026-12-31/)
  })

  it('keeps a pincode with a leading zero exactly as typed', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()

    await patch(admin, person, { address: { pincode: '01234', city: 'Jaipur' } })

    const after = await User.findById(person._id).lean()
    expect(after.address.pincode).toBe('01234')
  })

  it('refuses a manager editing somebody on another team', async () => {
    const { manager } = await withTeam()
    const other = await withTeam()

    const res = await patch(manager, other.asha, { phone: '99999' })
    expect(res.status).toBe(404)
  })

  it('says plainly when nothing actually changed', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser({ name: 'Same Name' })

    const res = await patch(admin, person, { name: 'Same Name' })
    expect(res.body.message).toMatch(/nothing changed/i)
  })

  it('leaves a trail of what moved', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser({ name: 'Asha' })

    await patch(admin, person, { phone: '+91 98765 43210' })

    const { default: AuditLog } = await import('../models/AuditLog.js')
    const [entry] = await AuditLog.find({ action: 'user.record_updated', subjectName: 'Asha' })
      .sort({ createdAt: -1 }).limit(1).lean()

    expect(entry.changes[0]).toMatchObject({ field: 'phone', to: '+91 98765 43210' })
  })
})

describe('asking for a change instead of an email', () => {
  const raise = (user, body = {}) =>
    request(app).post('/api/support').set(...authHeader(user)).send({
      subject: 'My phone number is wrong',
      body: 'It still has my old number on it.',
      kind: 'data-change',
      request: { field: 'phone', proposed: '+91 90000 11111' },
      ...body
    })

  it('records what it is now as well as what it should be', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()
    await patch(admin, person, { phone: '+91 11111 00000' })

    const res = await raise(await User.findById(person._id))

    expect(res.status).toBe(201)
    expect(res.body.kind).toBe('data-change')
    expect(res.body.category).toBe('data')
    expect(res.body.request.current).toBe('+91 11111 00000')
    expect(res.body.request.proposed).toBe('+91 90000 11111')
  })

  it('refuses a field nobody may ask to change this way', async () => {
    const person = await makeUser()

    const res = await raise(person, { request: { field: 'salary.amount', proposed: '999' } })
    expect(res.status).toBe(400)
  })

  it('refuses a request with nothing in it', async () => {
    const person = await makeUser()

    const res = await raise(person, { request: { field: 'phone', proposed: '   ' } })
    expect(res.status).toBe(400)
  })

  it('is applied to the account with one click, and says so in the thread', async () => {
    const admin = await makeUser({ role: 'admin', name: 'The Admin' })
    const person = await makeUser()
    const ticket = await raise(person)

    const res = await request(app)
      .post(`/api/support/${ticket.body._id}/apply`).set(...authHeader(admin))

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('answered')
    expect(res.body.request.appliedBy).toBe('The Admin')
    expect(res.body.replies[0].body).toMatch(/Phone number is now/)

    const after = await User.findById(person._id).lean()
    expect(after.phone).toBe('+91 90000 11111')
  })

  it('will not apply the same change twice', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()
    const ticket = await raise(person)

    await request(app).post(`/api/support/${ticket.body._id}/apply`).set(...authHeader(admin))
    const again = await request(app)
      .post(`/api/support/${ticket.body._id}/apply`).set(...authHeader(admin))

    expect(again.status).toBe(400)
    expect(again.body.message).toMatch(/already in/i)
  })

  it('is not something the person who asked can do for themselves', async () => {
    const person = await makeUser()
    const ticket = await raise(person)

    const res = await request(app)
      .post(`/api/support/${ticket.body._id}/apply`).set(...authHeader(person))

    expect(res.status).toBe(403)
  })

  it('has nothing to apply on an ordinary report', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()
    const ticket = await raise(person, { kind: 'issue', request: undefined })

    const res = await request(app)
      .post(`/api/support/${ticket.body._id}/apply`).set(...authHeader(admin))

    expect(res.status).toBe(400)
  })

  it('tells the person it was done', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()
    const ticket = await raise(person)

    await request(app).post(`/api/support/${ticket.body._id}/apply`).set(...authHeader(admin))

    const { default: Notification } = await import('../models/Notification.js')
    const [latest] = await Notification.find({ recipient: person._id })
      .sort({ createdAt: -1 }).limit(1).lean()

    expect(latest.message).toMatch(/updated as you asked/i)
  })

  it('records the change as asked for, not as an admin idea', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()
    const ticket = await raise(person)

    await request(app).post(`/api/support/${ticket.body._id}/apply`).set(...authHeader(admin))

    const { default: AuditLog } = await import('../models/AuditLog.js')
    const [entry] = await AuditLog.find({ action: 'user.record_updated' })
      .sort({ createdAt: -1 }).limit(1).lean()

    expect(entry.note).toMatch(/help & support/i)
  })
})
