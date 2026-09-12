import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import AuditLog from '../models/AuditLog.js'
import Standup from '../models/Standup.js'
import { authHeader, joinTeam, makeStandup, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

afterEach(() => {
  vi.useRealTimers()
})

const freezeAt = (iso) => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(iso))
}

const todayUTC = () => new Date().toISOString().split('T')[0]

const edit = (user, standup, body) =>
  request(app).put(`/api/standups/${standup._id}`).set(...authHeader(user)).send(body)

describe('editing your own standup', () => {
  it('updates the fields you sent and leaves the rest alone', async () => {
    const person = await makeUser()
    const standup = await makeStandup(person, { date: todayUTC(), today: 'Old plan' })

    const res = await edit(person, standup, { today: 'New plan' })

    expect(res.status).toBe(200)
    expect(res.body.standup.today).toBe('New plan')
    expect(res.body.standup.yesterday).toBe('Shipped something')
  })

  it('recomputes whether there is a blocker', async () => {
    const person = await makeUser()
    const standup = await makeStandup(person, { date: todayUTC() })

    const added = await edit(person, standup, { blockers: 'Waiting on the API key' })
    expect(added.body.standup.hasBlocker).toBe(true)

    const cleared = await edit(person, standup, { blockers: 'None' })
    expect(cleared.body.standup.hasBlocker).toBe(false)
  })

  it('is refused once the day the standup covers has passed', async () => {
    const person = await makeUser()
    const standup = await makeStandup(person, { date: '2020-01-02' })

    const res = await edit(person, standup, { today: 'Rewriting history' })

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/on the day it covers/i)
  })

  it('judges "today" in the author\'s own zone', async () => {
    // 20:30 UTC is already the 13th in Delhi
    freezeAt('2026-03-12T20:30:00.000Z')

    const delhi = await makeUser({ timezone: 'Asia/Kolkata' })
    const standup = await makeStandup(delhi, { date: '2026-03-13' })

    const res = await edit(delhi, standup, { today: 'Still my day' })
    expect(res.status).toBe(200)
  })

  it('is refused on somebody else\'s standup', async () => {
    const mine = await makeUser()
    const theirs = await makeUser()
    const standup = await makeStandup(theirs, { date: todayUTC() })

    const res = await edit(mine, standup, { today: 'Not mine to change' })
    expect(res.status).toBe(403)
  })

  it('rejects an edit that would empty a required field', async () => {
    const person = await makeUser()
    const standup = await makeStandup(person, { date: todayUTC() })

    const res = await edit(person, standup, { today: '   ' })
    expect(res.status).toBe(400)
  })

  it('rejects an empty edit rather than writing a meaningless entry', async () => {
    const person = await makeUser()
    const standup = await makeStandup(person, { date: todayUTC() })

    const res = await edit(person, standup, {})
    expect(res.status).toBe(400)
  })
})

describe('a manager editing their team', () => {
  const setup = async () => {
    const manager = await makeUser({ role: 'manager' })
    const team = await makeTeam(manager, { name: 'Alpha' })
    const member = await joinTeam(await makeUser({ name: 'Team Member' }), team)
    return { manager, team, member }
  }

  it('can change an old standup, which the author no longer can', async () => {
    const { manager, member } = await setup()
    const standup = await makeStandup(member, { date: '2020-01-02' })

    expect((await edit(member, standup, { today: 'x' })).status).toBe(403)
    expect((await edit(manager, standup, { today: 'Corrected' })).status).toBe(200)
  })

  it('cannot touch another team\'s standup', async () => {
    const { manager } = await setup()

    const otherTeam = await makeTeam(await makeUser({ role: 'manager' }), { name: 'Beta' })
    const outsider = await joinTeam(await makeUser(), otherTeam)
    const standup = await makeStandup(outsider, { date: todayUTC() })

    const res = await edit(manager, standup, { today: 'Reaching too far' })
    expect(res.status).toBe(403)
  })
})

