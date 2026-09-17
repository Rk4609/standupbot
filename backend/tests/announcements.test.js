import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Notification from '../models/Notification.js'
import { invalidate } from '../services/roleService.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => { app = createApp({ globalRateLimit: false }) })
beforeEach(() => { invalidate() })

const crew = async () => {
  const manager = await makeUser({ role: 'manager' })
  const team = await makeTeam(manager)
  const asha = await joinTeam(await makeUser({ name: 'Asha' }), team)
  return { manager, team, asha }
}

const post = (user, body = {}) => request(app).post('/api/announcements').set(...authHeader(user))
  .send({ title: 'Office closed Friday', body: 'Diwali — see you Monday.', ...body })
const list = (user) => request(app).get('/api/announcements').set(...authHeader(user))

describe('announcements', () => {
  it('lets an admin tell everybody, and each person hears about it', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { asha, manager } = await crew()

    const res = await post(admin, { important: true })

    expect(res.status).toBe(201)
    expect(res.body.announcement).toMatchObject({ important: true, readCount: 1, audienceCount: 2 })
    expect(await Notification.countDocuments({ type: 'announcement', recipient: { $in: [asha._id, manager._id] } })).toBe(2)
    expect((await list(asha)).body.announcements[0]).toMatchObject({ title: 'Office closed Friday', read: false, canDelete: false })
  })

  it('lets a manager tell only their own team', async () => {
    const { manager, asha } = await crew()
    const other = await crew()

    await post(manager, { team: null })

    expect((await list(asha)).body.announcements).toHaveLength(1)
    expect((await list(other.asha)).body.announcements).toHaveLength(0)
  })

  it('is not an employee\'s to post', async () => {
    const { asha } = await crew()
    expect((await post(asha)).status).toBe(403)
  })

  it('marks it read, and the author sees the count', async () => {
    const { manager, asha } = await crew()
    const { body } = await post(manager)

    const read = await request(app).post(`/api/announcements/${body.announcement._id}/read`).set(...authHeader(asha))

    expect(read.body.announcement.read).toBe(true)
    expect((await list(manager)).body.announcements[0]).toMatchObject({ readCount: 2, audienceCount: 1 })
  })
})
