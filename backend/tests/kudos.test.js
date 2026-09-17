import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Kudos from '../models/Kudos.js'
import Notification from '../models/Notification.js'
import { invalidate } from '../services/roleService.js'
import { DAILY_LIMIT } from '../controllers/kudosController.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

beforeEach(() => {
  invalidate()
})

const crew = async () => {
  const manager = await makeUser({ role: 'manager', name: 'Deepak' })
  const team = await makeTeam(manager)
  const asha = await joinTeam(await makeUser({ name: 'Asha' }), team)
  const bela = await joinTeam(await makeUser({ name: 'Bela' }), team)
  return { manager, team, asha, bela }
}

const give = (from, to, body = {}) =>
  request(app).post('/api/kudos').set(...authHeader(from)).send({
    to: String(to._id), value: 'helpful', message: 'Thanks for fixing the release build', ...body
  })

describe('giving kudos', () => {
  it('thanks a teammate, where the team can see it, and tells them', async () => {
    const { asha, bela } = await crew()

    const res = await give(asha, bela)

    expect(res.status).toBe(201)
    expect(res.body.kudos).toMatchObject({ from: { name: 'Asha' }, to: { name: 'Bela' }, value: 'helpful', cheers: 0 })
    const note = await Notification.findOne({ recipient: bela._id, type: 'kudos_received' }).lean()
    expect(note.message).toMatch(/Asha gave you kudos for being helpful/)
  })

  it('lets a teammate thank their manager, and the manager thank the team', async () => {
    const { manager, asha } = await crew()
    expect((await give(asha, manager)).status).toBe(201)
    expect((await give(manager, asha)).status).toBe(201)
  })

  it('is not for yourself', async () => {
    const { asha } = await crew()
    expect((await give(asha, asha)).status).toBe(400)
  })

  it('is not for somebody on another team', async () => {
    const { asha } = await crew()
    const other = await crew()
    expect((await give(asha, other.bela)).status).toBe(403)
  })

  it('stops at a daily limit', async () => {
    const { asha, bela } = await crew()
    for (let i = 0; i < DAILY_LIMIT; i++) await give(asha, bela, { message: `Thanks number ${i}` })

    const res = await give(asha, bela)

    expect(res.status).toBe(429)
  })

  it('offers only teammates to thank', async () => {
    const { manager, asha } = await crew()
    await crew()

    const res = await request(app).get('/api/kudos/people').set(...authHeader(asha))

    expect(res.body.people.map(p => p.name).sort()).toEqual(['Bela', 'Deepak'])
    expect(res.body.people.map(p => String(p._id))).toContain(String(manager._id))
  })
})

describe('the feed', () => {
  it('shows the team\'s kudos and who was thanked most this month, but not another team\'s', async () => {
    const { manager, asha, bela } = await crew()
    const other = await crew()
    await give(asha, bela)
    await give(manager, bela, { message: 'Great demo today' })
    await give(bela, asha, { message: 'Thanks for the pairing' })
    await give(other.asha, other.bela, { message: 'Elsewhere' })

    const res = await request(app).get('/api/kudos').set(...authHeader(asha))

    expect(res.body.kudos).toHaveLength(3)
    expect(res.body.kudos.map(k => k.message)).not.toContain('Elsewhere')
    expect(res.body.top[0]).toMatchObject({ name: 'Bela', count: 2 })
  })

  it('lets a teammate cheer, once, and take it back', async () => {
    const { asha, bela, manager } = await crew()
    const { body } = await give(asha, bela)
    const cheer = () => request(app).post(`/api/kudos/${body.kudos._id}/cheer`).set(...authHeader(manager))

    expect((await cheer()).body.kudos).toMatchObject({ cheers: 1, cheered: true })
    expect((await cheer()).body.kudos).toMatchObject({ cheers: 0, cheered: false })
  })

  it('does not let another team cheer', async () => {
    const { asha, bela } = await crew()
    const other = await crew()
    const { body } = await give(asha, bela)

    const res = await request(app).post(`/api/kudos/${body.kudos._id}/cheer`).set(...authHeader(other.asha))

    expect(res.status).toBe(404)
  })

  it('lets the author remove it within a day, and nobody else but an admin', async () => {
    const { asha, bela } = await crew()
    const admin = await makeUser({ role: 'admin' })
    const first = (await give(asha, bela)).body.kudos
    const second = (await give(asha, bela, { message: 'Another one' })).body.kudos

    expect((await request(app).delete(`/api/kudos/${first._id}`).set(...authHeader(bela))).status).toBe(403)
    expect((await request(app).delete(`/api/kudos/${first._id}`).set(...authHeader(asha))).status).toBe(200)

    // Straight on the collection: mongoose keeps createdAt from being changed
    await Kudos.collection.updateOne({ _id: new Kudos.base.Types.ObjectId(second._id) }, { $set: { createdAt: new Date(Date.now() - 2 * 86_400_000) } })
    expect((await request(app).delete(`/api/kudos/${second._id}`).set(...authHeader(asha))).status).toBe(403)
    expect((await request(app).delete(`/api/kudos/${second._id}`).set(...authHeader(admin))).status).toBe(200)
  })
})
