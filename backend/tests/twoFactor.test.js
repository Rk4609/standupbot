import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import User from '../models/User.js'
import { invalidate } from '../services/roleService.js'
import { codeAt, verifyCode } from '../utils/totp.js'
import { resetRateLimits } from '../middleware/rateLimiters.js'
import { authHeader, makeUser } from './helpers.js'

let app
beforeAll(() => { app = createApp({ globalRateLimit: false }) })
beforeEach(() => { invalidate(); resetRateLimits() })

const login = (email, password = 'secret123') => request(app).post('/api/auth/login').send({ email, password })

/** Turn it on for a user, and hand back the secret and recovery codes. */
const turnOn = async (user) => {
  const setup = await request(app).post('/api/auth/2fa/setup').set(...authHeader(user))
  const enable = await request(app).post('/api/auth/2fa/enable').set(...authHeader(user)).send({ code: codeAt(setup.body.secret) })
  return { secret: setup.body.secret, setup, enable }
}

describe('codes', () => {
  it('matches the RFC 6238 test vectors', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
    expect(codeAt(secret, 59_000)).toBe('287082')
    expect(codeAt(secret, 1_111_111_109_000)).toBe('081804')
  })

  it('accepts a code one step early or late, and nothing further', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
    const now = 1_700_000_000_000
    expect(verifyCode(secret, codeAt(secret, now - 30_000), now)).toBe(true)
    expect(verifyCode(secret, codeAt(secret, now - 90_000), now)).toBe(false)
    expect(verifyCode(secret, 'abcdef', now)).toBe(false)
  })
})

describe('turning it on', () => {
  it('gives a QR code, and only switches on once a code from the app matches', async () => {
    const user = await makeUser()
    const setup = await request(app).post('/api/auth/2fa/setup').set(...authHeader(user))

    expect(setup.body.qr).toMatch(/^data:image\/png;base64,/)
    expect(setup.body.otpauthUrl).toContain('otpauth://totp/StandupBot')

    const wrong = await request(app).post('/api/auth/2fa/enable').set(...authHeader(user)).send({ code: '000000' })
    expect(wrong.status).toBe(400)

    const right = await request(app).post('/api/auth/2fa/enable').set(...authHeader(user)).send({ code: codeAt(setup.body.secret) })
    expect(right.status).toBe(200)
    expect(right.body.recoveryCodes).toHaveLength(8)
  })

  it('never stores the secret in the clear, or sends it with the profile', async () => {
    const user = await makeUser()
    const { secret } = await turnOn(user)

    const stored = await User.findById(user._id).select('+twoFactor.secret').lean()
    expect(stored.twoFactor.secret).not.toContain(secret)
    const profile = await request(app).get('/api/users/profile').set(...authHeader(user))
    expect(JSON.stringify(profile.body)).not.toMatch(/secret|recovery/)
  })

  it('says it is needed for an admin', async () => {
    const admin = await makeUser({ role: 'admin' })
    const res = await request(app).get('/api/auth/2fa').set(...authHeader(admin))
    expect(res.body).toMatchObject({ enabled: false, required: true })
  })
})

describe('signing in', () => {
  it('asks for a code after the password, and gives a session only with the right one', async () => {
    const user = await makeUser()
    const { secret } = await turnOn(user)

    const first = await login(user.email)
    expect(first.body).toMatchObject({ twoFactorRequired: true })
    expect(first.body.token).toBeUndefined()

    const wrong = await request(app).post('/api/auth/login/2fa').send({ challenge: first.body.challenge, code: '123456' })
    expect(wrong.status).toBe(401)

    const right = await request(app).post('/api/auth/login/2fa').send({ challenge: first.body.challenge, code: codeAt(secret) })
    expect(right.status).toBe(200)
    expect(right.body.token).toBeTruthy()
  })

  it('takes a recovery code once, and not twice', async () => {
    const user = await makeUser()
    const { enable } = await turnOn(user)
    const code = enable.body.recoveryCodes[0]

    const first = await login(user.email)
    const used = await request(app).post('/api/auth/login/2fa').send({ challenge: first.body.challenge, code })
    expect(used.status).toBe(200)
    expect(used.body.recoveryLeft).toBe(7)

    const again = await login(user.email)
    const reused = await request(app).post('/api/auth/login/2fa').send({ challenge: again.body.challenge, code })
    expect(reused.status).toBe(401)
  })

  it('does not accept a normal session token as the challenge', async () => {
    const user = await makeUser()
    const { secret } = await turnOn(user)
    const session = authHeader(user)[1].replace('Bearer ', '')

    const res = await request(app).post('/api/auth/login/2fa').send({ challenge: session, code: codeAt(secret) })
    expect(res.status).toBe(401)
  })

  it('turns off only with the password and a current code', async () => {
    const user = await makeUser()
    const { secret } = await turnOn(user)
    const off = (body) => request(app).post('/api/auth/2fa/disable').set(...authHeader(user)).send(body)

    expect((await off({ password: 'wrong', code: codeAt(secret) })).status).toBe(401)
    expect((await off({ password: 'secret123', code: '000000' })).status).toBe(401)
    expect((await off({ password: 'secret123', code: codeAt(secret) })).status).toBe(200)
    expect((await login(user.email)).body.token).toBeTruthy()
  })
})
