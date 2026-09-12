import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import User from '../models/User.js'
import Standup from '../models/Standup.js'
import { authHeader, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

afterEach(() => {
  vi.useRealTimers()
})

/** Freeze the clock at an instant, so "which day is it" has one right answer. */
const freezeAt = (iso) => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(iso))
}

const body = {
  yesterday: 'Reviewed the export',
  today: 'Wire up the templates',
  blockers: 'None',
  mood: 'good'
}

const post = (user) =>
  request(app).post('/api/standups').set(...authHeader(user)).send(body)

describe('submitting a standup across timezones', () => {
  it('files it under the submitter\'s day, not the server\'s', async () => {
    // 20:30 UTC is already the next morning in Delhi
    freezeAt('2026-03-12T20:30:00.000Z')

    const delhi = await makeUser({ timezone: 'Asia/Kolkata' })
    const res = await post(delhi)

    expect(res.status).toBe(201)
    expect(res.body.date).toBe('2026-03-13')
  })

  it('files it under the previous day for a zone behind UTC', async () => {
    // 00:30 UTC on the 13th is still the evening of the 12th in New York
    freezeAt('2026-03-13T00:30:00.000Z')

    const newYork = await makeUser({ timezone: 'America/New_York' })
    const res = await post(newYork)

    expect(res.body.date).toBe('2026-03-12')
  })

  it('uses UTC for an account that never chose a zone', async () => {
    freezeAt('2026-03-12T20:30:00.000Z')

    const unset = await makeUser()
    const res = await post(unset)

    expect(res.body.date).toBe('2026-03-12')
  })

  it('lets two people in different zones file the same instant on different days', async () => {
    freezeAt('2026-03-12T20:30:00.000Z')

    const delhi = await makeUser({ timezone: 'Asia/Kolkata' })
    const london = await makeUser({ timezone: 'Europe/London' })

    const [a, b] = [await post(delhi), await post(london)]

    expect(a.body.date).toBe('2026-03-13')
    expect(b.body.date).toBe('2026-03-12')
  })

  it('still refuses a second standup on the same local day', async () => {
    freezeAt('2026-03-12T20:30:00.000Z')
    const delhi = await makeUser({ timezone: 'Asia/Kolkata' })
    expect((await post(delhi)).status).toBe(201)

    // Four hours later — a new UTC day, but the same day in Delhi
    freezeAt('2026-03-13T00:30:00.000Z')
    const again = await post(delhi)

    expect(again.status).toBe(400)
    expect(again.body.message).toMatch(/already submitted/i)
  })

  it('accepts the next one once the local day has turned over', async () => {
    freezeAt('2026-03-12T20:30:00.000Z')
    const delhi = await makeUser({ timezone: 'Asia/Kolkata' })
    await post(delhi)

    // 19:00 UTC the next day is the 14th in Delhi
    freezeAt('2026-03-13T19:00:00.000Z')
    const next = await post(delhi)

    expect(next.status).toBe(201)
    expect(next.body.date).toBe('2026-03-14')
  })
})

