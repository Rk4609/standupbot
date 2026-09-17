import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Attendance from '../models/Attendance.js'
import AuditLog from '../models/AuditLog.js'
import Leave from '../models/Leave.js'
import { invalidate } from '../services/roleService.js'
import { instantIn } from '../utils/time.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

beforeEach(() => {
  invalidate()
})

afterEach(() => {
  vi.useRealTimers()
})

const ZONE = 'Asia/Kolkata'

/** Stand the server's clock at this time on a Pune wall clock. Thursday 17 Sep. */
const at = (hhmm, date = '2026-09-17') => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(instantIn(ZONE, date, hhmm))
}

const crew = async () => {
  const manager = await makeUser({ role: 'manager', timezone: ZONE })
  const team = await makeTeam(manager)
  const employee = await joinTeam(await makeUser({ timezone: ZONE }), team)
  return { manager, team, employee }
}

const post = (user, path, body = {}) =>
  request(app).post(`/api/attendance${path}`).set(...authHeader(user)).send(body)

const get = (user, path) =>
  request(app).get(`/api/attendance${path}`).set(...authHeader(user))

describe('checking in and out', () => {
  it('is on time inside the grace period', async () => {
    const { employee } = await crew()
    at('10:10')

    const res = await post(employee, '/check-in')

    expect(res.status).toBe(201)
    expect(res.body.record).toMatchObject({ date: '2026-09-17', inAt: '10:10', late: false, state: 'working' })
  })

  it('marks it late after the grace period, by how much', async () => {
    const { employee } = await crew()
    at('10:40')

    const res = await post(employee, '/check-in')

    expect(res.body.record).toMatchObject({ late: true, lateBy: 25 })
    expect(res.body.message).toMatch(/25 min late/)
  })

  it('files the day by the person\'s own clock, not the server\'s', async () => {
    const { employee } = await crew()
    // 00:30 in Pune on the 18th is still the 17th in UTC
    at('00:30', '2026-09-18')

    const res = await post(employee, '/check-in')

    expect(res.body.record.date).toBe('2026-09-18')
  })

  it('checks in once a day', async () => {
    const { employee } = await crew()
    at('09:55')
    await post(employee, '/check-in')

    expect((await post(employee, '/check-in')).status).toBe(409)
  })

  it('works out the hours on the way out', async () => {
    const { employee } = await crew()
    at('09:50')
    await post(employee, '/check-in')
    at('18:20')

    const res = await post(employee, '/check-out')

    expect(res.status).toBe(200)
    expect(res.body.record).toMatchObject({ outAt: '18:20', minutes: 510, state: 'present' })
    expect((await post(employee, '/check-out')).status).toBe(409)
  })

  it('calls a short day a half day', async () => {
    const { employee } = await crew()
    at('10:00')
    await post(employee, '/check-in')
    at('13:00')

    const res = await post(employee, '/check-out')

    expect(res.body.record.state).toBe('half-day')
  })

  it('will not check out without checking in', async () => {
    const { employee } = await crew()
    at('18:00')
    expect((await post(employee, '/check-out')).status).toBe(400)
  })

  it('will not check in on a day of approved leave', async () => {
    const { employee } = await crew()
    await Leave.create({
      user: employee._id, type: 'casual', from: '2026-09-17', to: '2026-09-17',
      days: 1, reason: 'Wedding', status: 'approved'
    })
    at('10:00')

    expect((await post(employee, '/check-in')).status).toBe(400)
  })

  it('is not late on a half day off', async () => {
    const { employee } = await crew()
    await Leave.create({
      user: employee._id, type: 'casual', from: '2026-09-17', to: '2026-09-17', halfDay: true,
      days: 0.5, reason: 'Dentist', status: 'approved'
    })
    at('14:00')
    await post(employee, '/check-in')

    const res = await get(employee, '/me')

    expect(res.body.todayRecord.late).toBe(false)
  })
})

