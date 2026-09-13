import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import SupportTicket from '../models/SupportTicket.js'
import { authHeader, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

const raise = (user, body = {}) =>
  request(app).post('/api/support').set(...authHeader(user)).send({
    subject: 'The export button does nothing',
    body: 'I click Export CSV on Analytics and no file arrives.',
    category: 'bug',
    ...body
  })

describe('raising something', () => {
  it('is open to anyone signed in — that is the point of it', async () => {
    const employee = await makeUser({ name: 'Asha Rao' })

    const res = await raise(employee)

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('open')
    expect(res.body.userName).toBe('Asha Rao')
  })

  it('refuses an empty report rather than storing a blank row', async () => {
    const employee = await makeUser()

    expect((await raise(employee, { subject: 'x' })).status).toBe(400)
    expect((await raise(employee, { body: '' })).status).toBe(400)
  })

  it('comes back in the reporter\'s own list', async () => {
    const employee = await makeUser()
    await raise(employee)

    const res = await request(app).get('/api/support/mine').set(...authHeader(employee))

    expect(res.body.tickets).toHaveLength(1)
    expect(res.body.tickets[0].subject).toMatch(/export button/i)
  })

  it('does not put one person\'s report in another person\'s list', async () => {
    const asha = await makeUser()
    const rohit = await makeUser()
    await raise(asha)

    const res = await request(app).get('/api/support/mine').set(...authHeader(rohit))
    expect(res.body.tickets).toHaveLength(0)
  })
})

describe('the queue', () => {
  it('is for an admin, not for everybody', async () => {
    const employee = await makeUser()
    const manager = await makeUser({ role: 'manager' })

    expect((await request(app).get('/api/support').set(...authHeader(employee))).status).toBe(403)
    expect((await request(app).get('/api/support').set(...authHeader(manager))).status).toBe(403)
  })

  it('shows an admin everything, with the open ones counted', async () => {
    const admin = await makeUser({ role: 'admin' })
    await raise(await makeUser({ name: 'One' }))
    await raise(await makeUser({ name: 'Two' }))

    const res = await request(app).get('/api/support').set(...authHeader(admin))

    expect(res.status).toBe(200)
    expect(res.body.tickets.length).toBeGreaterThanOrEqual(2)
    expect(res.body.openCount).toBeGreaterThanOrEqual(2)
  })

  it('puts what is still waiting above what is settled', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()

    const settled = await raise(person)
    await request(app).patch(`/api/support/${settled.body._id}`)
      .set(...authHeader(admin)).send({ status: 'closed' })

    const waiting = await raise(person, { subject: 'Still waiting on this one' })

    const res = await request(app).get('/api/support').set(...authHeader(admin))

    // A list ordered purely by date buries the thing somebody is waiting on
    const ids = res.body.tickets.map(t => String(t._id))
    expect(ids.indexOf(String(waiting.body._id)))
      .toBeLessThan(ids.indexOf(String(settled.body._id)))
  })

  it('filters by status', async () => {
    const admin = await makeUser({ role: 'admin' })
    await raise(await makeUser())

    const res = await request(app)
      .get('/api/support?status=closed').set(...authHeader(admin))

    expect(res.body.tickets.every(t => t.status === 'closed')).toBe(true)
  })
})

describe('answering', () => {
  it('records who replied and marks it answered', async () => {
    const admin = await makeUser({ role: 'admin', name: 'The Admin' })
    const person = await makeUser()
    const ticket = await raise(person)

    const res = await request(app)
      .post(`/api/support/${ticket.body._id}/reply`).set(...authHeader(admin))
      .send({ body: 'Fixed — it needed a newer browser. Try again.' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('answered')
    expect(res.body.replies[0].authorName).toBe('The Admin')
    expect(res.body.lastReplyBy).toBe('The Admin')
  })

  it('lets the reporter add to their own thread without calling it answered', async () => {
    const person = await makeUser()
    const ticket = await raise(person)

    const res = await request(app)
      .post(`/api/support/${ticket.body._id}/reply`).set(...authHeader(person))
      .send({ body: 'It also happens on the timesheet page.' })

    // Nobody has answered them yet, and saying otherwise would hide it
    expect(res.body.status).toBe('open')
    expect(res.body.replies).toHaveLength(1)
  })

  it('keeps one person out of another person\'s thread', async () => {
    const asha = await makeUser()
    const rohit = await makeUser()
    const ticket = await raise(asha)

    const res = await request(app)
      .post(`/api/support/${ticket.body._id}/reply`).set(...authHeader(rohit))
      .send({ body: 'reading over your shoulder' })

    expect(res.status).toBe(404)
  })

  it('refuses a reply to something already closed', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()
    const ticket = await raise(person)

    await request(app).patch(`/api/support/${ticket.body._id}`)
      .set(...authHeader(admin)).send({ status: 'closed' })

    const res = await request(app)
      .post(`/api/support/${ticket.body._id}/reply`).set(...authHeader(person))
      .send({ body: 'one more thing' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/closed/i)
  })

  it('refuses an empty reply', async () => {
    const admin = await makeUser({ role: 'admin' })
    const ticket = await raise(await makeUser())

    const res = await request(app)
      .post(`/api/support/${ticket.body._id}/reply`).set(...authHeader(admin))
      .send({ body: '   ' })

    expect(res.status).toBe(400)
  })
})

describe('closing', () => {
  it('is an admin\'s call', async () => {
    const person = await makeUser()
    const ticket = await raise(person)

    const theirs = await request(app).patch(`/api/support/${ticket.body._id}`)
      .set(...authHeader(person)).send({ status: 'closed' })
    expect(theirs.status).toBe(403)

    const admin = await makeUser({ role: 'admin' })
    const res = await request(app).patch(`/api/support/${ticket.body._id}`)
      .set(...authHeader(admin)).send({ status: 'closed' })

    expect(res.body.status).toBe('closed')
    expect(await SupportTicket.countDocuments({ status: 'closed' })).toBeGreaterThan(0)
  })
})
