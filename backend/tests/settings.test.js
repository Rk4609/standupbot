import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { invalidate } from '../services/roleService.js'
import { resetSettings } from '../services/settingsService.js'
import { readDay } from '../utils/attendancePolicy.js'
import { workingDays } from '../utils/leavePolicy.js'
import { computeSlip, workingDaysIn } from '../utils/payPolicy.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => { app = createApp({ globalRateLimit: false }) })
beforeEach(() => { invalidate(); resetSettings() })
afterEach(() => { vi.useRealTimers(); resetSettings() })

const save = (user, body) => request(app).put('/api/settings').set(...authHeader(user)).send(body)

describe('company settings', () => {
  it('starts from the rules the app always used', async () => {
    const employee = await makeUser()
    const res = await request(app).get('/api/settings').set(...authHeader(employee))

    expect(res.body).toMatchObject({
      office: { start: '10:00', graceMinutes: 15, fullDayHours: 8 },
      leave: { casual: 12, sick: 8, earned: 15 },
      holidays: [],
      canEdit: false
    })
    expect(res.body.pay).toBeUndefined()
  })

  it('is only an admin\'s to change', async () => {
    const manager = await makeUser({ role: 'manager' })
    expect((await save(manager, { leave: { casual: 20, sick: 10, earned: 18 } })).status).toBe(403)
  })

  it('makes a holiday free in leave, payroll and attendance', async () => {
    const admin = await makeUser({ role: 'admin' })
    // Friday 2 October 2026
    await save(admin, { holidays: [{ date: '2026-10-02', name: 'Gandhi Jayanti' }] })

    expect(workingDays('2026-09-28', '2026-10-02')).toBe(4)
    expect(workingDaysIn('2026-10')).toBe(21)
    const worked = readDay({ date: '2026-10-02', timezone: 'UTC', checkIn: new Date('2026-10-02T12:00:00Z') }, { today: '2026-10-02' })
    expect(worked.late).toBe(false)
  })

  it('shows a holiday in attendance instead of an absence', async () => {
    const admin = await makeUser({ role: 'admin' })
    const manager = await makeUser({ role: 'manager' })
    const team = await makeTeam(manager)
    const asha = await joinTeam(await makeUser({ timezone: 'UTC' }), team)
    await save(admin, { holidays: [{ date: '2026-09-16', name: 'Office offsite' }] })

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-17T12:00:00Z'))
    const res = await request(app).get('/api/attendance/me?month=2026-09').set(...authHeader(asha))

    expect(res.body.days.find(d => d.date === '2026-09-16')).toMatchObject({ state: 'holiday', holiday: 'Office offsite' })
  })

  it('changes the office hours and allowances everybody works by', async () => {
    const admin = await makeUser({ role: 'admin' })
    await save(admin, {
      office: { start: '09:30', graceMinutes: 10, fullDayHours: 9, halfDayHours: 4 },
      leave: { casual: 10, sick: 12, earned: 20 }
    })

    const late = readDay({ date: '2026-09-17', timezone: 'UTC', checkIn: new Date('2026-09-17T09:45:00Z') }, { today: '2026-09-17' })
    expect(late).toMatchObject({ late: true, lateBy: 5 })

    const employee = await makeUser()
    const mine = await request(app).get('/api/leave/mine').set(...authHeader(employee))
    expect(mine.body.balance.find(b => b.type === 'earned').allowance).toBe(20)
  })

  it('works out pay by the saved split', async () => {
    const admin = await makeUser({ role: 'admin' })
    await save(admin, { pay: { basicPercent: 40, hraPercent: 20, pfRate: 12, pfWageCeiling: 15000, professionalTax: 0, professionalTaxFrom: 15000 } })

    const slip = computeSlip({ salary: { amount: 100000, period: 'month', currency: 'INR' }, month: '2026-09' })
    expect(slip.earnings.map(e => e.amount)).toEqual([40000, 20000, 40000])
    expect(slip.deductions.map(d => d.label)).toEqual(['Provident fund'])
  })

  it('refuses rules that cannot work', async () => {
    const admin = await makeUser({ role: 'admin' })
    expect((await save(admin, { office: { start: '10:00', graceMinutes: 15, fullDayHours: 4, halfDayHours: 6 } })).status).toBe(400)
    expect((await save(admin, { pay: { basicPercent: 80, hraPercent: 40, pfRate: 12, pfWageCeiling: 15000, professionalTax: 200, professionalTaxFrom: 15000 } })).status).toBe(400)
    expect((await save(admin, { holidays: [{ date: '2026-10-02', name: 'A' + 'x' }, { date: '2026-10-02', name: 'Again' }] })).status).toBe(400)
  })
})
