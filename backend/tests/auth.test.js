import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import User from '../models/User.js'
import { makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

describe('POST /api/auth/register', () => {
  it('creates an employee', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Asha Rao',
      email: 'asha@example.com',
      password: 'secret123'
    })

    expect(res.status).toBe(201)
    expect(res.body.role).toBe('employee')
    expect(res.body.token).toBeTruthy()
    expect(res.body.password).toBeUndefined()
  })

  it('ignores a role sent by the client', async () => {
    // Anyone could once sign themselves up as a manager this way
    const res = await request(app).post('/api/auth/register').send({
      name: 'Sneaky',
      email: 'sneaky@example.com',
      password: 'secret123',
      role: 'admin'
    })

    expect(res.status).toBe(201)
    expect(res.body.role).toBe('employee')

    const saved = await User.findOne({ email: 'sneaky@example.com' })
    expect(saved.role).toBe('employee')
  })

  it('rejects a malformed email and a short password, naming the fields', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'X',
      email: 'not-an-email',
      password: '123'
    })

    expect(res.status).toBe(400)
    const fields = res.body.errors.map(e => e.field)
    expect(fields).toContain('email')
    expect(fields).toContain('password')
  })

  it('refuses a duplicate email', async () => {
    await makeUser({ email: 'taken@example.com' })

    const res = await request(app).post('/api/auth/register').send({
      name: 'Someone',
      email: 'taken@example.com',
      password: 'secret123'
    })

    expect(res.status).toBe(400)
  })

  it('normalises the email so case cannot create a second account', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Case', email: 'Mixed@Example.com', password: 'secret123'
    })

    const saved = await User.findOne({ email: 'mixed@example.com' })
    expect(saved).toBeTruthy()
  })

  it('never stores the password in clear text', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Hashed', email: 'hashed@example.com', password: 'secret123'
    })

    const saved = await User.findOne({ email: 'hashed@example.com' })
    expect(saved.password).not.toBe('secret123')
    expect(await saved.matchPassword('secret123')).toBe(true)
  })
})

describe('POST /api/auth/login', () => {
  it('returns a token for correct credentials', async () => {
    await makeUser({ email: 'known@example.com', password: 'secret123' })

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'known@example.com', password: 'secret123' })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
  })

  it('gives the same answer for a wrong password and an unknown account', async () => {
    await makeUser({ email: 'known2@example.com', password: 'secret123' })

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'known2@example.com', password: 'wrongwrong' })

    const noSuchUser = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'wrongwrong' })

    // Distinguishing them would tell an attacker which addresses are registered
    expect(wrongPassword.status).toBe(401)
    expect(noSuchUser.status).toBe(401)
    expect(wrongPassword.body.message).toBe(noSuchUser.body.message)
  })
})

describe('POST /api/auth/forgot-password', () => {
  it('answers the same whether or not the address exists', async () => {
    await makeUser({ email: 'real@example.com' })

    const known = await request(app)
      .post('/api/auth/forgot-password').send({ email: 'real@example.com' })
    const unknown = await request(app)
      .post('/api/auth/forgot-password').send({ email: 'nobody@example.com' })

    expect(known.status).toBe(200)
    expect(unknown.status).toBe(200)
    expect(known.body.message).toBe(unknown.body.message)
  })

  it('stores a hashed reset token, never the raw one', async () => {
    const user = await makeUser({ email: 'reset@example.com' })
    await request(app).post('/api/auth/forgot-password').send({ email: 'reset@example.com' })

    const saved = await User.findById(user._id)
    expect(saved.resetPasswordToken).toBeTruthy()
    expect(saved.resetPasswordToken).toHaveLength(64) // sha256 hex
    expect(saved.resetPasswordExpire.getTime()).toBeGreaterThan(Date.now())
  })
})

describe('PUT /api/auth/reset-password/:token', () => {
  it('refuses an unknown token', async () => {
    const res = await request(app)
      .put(`/api/auth/reset-password/${'a'.repeat(64)}`)
      .send({ password: 'newsecret' })

    expect(res.status).toBe(400)
  })

  it('refuses an expired token', async () => {
    const crypto = await import('node:crypto')
    const raw = 'b'.repeat(64)
    const hashed = crypto.createHash('sha256').update(raw).digest('hex')

    const user = await makeUser()
    user.resetPasswordToken = hashed
    user.resetPasswordExpire = new Date(Date.now() - 1000)
    await user.save()

    const res = await request(app)
      .put(`/api/auth/reset-password/${raw}`)
      .send({ password: 'newsecret' })

    expect(res.status).toBe(400)
  })
})
