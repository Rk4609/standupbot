import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

/**
 * Lives in its own file: the limiters keep their counters in module state, and
 * exhausting them here would starve the other suites. Vitest gives each file a
 * fresh module registry.
 */
describe('rate limiting', () => {
  it('locks out repeated failed logins', async () => {
    await makeUser({ email: 'target@example.com', password: 'secret123' })

    const codes = []
    for (let i = 0; i < 12; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'target@example.com', password: 'wrong-password' })
      codes.push(res.status)
    }

    expect(codes.slice(0, 10)).toEqual(Array(10).fill(401))
    expect(codes.at(-1)).toBe(429)
  })

  it('does not spend the budget on successful logins', async () => {
    await makeUser({ email: 'good@example.com', password: 'secret123' })

    // Twelve correct sign-ins in a row must all succeed — otherwise a busy
    // office behind one address would lock itself out
    for (let i = 0; i < 12; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'good@example.com', password: 'secret123' })
      expect(res.status).toBe(200)
    }
  })

  it('caps password reset requests', async () => {
    await makeUser({ email: 'reset-target@example.com' })

    const codes = []
    for (let i = 0; i < 7; i++) {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'reset-target@example.com' })
      codes.push(res.status)
    }

    expect(codes.filter(c => c === 429).length).toBeGreaterThan(0)
  })

  it('answers a throttled request with a message, not an empty body', async () => {
    for (let i = 0; i < 12; i++) {
      await request(app).post('/api/auth/login').send({ email: 'x@y.com', password: 'nope' })
    }

    const res = await request(app).post('/api/auth/login').send({ email: 'x@y.com', password: 'nope' })

    expect(res.status).toBe(429)
    expect(res.body.message).toMatch(/too many/i)
  })
})
