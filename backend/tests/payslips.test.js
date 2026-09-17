import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Attendance from '../models/Attendance.js'
import Leave from '../models/Leave.js'
import Notification from '../models/Notification.js'
import Payslip from '../models/Payslip.js'
import { invalidate } from '../services/roleService.js'
import { computeSlip, workingDaysIn } from '../utils/payPolicy.js'
import { instantIn } from '../utils/time.js'
import { authHeader, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

beforeEach(() => {
  invalidate()
  // The 17th of September 2026, a Thursday, in the afternoon
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-17T10:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

const paid = (over = {}) => makeUser({
  salary: { amount: 900000, currency: 'INR', period: 'year' },
  employment: { position: 'Backend engineer', employeeId: 'E-104', joinedOn: new Date('2024-04-01') },
  ...over
})

const run = (user, month) =>
  request(app).post('/api/payslips/run').set(...authHeader(user)).send({ month })

const publish = (user, month) =>
  request(app).post('/api/payslips/publish').set(...authHeader(user)).send({ month })

describe('working out a slip', () => {
  it('splits gross into basic, HRA and special allowance', () => {
    const slip = computeSlip({ salary: { amount: 900000, period: 'year', currency: 'INR' }, month: '2026-09' })

    expect(slip.gross).toBe(75000)
    expect(slip.earnings.map(e => e.amount)).toEqual([37500, 15000, 22500])
  })

  it('takes provident fund on basic up to the ceiling, and professional tax', () => {
    const slip = computeSlip({ salary: { amount: 75000, period: 'month', currency: 'INR' }, month: '2026-09' })

    expect(slip.deductions).toEqual([
      expect.objectContaining({ label: 'Provident fund', amount: 1800 }),
      expect.objectContaining({ label: 'Professional tax', amount: 200 })
    ])
    expect(slip.net).toBe(73000)
  })

  it('takes a day\'s pay for each unpaid or absent working day', () => {
    // September 2026 has 22 working days
    expect(workingDaysIn('2026-09')).toBe(22)

    const slip = computeSlip({
      salary: { amount: 900000, period: 'year', currency: 'INR' },
      month: '2026-09',
      unpaidLeaveDays: 1,
      absentDays: 1
    })

    expect(slip.lossOfPayDays).toBe(2)
    expect(slip.paidDays).toBe(20)
    expect(slip.deductions.find(d => d.label === 'Loss of pay')).toMatchObject({
      amount: 6818,
      note: '2 days · 1 unpaid leave + 1 absent'
    })
  })

  it('applies no Indian deductions to a salary in another currency', () => {
    const slip = computeSlip({ salary: { amount: 5000, period: 'month', currency: 'USD' }, month: '2026-09' })
    expect(slip.deductions).toEqual([])
    expect(slip.net).toBe(5000)
  })

  it('never goes below zero', () => {
    const slip = computeSlip({
      salary: { amount: 12000, period: 'month', currency: 'INR' },
      month: '2026-09',
      absentDays: 30
    })
    expect(slip.net).toBe(0)
  })
})

describe('running payroll', () => {
  it('is only for an admin', async () => {
    const manager = await makeUser({ role: 'manager' })
    expect((await run(manager, '2026-08')).status).toBe(403)
  })

  it('drafts a slip for everybody with a salary, and none for anybody without', async () => {
    const admin = await makeUser({ role: 'admin' })
    const asha = await paid()
    await makeUser({ name: 'No salary yet' })

    const res = await run(admin, '2026-08')

    expect(res.status).toBe(200)
    expect(res.body.drafted).toBe(1)
    const slip = await Payslip.findOne({ user: asha._id }).lean()
    expect(slip).toMatchObject({
      month: '2026-08', status: 'draft', gross: 75000,
      employee: expect.objectContaining({ employeeId: 'E-104', position: 'Backend engineer' })
    })
  })

  it('counts approved unpaid leave, and absences once attendance was kept', async () => {
    const admin = await makeUser({ role: 'admin', timezone: 'Asia/Kolkata' })
    const asha = await paid({ timezone: 'Asia/Kolkata' })
    const inOn = (date) => Attendance.create({
      user: asha._id, date, timezone: 'Asia/Kolkata', checkIn: instantIn('Asia/Kolkata', date, '10:00')
    })
    // Attendance starts on Monday the 10th of August; the 11th is missed
    await inOn('2026-08-10')
    await Leave.create({
      user: asha._id, type: 'unpaid', from: '2026-08-12', to: '2026-08-13',
      days: 2, reason: 'Exams', status: 'approved'
    })
    await Leave.create({
      user: asha._id, type: 'sick', from: '2026-08-14', to: '2026-08-14',
      days: 1, reason: 'Fever', status: 'approved'
    })
    for (const d of ['17', '18', '19', '20', '21', '24', '25', '26', '27', '28', '31']) await inOn(`2026-08-${d}`)

    await run(admin, '2026-08')
    const slip = await Payslip.findOne({ user: asha._id }).lean()

    // The 11th is absent; the 12th and 13th unpaid; the sick day is paid;
    // the first week of August was before attendance was kept
    expect(slip).toMatchObject({ unpaidLeaveDays: 2, absentDays: 1, lossOfPayDays: 3 })
  })

  it('does not pay for the days before somebody joined', async () => {
    const admin = await makeUser({ role: 'admin' })
    const kabir = await paid({
      employment: { position: 'Intern', joinedOn: new Date('2026-08-17') }
    })

    await run(admin, '2026-08')

    const slip = await Payslip.findOne({ user: kabir._id }).lean()
    // 3–14 August: ten working days before the 17th
    expect(slip.notJoinedDays).toBe(10)
  })

  it('refuses a month that has not started', async () => {
    const admin = await makeUser({ role: 'admin' })
    expect((await run(admin, '2026-10')).status).toBe(400)
  })

  it('lists the month with totals, run or not', async () => {
    const admin = await makeUser({ role: 'admin' })
    await paid()
    await paid({ salary: { amount: 40000, currency: 'INR', period: 'month' } })

    const res = await request(app).get('/api/payslips/run?month=2026-08').set(...authHeader(admin))

    expect(res.status).toBe(200)
    expect(res.body.rows).toHaveLength(2)
    expect(res.body.counts).toMatchObject({ people: 2, notRun: 2, drafts: 0 })
    expect(res.body.totals.gross).toBe(115000)
  })
})

describe('publishing', () => {
  it('shows the slip to its owner only once published, and tells them', async () => {
    const admin = await makeUser({ role: 'admin' })
    const asha = await paid()
    await run(admin, '2026-08')
    const { _id } = await Payslip.findOne({ user: asha._id }).lean()

    const before = await request(app).get('/api/payslips/mine').set(...authHeader(asha))
    const draftRead = await request(app).get(`/api/payslips/${_id}`).set(...authHeader(asha))
    expect(before.body.payslips).toHaveLength(0)
    expect(draftRead.status).toBe(404)

    expect((await publish(admin, '2026-08')).status).toBe(200)

    const after = await request(app).get('/api/payslips/mine').set(...authHeader(asha))
    const read = await request(app).get(`/api/payslips/${_id}`).set(...authHeader(asha))
    expect(after.body.payslips).toHaveLength(1)
    expect(read.body.payslip.net).toBe(73000)
    expect(await Notification.countDocuments({ recipient: asha._id, type: 'payslip_ready' })).toBe(1)
  })

  it('never shows one person another\'s slip', async () => {
    const admin = await makeUser({ role: 'admin' })
    const asha = await paid()
    const colleague = await makeUser()
    await run(admin, '2026-08')
    await publish(admin, '2026-08')
    const { _id } = await Payslip.findOne({ user: asha._id }).lean()

    const res = await request(app).get(`/api/payslips/${_id}`).set(...authHeader(colleague))

    expect(res.status).toBe(404)
  })

  it('does not redo a slip that is already published', async () => {
    const admin = await makeUser({ role: 'admin' })
    const asha = await paid()
    await run(admin, '2026-08')
    await publish(admin, '2026-08')

    await asha.updateOne({ salary: { amount: 1200000, currency: 'INR', period: 'year' } })
    const again = await run(admin, '2026-08')

    expect(again.body).toMatchObject({ drafted: 0, skipped: 1 })
    expect((await Payslip.findOne({ user: asha._id }).lean()).gross).toBe(75000)
  })

  it('has nothing to publish before a run', async () => {
    const admin = await makeUser({ role: 'admin' })
    expect((await publish(admin, '2026-08')).status).toBe(400)
  })
})
