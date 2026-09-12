import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { authHeader, joinTeam, makeStandup, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

const isoDaysAgo = (n) => {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return new Date(d.getTime() - n * 86_400_000).toISOString().split('T')[0]
}

const isWeekend = (iso) => {
  const day = new Date(`${iso}T00:00:00.000Z`).getUTCDay()
  return day === 0 || day === 6
}

describe('GET /api/analytics/overview', () => {
  it('counts submissions and derives a participation rate', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()

    // Three weekdays inside the window
    const weekdays = Array.from({ length: 14 }, (_, i) => isoDaysAgo(i))
      .filter(d => !isWeekend(d))
      .slice(0, 3)
    for (const date of weekdays) await makeStandup(person, { date })

    const res = await request(app)
      .get('/api/analytics/overview?days=7').set(...authHeader(admin))

    expect(res.status).toBe(200)
    expect(res.body.headline.submissions).toBeGreaterThan(0)
    expect(res.body.headline.participationRate).toBeGreaterThan(0)
    expect(res.body.headline.participationRate).toBeLessThanOrEqual(100)
  })

  it('expects nothing at the weekend, so those days do not drag the rate down', async () => {
    const admin = await makeUser({ role: 'admin' })

    const res = await request(app)
      .get('/api/analytics/overview?days=30').set(...authHeader(admin))

    const weekend = res.body.daily.filter(d => d.weekend)
    expect(weekend.length).toBeGreaterThan(0)
    expect(weekend.every(d => d.expected === 0)).toBe(true)
    expect(res.body.range.workingDays).toBeLessThan(30)
  })

  it('returns one entry per day in the window, oldest first', async () => {
    const admin = await makeUser({ role: 'admin' })

    const res = await request(app)
      .get('/api/analytics/overview?days=7').set(...authHeader(admin))

    expect(res.body.daily).toHaveLength(7)
    expect(res.body.daily[0].date).toBe(res.body.range.from)
    expect(res.body.daily.at(-1).date).toBe(res.body.range.to)
  })

  it('averages mood on the documented scale', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()
    const day = isoDaysAgo(1)

    // great = 5
    await makeStandup(person, { date: day, mood: 'great' })

    const res = await request(app)
      .get('/api/analytics/overview?days=7').set(...authHeader(admin))

    expect(res.body.daily.find(d => d.date === day).avgMood).toBe(5)
  })

  it('leaves mood null for a day with no submissions rather than reporting zero', async () => {
    const admin = await makeUser({ role: 'admin' })

    const res = await request(app)
      .get('/api/analytics/overview?days=7').set(...authHeader(admin))

    // Zero would plot as the worst possible mood
    expect(res.body.daily.every(d => d.avgMood === null)).toBe(true)
  })

  it('breaks the window down by mood', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()
    await makeStandup(person, { date: isoDaysAgo(1), mood: 'stressed' })
    await makeStandup(person, { date: isoDaysAgo(2), mood: 'great' })

    const res = await request(app)
      .get('/api/analytics/overview?days=7').set(...authHeader(admin))

    expect(res.body.moodTotals.stressed).toBe(1)
    expect(res.body.moodTotals.great).toBe(1)
    expect(res.body.moodTotals.okay).toBe(0)
  })

  it('flags someone who barely submitted, and says why', async () => {
    const admin = await makeUser({ role: 'admin' })
    await makeUser({ name: 'Absent Person' })

    const res = await request(app)
      .get('/api/analytics/overview?days=30').set(...authHeader(admin))

    const flagged = res.body.atRisk.find(p => p.name === 'Absent Person')
    expect(flagged).toBeTruthy()
    expect(flagged.risks.join(' ')).toMatch(/working days/)
  })

  it('flags persistently low mood', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser({ name: 'Low Mood' })

    const weekdays = Array.from({ length: 20 }, (_, i) => isoDaysAgo(i))
      .filter(d => !isWeekend(d))
    for (const date of weekdays) await makeStandup(person, { date, mood: 'bad' })

    const res = await request(app)
      .get('/api/analytics/overview?days=30').set(...authHeader(admin))

    const flagged = res.body.atRisk.find(p => p.name === 'Low Mood')
    expect(flagged.risks).toContain('mood has been low')
  })

  it('does not flag someone submitting consistently in good spirits', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser({ name: 'Steady Person' })

    const weekdays = Array.from({ length: 40 }, (_, i) => isoDaysAgo(i))
      .filter(d => !isWeekend(d))
    for (const date of weekdays) await makeStandup(person, { date, mood: 'good' })

    const res = await request(app)
      .get('/api/analytics/overview?days=30').set(...authHeader(admin))

    expect(res.body.atRisk.find(p => p.name === 'Steady Person')).toBeUndefined()
  })

  it('scopes a manager to their own team', async () => {
    const alphaManager = await makeUser({ role: 'manager' })
    const alpha = await makeTeam(alphaManager, { name: 'Alpha' })
    const mine = await joinTeam(await makeUser({ name: 'Mine' }), alpha)

    const betaManager = await makeUser({ role: 'manager' })
    const beta = await makeTeam(betaManager, { name: 'Beta' })
    const theirs = await joinTeam(await makeUser({ name: 'Theirs' }), beta)

    await makeStandup(mine, { date: isoDaysAgo(1) })
    await makeStandup(theirs, { date: isoDaysAgo(1) })

    const res = await request(app)
      .get('/api/analytics/overview?days=7').set(...authHeader(alphaManager))

    const names = res.body.people.map(p => p.name)
    expect(names).toContain('Mine')
    expect(names).not.toContain('Theirs')
    expect(res.body.headline.submissions).toBe(1)
  })

  it('falls back to 30 days for an unsupported range', async () => {
    const admin = await makeUser({ role: 'admin' })

    const res = await request(app)
      .get('/api/analytics/overview?days=365').set(...authHeader(admin))

    expect(res.body.range.days).toBe(30)
  })

  it('is closed to employees', async () => {
    const employee = await makeUser()

    const res = await request(app)
      .get('/api/analytics/overview').set(...authHeader(employee))

    expect(res.status).toBe(403)
  })
})

