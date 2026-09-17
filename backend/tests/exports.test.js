import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Attendance from '../models/Attendance.js'
import Leave from '../models/Leave.js'
import { invalidate } from '../services/roleService.js'
import { cell } from '../utils/csv.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => { app = createApp({ globalRateLimit: false }) })
beforeEach(() => { invalidate() })

const crew = async () => {
  const manager = await makeUser({ role: 'manager' })
  const team = await makeTeam(manager, { name: `Team ${Math.random()}` })
  const asha = await joinTeam(await makeUser({
    name: 'Asha Rao', employment: { position: 'QA engineer', employeeId: 'E-7' },
    salary: { amount: 900000, currency: 'INR', period: 'year' }
  }), team)
  return { manager, team, asha }
}

const lines = (res) => res.text.replace(/^\uFEFF/, '').split('\r\n')

describe('exports', () => {
  it('writes cells Excel reads safely', () => {
    expect(cell('He said "hi"')).toBe('"He said ""hi"""')
    expect(cell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"')
    expect(cell(null)).toBe('""')
  })

  it('downloads a manager\'s team without pay, and an admin\'s with it', async () => {
    const { manager } = await crew()
    const admin = await makeUser({ role: 'admin' })
    await crew()

    const mine = await request(app).get('/api/exports/employees').set(...authHeader(manager))
    const all = await request(app).get('/api/exports/employees').set(...authHeader(admin))

    expect(mine.headers['content-type']).toMatch(/text\/csv/)
    expect(mine.headers['content-disposition']).toMatch(/employees-\d{4}-\d{2}-\d{2}\.csv/)
    expect(lines(mine)[0]).not.toMatch(/Salary/)
    expect(lines(mine)).toHaveLength(2)
    expect(lines(mine)[1]).toContain('"QA engineer"')
    expect(lines(all)[0]).toMatch(/"Salary"/)
    expect(lines(all).some(l => l.includes('"900000"'))).toBe(true)
  })

  it('writes a month of attendance and leave', async () => {
    const { manager, team, asha } = await crew()
    await Attendance.create({
      user: asha._id, date: '2026-08-10', timezone: 'UTC',
      checkIn: new Date('2026-08-10T10:40:00Z'), checkOut: new Date('2026-08-10T18:40:00Z')
    })
    await Leave.create({ user: asha._id, userName: asha.name, team: team._id, type: 'sick', from: '2026-08-11', to: '2026-08-11', days: 1, reason: 'Fever', status: 'approved' })

    const res = await request(app).get('/api/exports/attendance?month=2026-08').set(...authHeader(manager))

    const body = lines(res)
    expect(body.find(l => l.includes('"2026-08-10"'))).toMatch(/"present","10:40","18:40","8.00","25"/)
    expect(body.find(l => l.includes('"2026-08-11"'))).toContain('"sick leave"')
    expect(body.find(l => l.includes('"2026-08-12"'))).toContain('"absent"')
  })

  it('writes leave requests and balances', async () => {
    const { manager, team, asha } = await crew()
    await Leave.create({ user: asha._id, userName: asha.name, team: team._id, type: 'casual', from: '2026-03-02', to: '2026-03-03', days: 2, reason: 'Wedding', status: 'approved' })

    const requests = await request(app).get('/api/exports/leave?year=2026').set(...authHeader(manager))
    const balances = await request(app).get('/api/exports/leave?year=2026&view=balances').set(...authHeader(manager))

    expect(lines(requests)[1]).toContain('"Wedding"')
    expect(lines(balances)[1]).toMatch(/"Asha Rao".*"2","0","10"/)
  })

  it('keeps payroll to admins with pay, and employees out of all of it', async () => {
    const { manager, asha } = await crew()
    expect((await request(app).get('/api/exports/payroll').set(...authHeader(manager))).status).toBe(403)
    expect((await request(app).get('/api/exports/employees').set(...authHeader(asha))).status).toBe(403)
    expect((await request(app).get('/api/exports/leave').set(...authHeader(asha))).status).toBe(403)
  })
})
