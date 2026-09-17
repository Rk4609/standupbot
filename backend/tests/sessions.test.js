import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Session from '../models/Session.js'
import { invalidate } from '../services/roleService.js'
import { resetRateLimits } from '../middleware/rateLimiters.js'
import { authHeader, makeUser } from './helpers.js'

let app
beforeAll(() => { app = createApp({ globalRateLimit: false }) })
beforeEach(() => { invalidate(); resetRateLimits() })

const signIn = async (user, ua) => {
  const res = await request(app).post('/api/auth/login').set('User-Agent', ua).send({ email: user.email, password: 'secret123' })
  return res.body.token
}
const as = (token) => ['Authorization', `Bearer ${token}`]
const CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
const SAFARI_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

describe('sessions', () => {
  it('lists each device signed in, and marks this one', async () => {
    const user = await makeUser()
    const laptop = await signIn(user, CHROME_WIN)
    await signIn(user, SAFARI_IOS)

    const res = await request(app).get('/api/sessions').set(...as(laptop))

    expect(res.body.sessions.map(s => s.device).sort()).toEqual(['Chrome on Windows', 'Safari on iOS'])
    expect(res.body.sessions.find(s => s.current).device).toBe('Chrome on Windows')
  })

  it('signs one device out, and that token stops working at once', async () => {
    const user = await makeUser()
    const laptop = await signIn(user, CHROME_WIN)
    const phone = await signIn(user, SAFARI_IOS)
    const phoneRow = await Session.findOne({ device: 'Safari on iOS' }).lean()

    await request(app).delete(`/api/sessions/${phoneRow._id}`).set(...as(laptop))

    expect((await request(app).get('/api/users/profile').set(...as(phone))).status).toBe(401)
    expect((await request(app).get('/api/users/profile').set(...as(laptop))).status).toBe(200)
  })

  it('signs out everywhere else, including a token from before sessions', async () => {
    const user = await makeUser()
    const laptop = await signIn(user, CHROME_WIN)
    const phone = await signIn(user, SAFARI_IOS)
    const old = authHeader(user)

    const res = await request(app).post('/api/sessions/others').set(...as(laptop))

    expect(res.body.count).toBe(1)
    expect((await request(app).get('/api/users/profile').set(...as(phone))).status).toBe(401)
    expect((await request(app).get('/api/users/profile').set(...old)).status).toBe(401)
    expect((await request(app).get('/api/users/profile').set(...as(laptop))).status).toBe(200)
  })

  it('signs every other device out when the password changes', async () => {
    const user = await makeUser()
    const laptop = await signIn(user, CHROME_WIN)
    const phone = await signIn(user, SAFARI_IOS)

    await request(app).put('/api/users/change-password').set(...as(laptop)).send({ currentPassword: 'secret123', newPassword: 'newsecret456' })

    expect((await request(app).get('/api/users/profile').set(...as(phone))).status).toBe(401)
    expect((await request(app).get('/api/users/profile').set(...as(laptop))).status).toBe(200)
  })

  it('cannot end somebody else\'s session', async () => {
    const owner = await makeUser()
    const stranger = await makeUser()
    await signIn(owner, CHROME_WIN)
    const row = await Session.findOne({ user: owner._id }).lean()

    const res = await request(app).delete(`/api/sessions/${row._id}`).set(...authHeader(stranger))

    expect(res.status).toBe(404)
  })

  it('does not accept a sign-in challenge as a session', async () => {
    const user = await makeUser()
    const { default: jwt } = await import('jsonwebtoken')
    const challenge = jwt.sign({ id: String(user._id), purpose: '2fa' }, process.env.JWT_SECRET, { expiresIn: '5m' })
    expect((await request(app).get('/api/users/profile').set(...as(challenge))).status).toBe(401)
  })
})