describe('my month', () => {
  it('counts what happened, and only calls a day absent once attendance was kept', async () => {
    const { employee } = await crew()
    const day = (date, inAt, outAt) => Attendance.create({
      user: employee._id, date, timezone: ZONE,
      checkIn: instantIn(ZONE, date, inAt),
      checkOut: outAt ? instantIn(ZONE, date, outAt) : null
    })
    await day('2026-09-14', '09:58', '18:30') // Monday, on time, 512 minutes
    await day('2026-09-15', '10:45', '19:00') // late, 495 minutes
    // Wednesday the 16th: nothing — absent
    await Leave.create({
      user: employee._id, type: 'sick', from: '2026-09-11', to: '2026-09-11',
      days: 1, reason: 'Fever', status: 'approved'
    })
    at('11:00')

    const res = await get(employee, '/me?month=2026-09')
    const state = (date) => res.body.days.find(d => d.date === date).state

    expect(res.status).toBe(200)
    expect(state('2026-09-10')).toBe('untracked')
    expect(state('2026-09-13')).toBe('weekend')
    expect(state('2026-09-14')).toBe('present')
    expect(state('2026-09-16')).toBe('absent')
    expect(state('2026-09-17')).toBe('not-in')
    expect(state('2026-09-18')).toBe('upcoming')
    expect(res.body.summary).toMatchObject({ present: 2, late: 1, absent: 1, averageMinutes: 504, onTime: 50 })
    expect(res.body.policy).toMatchObject({ start: '10:00', graceMinutes: 15 })
  })

  it('calls a day left open a missed check-out', async () => {
    const { employee } = await crew()
    await Attendance.create({
      user: employee._id, date: '2026-09-16', timezone: ZONE, checkIn: instantIn(ZONE, '2026-09-16', '10:00')
    })
    at('09:00')

    const res = await get(employee, '/me?month=2026-09')

    expect(res.body.days.find(d => d.date === '2026-09-16').state).toBe('no-checkout')
    expect(res.body.summary.noCheckout).toBe(1)
  })
})

describe('the team\'s day', () => {
  it('shows a manager their own team: in, late, on leave and missing', async () => {
    const { manager, team, employee } = await crew()
    const late = await joinTeam(await makeUser({ name: 'Arjun Late', timezone: ZONE }), team)
    const away = await joinTeam(await makeUser({ name: 'Bela Away', timezone: ZONE }), team)
    const other = await crew()

    await Leave.create({
      user: away._id, type: 'earned', from: '2026-09-16', to: '2026-09-18',
      days: 3, reason: 'Trip', status: 'approved'
    })
    at('09:45')
    await post(employee, '/check-in')
    at('10:50')
    await post(late, '/check-in')
    await post(other.employee, '/check-in')

    const res = await get(manager, '/team?date=2026-09-17')

    expect(res.status).toBe(200)
    expect(res.body.people).toHaveLength(3)
    expect(res.body.counts).toMatchObject({ total: 3, in: 2, late: 1, leave: 1, missing: 0 })
    expect(res.body.people.find(p => p.user.name === 'Bela Away').leave).toMatchObject({ type: 'earned', to: '2026-09-18' })
  })

  it('keeps it from employees', async () => {
    const { employee } = await crew()
    expect((await get(employee, '/team')).status).toBe(403)
  })
})

describe('correcting a day', () => {
  it('lets the manager fix a forgotten check-out, and records who did', async () => {
    const { manager, employee } = await crew()
    at('10:05', '2026-09-16')
    await post(employee, '/check-in')
    at('11:00')

    const res = await post(manager, '/correct', {
      user: String(employee._id), date: '2026-09-16', checkIn: '10:05', checkOut: '18:45',
      reason: 'Forgot to check out'
    })

    expect(res.status).toBe(200)
    expect(res.body.record).toMatchObject({ outAt: '18:45', state: 'present' })
    expect(res.body.record.corrected).toMatchObject({ byName: manager.name })
    expect(await AuditLog.countDocuments({ action: 'attendance.corrected' })).toBe(1)
  })

  it('can record a day somebody never checked in on', async () => {
    const { manager, employee } = await crew()
    at('12:00')

    const res = await post(manager, '/correct', {
      user: String(employee._id), date: '2026-09-15', checkIn: '09:30', checkOut: '17:30',
      reason: 'Client site visit, no laptop'
    })

    expect(res.status).toBe(200)
    expect(await Attendance.countDocuments({ user: employee._id, date: '2026-09-15' })).toBe(1)
  })

  it('is not another team\'s manager to fix', async () => {
    const { employee } = await crew()
    const other = await crew()
    at('12:00')

    const res = await post(other.manager, '/correct', {
      user: String(employee._id), date: '2026-09-16', checkIn: '10:00', checkOut: '18:00', reason: 'Because'
    })

    expect(res.status).toBe(403)
  })

  it('never fixes your own', async () => {
    const admin = await makeUser({ role: 'admin' })
    at('12:00')

    const res = await post(admin, '/correct', {
      user: String(admin._id), date: '2026-09-16', checkIn: '10:00', checkOut: '18:00', reason: 'Because'
    })

    expect(res.status).toBe(403)
  })

  it('refuses a check-out before the check-in, and a day still to come', async () => {
    const { manager, employee } = await crew()
    at('12:00')
    const body = { user: String(employee._id), checkIn: '10:00', reason: 'Fixing it' }

    expect((await post(manager, '/correct', { ...body, date: '2026-09-16', checkOut: '09:00' })).status).toBe(400)
    expect((await post(manager, '/correct', { ...body, date: '2026-09-19', checkOut: '18:00' })).status).toBe(400)
  })
})
