import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import User from '../models/User.js'
import Standup from '../models/Standup.js'
import { authHeader, joinTeam, makeStandup, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

const today = () => new Date().toISOString().split('T')[0]

describe('POST /api/standups', () => {
  it('saves a standup for today', async () => {
    const user = await makeUser()

    const res = await request(app).post('/api/standups').set(...authHeader(user)).send({
      yesterday: 'Finished the import',
      today: 'Start the export',
      mood: 'great'
    })

    expect(res.status).toBe(201)
    expect(res.body.date).toBe(today())
    expect(res.body.mood).toBe('great')
  })

  it('refuses a second standup on the same day', async () => {
    const user = await makeUser()
    const body = { yesterday: 'a', today: 'b' }

    await request(app).post('/api/standups').set(...authHeader(user)).send(body)
    const second = await request(app).post('/api/standups').set(...authHeader(user)).send(body)

    expect(second.status).toBe(400)
    expect(await Standup.countDocuments({ user: user._id })).toBe(1)
  })

  it('accepts a standup with only a plan, which is the default now', async () => {
    // "What did you do yesterday" is no longer asked by default — the answer
    // is usually yesterday's plan, which the app already has
    const user = await makeUser()

    const res = await request(app)
      .post('/api/standups').set(...authHeader(user)).send({ today: 'only today' })

    expect(res.status).toBe(201)
    expect(res.body.yesterday).toBe('')
  })

  it('still refuses one with no plan in it', async () => {
    const user = await makeUser()

    const res = await request(app)
      .post('/api/standups').set(...authHeader(user)).send({ yesterday: 'did a thing' })

    expect(res.status).toBe(400)
  })

  it('rejects a mood outside the allowed set', async () => {
    const user = await makeUser()

    const res = await request(app).post('/api/standups').set(...authHeader(user)).send({
      yesterday: 'a', today: 'b', mood: 'euphoric'
    })

    expect(res.status).toBe(400)
  })

  it('flags a blocker when one is described', async () => {
    const user = await makeUser()

    const res = await request(app).post('/api/standups').set(...authHeader(user)).send({
      yesterday: 'a', today: 'b', blockers: 'Waiting on credentials'
    })

    expect(res.body.hasBlocker).toBe(true)
  })

  it('does not flag a blocker for an empty field or the word none', async () => {
    const one = await makeUser()
    const two = await makeUser()

    const empty = await request(app).post('/api/standups').set(...authHeader(one))
      .send({ yesterday: 'a', today: 'b', blockers: '' })
    const none = await request(app).post('/api/standups').set(...authHeader(two))
      .send({ yesterday: 'a', today: 'b', blockers: 'None' })

    expect(empty.body.hasBlocker).toBe(false)
    expect(none.body.hasBlocker).toBe(false)
  })

  it('starts a streak at 1', async () => {
    const user = await makeUser()

    await request(app).post('/api/standups').set(...authHeader(user))
      .send({ yesterday: 'a', today: 'b' })

    expect((await User.findById(user._id)).streak).toBe(1)
  })

  it('continues a streak when yesterday was the last submission', async () => {
    const yesterday = new Date(Date.now() - 86_400_000)
    const user = await makeUser()
    user.streak = 4
    user.lastSubmission = yesterday
    await user.save()

    await request(app).post('/api/standups').set(...authHeader(user))
      .send({ yesterday: 'a', today: 'b' })

    expect((await User.findById(user._id)).streak).toBe(5)
  })

  it('resets a streak after a missed day', async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000)
    const user = await makeUser()
    user.streak = 9
    user.lastSubmission = threeDaysAgo
    await user.save()

    await request(app).post('/api/standups').set(...authHeader(user))
      .send({ yesterday: 'a', today: 'b' })

    expect((await User.findById(user._id)).streak).toBe(1)
  })

  it('succeeds for a team member even though no socket server is attached', async () => {
    // The app is mounted without socket.io here; notifying must not be fatal
    const manager = await makeUser({ role: 'manager' })
    const team = await makeTeam(manager)
    const employee = await joinTeam(await makeUser(), team)

    const res = await request(app).post('/api/standups').set(...authHeader(employee))
      .send({ yesterday: 'a', today: 'b', blockers: 'something blocking' })

    expect(res.status).toBe(201)
  })

  it('strips unknown fields rather than storing them', async () => {
    const user = await makeUser()

    const res = await request(app).post('/api/standups').set(...authHeader(user)).send({
      yesterday: 'a', today: 'b', hasBlocker: true, user: 'someone-else'
    })

    expect(res.status).toBe(400) // strict schema rejects the smuggled keys
  })
})

describe('GET /api/standups/my', () => {
  it('returns only the caller\'s own standups', async () => {
    const mine = await makeUser()
    const theirs = await makeUser()
    await makeStandup(mine, { today: 'mine' })
    await makeStandup(theirs, { today: 'theirs' })

    const res = await request(app).get('/api/standups/my').set(...authHeader(mine))

    expect(res.body).toHaveLength(1)
    expect(res.body[0].today).toBe('mine')
  })
})
