import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Letter from '../models/Letter.js'
import Notification from '../models/Notification.js'
import Role from '../models/Role.js'
import { invalidate } from '../services/roleService.js'
import { resetSettings } from '../services/settingsService.js'
import { authHeader, makeUser } from './helpers.js'

let app
beforeAll(() => { app = createApp({ globalRateLimit: false }) })
beforeEach(() => {
  invalidate()
  resetSettings()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-17T10:00:00Z'))
})
afterEach(() => { vi.useRealTimers(); resetSettings() })

const people = async () => {
  const admin = await makeUser({ role: 'admin', name: 'Admin' })
  const asha = await makeUser({
    name: 'Asha Verma',
    employment: { employeeId: 'E-104', position: 'Frontend developer', department: 'Engineering', joinedOn: new Date('2024-03-01') },
    salary: { amount: 900000, currency: 'INR', period: 'year' }
  })
  return { admin, asha }
}

const issue = (admin, body) => request(app).post('/api/letters').set(...authHeader(admin)).send(body)

describe('issuing', () => {
  it('writes the letter from the record, numbers it, and tells the person', async () => {
    const { admin, asha } = await people()
    await request(app).put('/api/settings').set(...authHeader(admin))
      .send({ company: { name: 'Kamsora Tech', address: 'Jaipur', email: '', phone: '', signatory: 'R. Jangid', signatoryTitle: 'Director', letterPrefix: 'KT' } })

    const res = await issue(admin, { user: String(asha._id), type: 'employment', purpose: 'a bank loan' })

    expect(res.status).toBe(201)
    const { letter } = res.body
    expect(letter.number).toBe('KT/2026/0001')
    expect(letter.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    expect(letter.body[0]).toBe('This is to certify that Asha Verma (Employee ID E-104) is employed with Kamsora Tech as Frontend developer in the Engineering department since 1 March 2024.')
    expect(letter.body[1]).toMatch(/for a bank loan\.$/)
    expect(letter.company).toMatchObject({ name: 'Kamsora Tech', signatory: 'R. Jangid' })
    expect(await Notification.countDocuments({ recipient: asha._id, type: 'letter_issued' })).toBe(1)

    const second = await issue(admin, { user: String(asha._id), type: 'employment' })
    expect(second.body.letter.number).toBe('KT/2026/0002')
  })

  it('never guesses a pronoun', async () => {
    const { admin, asha } = await people()
    for (const type of ['employment', 'salary', 'experience', 'relieving']) {
      const { body } = await issue(admin, { user: String(asha._id), type, lastDay: '2026-09-30' })
      expect(body.letter.body.join(' ')).not.toMatch(/\b(he|she|him|her|his|hers)\b/i)
    }
  })

  it('puts the salary on a salary certificate, and only for somebody holding pay', async () => {
    const { admin, asha } = await people()
    const res = await issue(admin, { user: String(asha._id), type: 'salary' })
    expect(res.body.letter.body[1]).toBe("Asha Verma's current gross salary is ₹9,00,000 a year, which is ₹75,000 a month, before deductions.")

    // An HR role that issues letters but may not see pay
    const hrRole = await Role.create({ key: 'hr', name: 'HR', base: 'admin', modules: ['dashboard', 'support', 'letters'] })
    const hr = await makeUser({ role: 'admin', accessRole: hrRole._id })
    invalidate()
    expect((await issue(hr, { user: String(asha._id), type: 'salary' })).status).toBe(403)
    expect((await issue(hr, { user: String(asha._id), type: 'employment' })).status).toBe(201)
  })

  it('needs the last day for an experience letter', async () => {
    const { admin, asha } = await people()
    expect((await issue(admin, { user: String(asha._id), type: 'experience' })).status).toBe(400)
    const ok = await issue(admin, { user: String(asha._id), type: 'experience', lastDay: '2026-09-30' })
    expect(ok.body.letter.body[0]).toMatch(/from 1 March 2024 to 30 September 2026\.$/)
  })

  it('is closed to a manager', async () => {
    const { asha } = await people()
    const manager = await makeUser({ role: 'manager' })
    expect((await issue(manager, { user: String(asha._id), type: 'employment' })).status).toBe(403)
  })
})

describe('asking for one', () => {
  it('goes to HR, is answered with the letter, and only its owner reads it', async () => {
    const { admin, asha } = await people()
    const other = await makeUser()

    const asked = await request(app).post('/api/letters/request').set(...authHeader(asha)).send({ type: 'employment', purpose: 'a visa application' })
    expect(asked.status).toBe(201)
    expect(await Notification.countDocuments({ recipient: admin._id, type: 'letter_requested' })).toBe(1)
    expect((await request(app).post('/api/letters/request').set(...authHeader(asha)).send({ type: 'employment' })).status).toBe(409)

    const id = asked.body.letter._id
    const list = await request(app).get('/api/letters').set(...authHeader(admin))
    expect(list.body.waiting).toBe(1)

    const done = await request(app).post(`/api/letters/${id}/issue`).set(...authHeader(admin)).send({})
    expect(done.body.letter.status).toBe('issued')
    expect(done.body.letter.body[1]).toMatch(/for a visa application\.$/)

    expect((await request(app).get(`/api/letters/${id}`).set(...authHeader(asha))).status).toBe(200)
    expect((await request(app).get(`/api/letters/${id}`).set(...authHeader(other))).status).toBe(403)
  })

  it('a decline needs a reason and reaches the person', async () => {
    const { admin, asha } = await people()
    const { body } = await request(app).post('/api/letters/request').set(...authHeader(asha)).send({ type: 'relieving' })

    expect((await request(app).post(`/api/letters/${body.letter._id}/decline`).set(...authHeader(admin)).send({})).status).toBe(400)
    const res = await request(app).post(`/api/letters/${body.letter._id}/decline`).set(...authHeader(admin)).send({ note: 'You are still with us' })

    expect(res.body.letter.status).toBe('declined')
    const mine = await request(app).get('/api/letters/mine').set(...authHeader(asha))
    expect(mine.body.letters[0]).toMatchObject({ status: 'declined', note: 'You are still with us' })
  })
})

describe('verifying', () => {
  it('confirms a real code to anybody, without the letter itself', async () => {
    const { admin, asha } = await people()
    const { body } = await issue(admin, { user: String(asha._id), type: 'salary' })

    const res = await request(app).get(`/api/letters/verify/${body.letter.code.toLowerCase()}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      valid: true, number: body.letter.number, title: 'Salary certificate', name: 'Asha Verma', issuedOn: '2026-09-17', company: body.letter.company.name
    })
    expect((await request(app).get('/api/letters/verify/AAAA-AAAA')).status).toBe(404)
    expect(await Letter.countDocuments()).toBe(1)
  })
})
