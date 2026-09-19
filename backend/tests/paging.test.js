import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Kudos from '../models/Kudos.js'
import { invalidate } from '../services/roleService.js'
import { pageInfo, paging } from '../utils/paging.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

describe('paging', () => {
  it('reads page and limit, and falls back on anything it does not offer', () => {
    expect(paging({ page: '3', limit: '40' })).toEqual({ page: 3, limit: 40, skip: 80 })
    expect(paging({ limit: '7' })).toEqual({ page: 1, limit: 10, skip: 0 })
    expect(paging({ page: '-2', limit: '1000' }, 20)).toEqual({ page: 1, limit: 20, skip: 0 })
    // An older size in a saved link still works
    expect(paging({ limit: '50' }).limit).toBe(50)
  })

  it('says how many pages there are and which sizes to offer', () => {
    expect(pageInfo({ page: 2, limit: 10 }, 25)).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3, pageSizes: [10, 20, 40, 100] })
    expect(pageInfo({ page: 1, limit: 10 }, 0).totalPages).toBe(1)
  })
})

describe('a paged list', () => {
  let app
  beforeAll(() => { app = createApp({ globalRateLimit: false }) })
  beforeEach(() => { invalidate() })

  it('returns the size asked for', async () => {
    const manager = await makeUser({ role: 'manager' })
    const team = await makeTeam(manager)
    const asha = await joinTeam(await makeUser({ name: 'Asha' }), team)
    await Kudos.insertMany(Array.from({ length: 25 }, (_, i) => ({
      from: manager._id, fromName: 'Ravi', to: asha._id, toName: 'Asha', team: team._id, message: `Thanks ${i}`
    })))

    const res = await request(app).get('/api/kudos').query({ page: 3, limit: 10 }).set(...authHeader(asha))

    expect(res.body.kudos).toHaveLength(5)
    expect(res.body).toMatchObject({ page: 3, limit: 10, total: 25, totalPages: 3, pageSizes: [10, 20, 40, 100] })
  })
})
