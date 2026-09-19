import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Expense from '../models/Expense.js'
import Notification from '../models/Notification.js'
import Payslip from '../models/Payslip.js'
import { invalidate } from '../services/roleService.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => { app = createApp({ globalRateLimit: false }) })
beforeEach(() => {
  invalidate()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-17T10:00:00Z'))
})
afterEach(() => { vi.useRealTimers() })

const crew = async () => {
  const manager = await makeUser({ role: 'manager' })
  const team = await makeTeam(manager)
  const asha = await joinTeam(await makeUser({
    name: 'Asha', salary: { amount: 900000, currency: 'INR', period: 'year' }
  }), team)
  return { manager, team, asha }
}

const claim = (user, body = {}) => request(app).post('/api/expenses').set(...authHeader(user)).send({
  category: 'travel', amount: 1250, spentOn: '2026-09-10', description: 'Cab to the client office', ...body
})

describe('claiming', () => {
  it('saves a claim and tells the manager', async () => {
    const { manager, asha } = await crew()

    const res = await claim(asha)

    expect(res.status).toBe(201)
    expect(res.body.expense).toMatchObject({ status: 'pending', amount: 1250, userName: 'Asha' })
    const note = await Notification.findOne({ recipient: manager._id, type: 'expense_submitted' }).lean()
    expect(note.message).toMatch(/Asha claimed ₹1,250 for travel/)
  })

  it('takes only a receipt this app uploaded', async () => {
    const { asha } = await crew()
    const outside = await claim(asha, { receipt: { url: 'https://evil.example.com/r.pdf', name: 'r.pdf' } })
    const ours = await claim(asha, { receipt: { url: 'https://res.cloudinary.com/demo/raw/upload/r.pdf', name: 'r.pdf' } })
    expect(outside.status).toBe(400)
    expect(ours.status).toBe(201)
  })

  it('refuses a date still to come', async () => {
    const { asha } = await crew()
    expect((await claim(asha, { spentOn: '2026-09-30' })).status).toBe(400)
  })

  it('shows my claims with what is waiting and approved', async () => {
    const { asha } = await crew()
    await claim(asha)
    await claim(asha, { amount: 400, category: 'food', description: 'Team lunch' })

    const res = await request(app).get('/api/expenses/mine').set(...authHeader(asha))

    expect(res.body.expenses).toHaveLength(2)
    expect(res.body.totals).toMatchObject({ waiting: 1650, approved: 0 })
  })
})

describe('answering', () => {
  it('lets the manager approve, and not their own or another team\'s', async () => {
    const { manager, asha } = await crew()
    const other = await crew()
    const { body } = await claim(asha)
    const mine = await claim(manager)

    expect((await request(app).post(`/api/expenses/${body.expense._id}/approve`).set(...authHeader(other.manager)).send({})).status).toBe(403)
    expect((await request(app).post(`/api/expenses/${mine.body.expense._id}/approve`).set(...authHeader(manager)).send({})).status).toBe(403)
    const ok = await request(app).post(`/api/expenses/${body.expense._id}/approve`).set(...authHeader(manager)).send({})
    expect(ok.body.expense.status).toBe('approved')
  })

  it('will not reject without a reason', async () => {
    const { manager, asha } = await crew()
    const { body } = await claim(asha)
    const reject = (note) => request(app).post(`/api/expenses/${body.expense._id}/reject`).set(...authHeader(manager)).send(note ? { note } : {})
    expect((await reject()).status).toBe(400)
    expect((await reject('Not a work trip')).status).toBe(200)
  })

  it('lists what is waiting for the manager, with the total', async () => {
    const { manager, asha } = await crew()
    await claim(asha)
    await claim(asha, { amount: 750 })

    const res = await request(app).get('/api/expenses/team').set(...authHeader(manager))

    expect(res.body.pending).toEqual({ count: 2, amount: 2000 })
  })
})

describe('getting paid', () => {
  it('adds approved claims to the next payslip on top of net pay, and marks them paid on publish', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { manager, asha } = await crew()
    const { body } = await claim(asha)
    await request(app).post(`/api/expenses/${body.expense._id}/approve`).set(...authHeader(manager)).send({})
    await claim(asha, { amount: 999, description: 'Still waiting' })

    await request(app).post('/api/payslips/run').set(...authHeader(admin)).send({ month: '2026-09' })
    const draft = await Payslip.findOne({ user: asha._id }).lean()
    expect(draft.reimbursement).toBe(1250)
    expect(draft.net).toBe(draft.gross - draft.totalDeductions + 1250)

    await request(app).post('/api/payslips/publish').set(...authHeader(admin)).send({ month: '2026-09' })
    const paid = await Expense.findById(body.expense._id).lean()
    expect(paid).toMatchObject({ status: 'paid', paidMonth: '2026-09' })
    expect(String(paid.paidIn)).toBe(String(draft._id))

    // Next month does not pay it again
    vi.setSystemTime(new Date('2026-10-17T10:00:00Z'))
    await request(app).post('/api/payslips/run').set(...authHeader(admin)).send({ month: '2026-10' })
    expect((await Payslip.findOne({ user: asha._id, month: '2026-10' }).lean()).reimbursement).toBe(0)
  })
})