describe('the audit trail', () => {
  const trailFor = (standup) => AuditLog.find({ entityId: standup._id }).lean()

  it('records what changed, from and to', async () => {
    const person = await makeUser({ name: 'Asha Rao' })
    const standup = await makeStandup(person, { date: todayUTC(), today: 'Old plan' })

    await edit(person, standup, { today: 'New plan', mood: 'great' })

    const [entry] = await trailFor(standup)
    expect(entry.action).toBe('standup.updated')
    expect(entry.actorName).toBe('Asha Rao')
    expect(entry.note).toBe(standup.date)

    const byField = Object.fromEntries(entry.changes.map(c => [c.field, c]))
    expect(byField.today).toEqual({ field: 'today', from: 'Old plan', to: 'New plan' })
    expect(byField.mood).toEqual({ field: 'mood', from: 'good', to: 'great' })
    expect(byField.yesterday).toBeUndefined()
  })

  it('names the manager as the actor and the author as the subject', async () => {
    const manager = await makeUser({ role: 'manager', name: 'The Manager' })
    const team = await makeTeam(manager, { name: 'Alpha' })
    const member = await joinTeam(await makeUser({ name: 'The Member' }), team)
    const standup = await makeStandup(member, { date: todayUTC() })

    await edit(manager, standup, { today: 'Corrected by the lead' })

    const [entry] = await trailFor(standup)
    expect(entry.actorName).toBe('The Manager')
    expect(entry.subjectName).toBe('The Member')
  })

  it('writes nothing when the edit changes nothing', async () => {
    const person = await makeUser()
    const standup = await makeStandup(person, { date: todayUTC(), today: 'Same' })

    const res = await edit(person, standup, { today: 'Same' })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('No changes')
    expect(await trailFor(standup)).toHaveLength(0)
  })

  it('keeps one entry per edit, oldest first in the record', async () => {
    const person = await makeUser()
    const standup = await makeStandup(person, { date: todayUTC() })

    await edit(person, standup, { today: 'First revision' })
    await edit(person, standup, { today: 'Second revision' })

    expect(await trailFor(standup)).toHaveLength(2)
  })

  it('records a deletion with the content that was removed', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()
    const standup = await makeStandup(person, {
      date: todayUTC(),
      today: 'Work that is about to vanish'
    })

    const res = await request(app)
      .delete(`/api/standups/${standup._id}`).set(...authHeader(admin))

    expect(res.status).toBe(200)
    expect(await Standup.findById(standup._id)).toBeNull()

    const [entry] = await trailFor(standup)
    expect(entry.action).toBe('standup.deleted')
    expect(entry.changes.find(c => c.field === 'today').from)
      .toBe('Work that is about to vanish')
  })

  it('records a role change, which used to go only to the console', async () => {
    const admin = await makeUser({ role: 'admin', name: 'The Admin' })
    const target = await makeUser({ name: 'Promoted Person' })

    const res = await request(app)
      .patch(`/api/users/${target._id}/role`).set(...authHeader(admin))
      .send({ role: 'manager' })

    expect(res.status).toBe(200)

    const [entry] = await AuditLog.find({ entityId: target._id }).lean()
    expect(entry.action).toBe('user.role_changed')
    expect(entry.actorName).toBe('The Admin')
    expect(entry.subjectName).toBe('Promoted Person')
    expect(entry.changes[0]).toEqual({ field: 'role', from: 'employee', to: 'manager' })
  })
})

describe('GET /api/standups/:id/history', () => {
  it('gives the author their own trail, even after the edit window closed', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()
    const standup = await makeStandup(person, { date: '2020-01-02' })

    await edit(admin, standup, { today: 'Fixed by an admin' })

    const res = await request(app)
      .get(`/api/standups/${standup._id}/history`).set(...authHeader(person))

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].changes[0].to).toBe('Fixed by an admin')
  })

  it('is closed to someone outside the team', async () => {
    const person = await makeUser()
    const standup = await makeStandup(person, { date: todayUTC() })
    const stranger = await makeUser()

    const res = await request(app)
      .get(`/api/standups/${standup._id}/history`).set(...authHeader(stranger))

    expect(res.status).toBe(403)
  })
})

describe('GET /api/audit', () => {
  it('is closed to employees', async () => {
    const employee = await makeUser()
    const res = await request(app).get('/api/audit').set(...authHeader(employee))
    expect(res.status).toBe(403)
  })

  it('returns entries newest first, with the actions available to filter by', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()
    const standup = await makeStandup(person, { date: todayUTC() })

    await edit(admin, standup, { today: 'One' })
    await edit(admin, standup, { today: 'Two' })

    const res = await request(app).get('/api/audit').set(...authHeader(admin))

    expect(res.status).toBe(200)
    expect(res.body.entries.length).toBeGreaterThanOrEqual(2)
    expect(res.body.entries[0].changes[0].to).toBe('Two')
    expect(res.body.actions).toContain('standup.updated')
  })

  it('filters by action', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()
    const standup = await makeStandup(person, { date: todayUTC() })
    await edit(admin, standup, { today: 'An edit' })

    const res = await request(app)
      .get('/api/audit?action=user.role_changed').set(...authHeader(admin))

    expect(res.body.entries.every(e => e.action === 'user.role_changed')).toBe(true)
  })

  it('shows a manager their own team and not another', async () => {
    const manager = await makeUser({ role: 'manager' })
    const team = await makeTeam(manager, { name: 'Alpha' })
    const mine = await joinTeam(await makeUser({ name: 'Mine' }), team)

    const otherTeam = await makeTeam(await makeUser({ role: 'manager' }), { name: 'Beta' })
    const theirs = await joinTeam(await makeUser({ name: 'Theirs' }), otherTeam)

    const admin = await makeUser({ role: 'admin' })
    await edit(admin, await makeStandup(mine, { date: todayUTC() }), { today: 'Mine edited' })
    await edit(admin, await makeStandup(theirs, { date: todayUTC() }), { today: 'Theirs edited' })

    const res = await request(app).get('/api/audit').set(...authHeader(manager))

    const names = res.body.entries.map(e => e.subjectName)
    expect(names).toContain('Mine')
    expect(names).not.toContain('Theirs')
  })

  it('pages, and clamps a page past the end to the last one', async () => {
    const admin = await makeUser({ role: 'admin' })
    const person = await makeUser()
    const standup = await makeStandup(person, { date: todayUTC() })
    for (const text of ['a', 'b', 'c']) await edit(admin, standup, { today: text })

    const res = await request(app)
      .get('/api/audit?limit=10&page=999').set(...authHeader(admin))

    expect(res.body.page).toBe(res.body.totalPages)
    expect(res.body.entries.length).toBeGreaterThan(0)
  })
})