describe('streaks across timezones', () => {
  const streakOf = async (user) => (await User.findById(user._id)).streak

  it('counts consecutive local days', async () => {
    const delhi = await makeUser({ timezone: 'Asia/Kolkata' })

    freezeAt('2026-03-12T05:00:00.000Z') // 12th in Delhi
    await post(delhi)
    expect(await streakOf(delhi)).toBe(1)

    freezeAt('2026-03-12T20:30:00.000Z') // 13th in Delhi
    await post(delhi)
    expect(await streakOf(delhi)).toBe(2)

    freezeAt('2026-03-13T20:30:00.000Z') // 14th in Delhi
    await post(delhi)
    expect(await streakOf(delhi)).toBe(3)
  })

  it('resets after a missed local day', async () => {
    const delhi = await makeUser({ timezone: 'Asia/Kolkata' })

    freezeAt('2026-03-12T05:00:00.000Z')
    await post(delhi)

    freezeAt('2026-03-14T05:00:00.000Z') // the 13th was missed
    await post(delhi)

    expect(await streakOf(delhi)).toBe(1)
  })

  it('does not break a streak for an account upgraded mid-run', async () => {
    // No lastStandupDate — the field did not exist when they last submitted
    const delhi = await makeUser({ timezone: 'Asia/Kolkata' })
    await User.updateOne(
      { _id: delhi._id },
      {
        streak: 4,
        lastStandupDate: null,
        // 21:00 UTC on the 11th is the 12th in Delhi
        lastSubmission: new Date('2026-03-11T21:00:00.000Z')
      }
    )

    freezeAt('2026-03-12T20:30:00.000Z') // the 13th in Delhi
    await post(delhi)

    expect(await streakOf(delhi)).toBe(5)
  })

  it('records the local day it counted, for the next comparison', async () => {
    const delhi = await makeUser({ timezone: 'Asia/Kolkata' })

    freezeAt('2026-03-12T20:30:00.000Z')
    await post(delhi)

    expect((await User.findById(delhi._id)).lastStandupDate).toBe('2026-03-13')
  })
})

describe('the timezone on the account', () => {
  it('is captured at sign-up', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Zone Person',
      email: `zone.${Date.now()}@example.com`,
      password: 'secret123',
      timezone: 'Europe/Lisbon'
    })

    expect(res.status).toBe(201)
    expect(res.body.timezone).toBe('Europe/Lisbon')
  })

  it('is refused at sign-up if it is not a real zone', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Zone Person',
      email: `zone.${Date.now()}@example.com`,
      password: 'secret123',
      timezone: 'Middle/Earth'
    })

    expect(res.status).toBe(400)
  })

  it('is refused if it is an ambiguous abbreviation', async () => {
    // ICU resolves 'IST' to Asia/Calcutta, which is wrong for Dublin
    const user = await makeUser()
    const res = await request(app)
      .put('/api/users/profile').set(...authHeader(user))
      .send({ name: user.name, timezone: 'IST' })

    expect(res.status).toBe(400)
  })

  it('can be changed from the profile, and takes effect immediately', async () => {
    const user = await makeUser({ timezone: 'America/New_York' })

    const update = await request(app)
      .put('/api/users/profile').set(...authHeader(user))
      .send({ name: user.name, timezone: 'Asia/Kolkata' })

    expect(update.status).toBe(200)
    expect(update.body.timezone).toBe('Asia/Kolkata')

    freezeAt('2026-03-12T20:30:00.000Z')
    const res = await post(user)
    expect(res.body.date).toBe('2026-03-13')
  })

  it('files under UTC rather than failing if the stored zone goes bad', async () => {
    const user = await makeUser()
    // Written straight past validation, as a bad migration might
    await User.collection.updateOne(
      { _id: user._id },
      { $set: { timezone: 'Europe/Atlantis' } }
    )

    freezeAt('2026-03-12T20:30:00.000Z')
    const res = await post(user)

    expect(res.status).toBe(201)
    expect(res.body.date).toBe('2026-03-12')
  })
})

describe('the last 7 days', () => {
  it('ends on the viewer\'s today', async () => {
    freezeAt('2026-03-12T20:30:00.000Z')

    const delhi = await makeUser({ timezone: 'Asia/Kolkata', role: 'admin' })
    await Standup.create({
      user: delhi._id,
      team: null,
      yesterday: 'a',
      today: 'b',
      blockers: 'None',
      hasBlocker: false,
      mood: 'good',
      date: '2026-03-13'
    })

    const res = await request(app)
      .get('/api/standups/stats').set(...authHeader(delhi))

    expect(res.status).toBe(200)
    const dates = res.body.map(d => d.date || d._id || d.day).filter(Boolean)
    expect(dates.at(-1)).toBe('2026-03-13')
  })
})
