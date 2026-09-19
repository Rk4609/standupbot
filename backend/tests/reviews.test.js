import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Review from '../models/Review.js'
import Notification from '../models/Notification.js'
import Kudos from '../models/Kudos.js'
import { invalidate } from '../services/roleService.js'
import { authHeader, joinTeam, makeStandup, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => { app = createApp({ globalRateLimit: false }) })
beforeEach(() => { invalidate() })

const crew = async () => {
  const admin = await makeUser({ role: 'admin', name: 'Admin' })
  const manager = await makeUser({ role: 'manager', name: 'Ravi' })
  const team = await makeTeam(manager)
  await joinTeam(manager, team)
  const asha = await joinTeam(await makeUser({ name: 'Asha' }), team)
  const outsider = await makeUser({ role: 'manager', name: 'Other' })
  await makeTeam(outsider)
  return { admin, manager, team, asha, outsider }
}

const start = (admin) => request(app).post('/api/reviews/cycles').set(...authHeader(admin))
  .send({ name: 'H1 2026', from: '2026-01-01', to: '2026-06-30', dueOn: '2026-07-15' })

const full = { quality: 4, delivery: 4, teamwork: 5, ownership: 3, communication: 4 }

describe('review rounds', () => {
  it('only an admin starts one; everybody gets a review with the right reviewer', async () => {
    const { admin, manager, asha } = await crew()

    expect((await start(manager)).status).toBe(403)
    const res = await start(admin)

    expect(res.status).toBe(201)
    const ashas = await Review.findOne({ employee: asha._id }).lean()
    expect(String(ashas.reviewer)).toBe(String(manager._id))
    // The manager's own review goes to the admins, not to themselves
    expect((await Review.findOne({ employee: manager._id }).lean()).reviewer).toBeNull()
    expect(await Review.findOne({ employee: admin._id })).toBeNull()
    expect(await Notification.countDocuments({ recipient: asha._id, type: 'review_started' })).toBe(1)
  })
})

describe('writing a review', () => {
  it('hides each half from the other side until it is finished', async () => {
    const { admin, manager, asha } = await crew()
    await start(admin)
    const review = await Review.findOne({ employee: asha._id }).lean()
    const id = review._id

    await request(app).put(`/api/reviews/${id}/self`).set(...authHeader(asha)).send({ ratings: full, wins: 'Shipped payroll' })
    await request(app).put(`/api/reviews/${id}/manager`).set(...authHeader(manager)).send({ ratings: full, strengths: 'Steady', growth: 'Speak up', overall: 4 })

    // Drafts on both sides: neither sees the other
    expect((await request(app).get(`/api/reviews/${id}`).set(...authHeader(manager))).body.review.self).toBeNull()
    expect((await request(app).get(`/api/reviews/${id}`).set(...authHeader(asha))).body.review.manager).toBeNull()

    const submit = await request(app).put(`/api/reviews/${id}/self`).set(...authHeader(asha)).send({ ratings: full, submit: true })
    expect(submit.body.review.status).toBe('manager')
    const seen = await request(app).get(`/api/reviews/${id}`).set(...authHeader(manager))
    expect(seen.body.review.self.wins).toBe('Shipped payroll')

    await request(app).post(`/api/reviews/${id}/share`).set(...authHeader(manager)).send({})
    const mine = await request(app).get(`/api/reviews/${id}`).set(...authHeader(asha))
    expect(mine.body.review.manager).toMatchObject({ overall: 4, strengths: 'Steady' })
    expect(mine.body.facts).toBeUndefined()
  })

  it('will not hand in a self-review with an area left unrated', async () => {
    const { admin, asha } = await crew()
    await start(admin)
    const review = await Review.findOne({ employee: asha._id }).lean()

    const res = await request(app).put(`/api/reviews/${review._id}/self`).set(...authHeader(asha))
      .send({ ratings: { quality: 4 }, submit: true })

    expect(res.status).toBe(400)
  })

  it('keeps other managers out, and gives the reviewer the facts', async () => {
    const { admin, manager, asha, outsider } = await crew()
    await start(admin)
    const review = await Review.findOne({ employee: asha._id }).lean()
    await makeStandup(asha, { date: '2026-03-02', hasBlocker: true })
    await makeStandup(asha, { date: '2026-03-03' })
    await Kudos.create({ from: manager._id, fromName: 'Ravi', to: asha._id, message: 'Great fix', value: 'helpful', createdAt: new Date('2026-04-01') })

    expect((await request(app).get(`/api/reviews/${review._id}`).set(...authHeader(outsider))).status).toBe(403)
    const res = await request(app).get(`/api/reviews/${review._id}`).set(...authHeader(manager))

    expect(res.body.facts).toMatchObject({ standups: 2, blockers: 1, kudos: 1 })
  })

  it('shares only a finished review, then lets the employee acknowledge it once', async () => {
    const { admin, manager, asha } = await crew()
    await start(admin)
    const { _id: id } = await Review.findOne({ employee: asha._id }).lean()

    expect((await request(app).post(`/api/reviews/${id}/share`).set(...authHeader(manager)).send({})).status).toBe(400)
    await request(app).put(`/api/reviews/${id}/manager`).set(...authHeader(manager)).send({ ratings: full, strengths: 'Steady', growth: 'Speak up', overall: 4 })
    expect((await request(app).post(`/api/reviews/${id}/share`).set(...authHeader(manager)).send({})).status).toBe(200)
    expect((await request(app).put(`/api/reviews/${id}/manager`).set(...authHeader(manager)).send({ overall: 5 })).status).toBe(400)

    const ack = await request(app).post(`/api/reviews/${id}/acknowledge`).set(...authHeader(asha)).send({ comment: 'Thanks' })
    expect(ack.body.review.status).toBe('acknowledged')
    expect((await request(app).post(`/api/reviews/${id}/acknowledge`).set(...authHeader(asha)).send({})).status).toBe(400)
  })

  it('lists the round with progress for the manager', async () => {
    const { admin, manager } = await crew()
    await start(admin)

    const res = await request(app).get('/api/reviews/cycles').set(...authHeader(manager))

    expect(res.body.cycle.name).toBe('H1 2026')
    expect(res.body.reviews.map(r => r.employeeName)).toEqual(['Asha'])
    expect(res.body.progress).toMatchObject({ total: 1, self: 1 })
    expect(res.body.canStart).toBe(false)
  })
})