describe('GET /api/analytics/export', () => {
  it('returns a CSV attachment', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser({ name: 'Asha Rao' })
    await makeStandup(person, { date: isoDaysAgo(1), today: 'Ship the export' })

    const res = await request(app)
      .get('/api/analytics/export?days=7').set(...authHeader(admin))

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toContain('attachment')
    expect(res.text).toContain('Asha Rao')
    expect(res.text).toContain('Ship the export')
  })

  it('quotes fields and escapes embedded quotes, so a comma cannot split a row', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()
    await makeStandup(person, {
      date: isoDaysAgo(1),
      today: 'Fixed the "orders, refunds" report'
    })

    const res = await request(app)
      .get('/api/analytics/export?days=7').set(...authHeader(admin))

    expect(res.text).toContain('"Fixed the ""orders, refunds"" report"')

    // Header plus exactly one data row — the comma did not create a third
    const lines = res.text.replace(/^﻿/, '').trim().split('\r\n')
    expect(lines).toHaveLength(2)
  })

  it('starts with a BOM so Excel reads it as UTF-8', async () => {
    const admin = await makeUser({ role: 'admin' })

    const res = await request(app)
      .get('/api/analytics/export?days=7').set(...authHeader(admin))

    expect(res.text.charCodeAt(0)).toBe(0xfeff)
  })

  it('exports only the manager\'s own team', async () => {
    const manager = await makeUser({ role: 'manager' })
    const team = await makeTeam(manager, { name: 'Alpha' })
    const mine = await joinTeam(await makeUser({ name: 'Mine' }), team)

    const otherTeam = await makeTeam(await makeUser({ role: 'manager' }), { name: 'Beta' })
    const theirs = await joinTeam(await makeUser({ name: 'Theirs' }), otherTeam)

    await makeStandup(mine, { date: isoDaysAgo(1) })
    await makeStandup(theirs, { date: isoDaysAgo(1) })

    const res = await request(app)
      .get('/api/analytics/export?days=7').set(...authHeader(manager))

    expect(res.text).toContain('Mine')
    expect(res.text).not.toContain('Theirs')
  })

  it('is closed to employees', async () => {
    const employee = await makeUser()

    const res = await request(app)
      .get('/api/analytics/export').set(...authHeader(employee))

    expect(res.status).toBe(403)
  })
})
