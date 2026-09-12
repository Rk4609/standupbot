import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import User from '../models/User.js'
import { authHeader, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

describe('PATCH /api/users/:id/role', () => {
  it('lets an admin promote someone to manager', async () => {
    const admin = await makeUser({ role: 'admin' })
    const target = await makeUser()

    const res = await request(app)
      .patch(`/api/users/${target._id}/role`)
      .set(...authHeader(admin))
      .send({ role: 'manager' })

    expect(res.status).toBe(200)
    expect((await User.findById(target._id)).role).toBe('manager')
  })

  it('refuses an admin changing their own role', async () => {
    const admin = await makeUser({ role: 'admin' })

    const res = await request(app)
      .patch(`/api/users/${admin._id}/role`)
      .set(...authHeader(admin))
      .send({ role: 'employee' })

    expect(res.status).toBe(400)
    expect((await User.findById(admin._id)).role).toBe('admin')
  })

  it('refuses a role outside the allowed set', async () => {
    const admin = await makeUser({ role: 'admin' })
    const target = await makeUser()

    const res = await request(app)
      .patch(`/api/users/${target._id}/role`)
      .set(...authHeader(admin))
      .send({ role: 'superadmin' })

    expect(res.status).toBe(400)
    expect((await User.findById(target._id)).role).toBe('employee')
  })

  it('refuses a malformed id', async () => {
    const admin = await makeUser({ role: 'admin' })

    const res = await request(app)
      .patch('/api/users/not-an-id/role')
      .set(...authHeader(admin))
      .send({ role: 'manager' })

    expect(res.status).toBe(400)
  })

  it('does not let a manager grant roles', async () => {
    const manager = await makeUser({ role: 'manager' })
    const target = await makeUser()

    const res = await request(app)
      .patch(`/api/users/${target._id}/role`)
      .set(...authHeader(manager))
      .send({ role: 'admin' })

    expect(res.status).toBe(403)
    expect((await User.findById(target._id)).role).toBe('employee')
  })

  it('never returns the password hash with the updated user', async () => {
    const admin = await makeUser({ role: 'admin' })
    const target = await makeUser()

    const res = await request(app)
      .patch(`/api/users/${target._id}/role`)
      .set(...authHeader(admin))
      .send({ role: 'manager' })

    expect(res.body.user.password).toBeUndefined()
    expect(res.body.user.resetPasswordToken).toBeUndefined()
  })

  it('404s for a user that does not exist', async () => {
    const admin = await makeUser({ role: 'admin' })

    const res = await request(app)
      .patch('/api/users/aaaaaaaaaaaaaaaaaaaaaaaa/role')
      .set(...authHeader(admin))
      .send({ role: 'manager' })

    expect(res.status).toBe(404)
  })
})