describe('1:1s', () => {
  const book = (manager, employee, body = {}) => request(app).post('/api/one-on-ones').set(...authHeader(manager))
    .send({ employee: String(employee._id), date: '2026-09-22', time: '11:00', ...body })

  it('a manager books one with their own people only, and the employee hears', async () => {
    const { manager, asha, outsider } = await crew()

    expect((await book(outsider, asha)).status).toBe(403)
    expect((await book(asha, manager)).status).toBe(403)
    const res = await book(manager, asha)

    expect(res.status).toBe(201)
    expect(await Notification.countDocuments({ recipient: asha._id, type: 'oneonone_scheduled' })).toBe(1)
  })

  it('both sides add points; the private note never reaches the employee', async () => {
    const { manager, asha } = await crew()
    const { body } = await book(manager, asha)
    const id = body.oneOnOne._id

    await request(app).post(`/api/one-on-ones/${id}/items`).set(...authHeader(asha)).send({ kind: 'point', text: 'Promotion path' })
    await request(app).patch(`/api/one-on-ones/${id}`).set(...authHeader(manager)).send({ notes: 'Talked growth', privateNote: 'Flight risk?' })
    expect((await request(app).patch(`/api/one-on-ones/${id}`).set(...authHeader(asha)).send({ notes: 'x' })).status).toBe(403)

    const theirs = await request(app).get(`/api/one-on-ones/${id}`).set(...authHeader(asha))
    expect(theirs.body.oneOnOne.privateNote).toBeUndefined()
    expect(theirs.body.oneOnOne.notes).toBe('Talked growth')
    expect(theirs.body.oneOnOne.items[0]).toMatchObject({ text: 'Promotion path', by: 'employee' })
    const list = await request(app).get('/api/one-on-ones').set(...authHeader(asha))
    expect(list.body.oneOnOnes[0].privateNote).toBeUndefined()
  })

  it('carries open actions into the next one', async () => {
    const { manager, asha } = await crew()
    const first = (await book(manager, asha, { date: '2026-09-08' })).body.oneOnOne._id
    await request(app).post(`/api/one-on-ones/${first}/items`).set(...authHeader(manager)).send({ kind: 'action', text: 'Write the design doc', owner: 'employee' })
    const done = await request(app).post(`/api/one-on-ones/${first}/items`).set(...authHeader(manager)).send({ kind: 'action', text: 'Book training' })
    const doneId = done.body.oneOnOne.items[1]._id
    await request(app).patch(`/api/one-on-ones/${first}/items/${doneId}`).set(...authHeader(asha)).send({ done: true })

    const next = await book(manager, asha)

    expect(next.body.oneOnOne.items).toHaveLength(1)
    expect(next.body.oneOnOne.items[0]).toMatchObject({ text: 'Write the design doc', owner: 'employee', carried: true })
  })
})
