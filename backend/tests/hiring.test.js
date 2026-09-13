import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Candidate from '../models/Candidate.js'
import Team from '../models/Team.js'
import User from '../models/User.js'
import { invalidate } from '../services/roleService.js'
import { authHeader, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

beforeEach(() => {
  invalidate()
})

const withTeam = async () => {
  const manager = await makeUser({ role: 'manager' })
  const team = await makeTeam(manager, { name: `Team ${Date.now()}${Math.random()}` })
  return { manager, team }
}

let seq = 0
const candidate = (over = {}) => ({
  name: 'Kabir Sen',
  email: `kabir${++seq}.${Date.now()}@example.com`,
  phone: '+91 90000 11111',
  dob: '2001-03-14',
  address: { line1: '4 Lake Road', city: 'Pune', state: 'Maharashtra', pincode: '411014' },
  position: 'Frontend intern',
  department: 'Engineering',
  type: 'intern',
  joiningOn: '2026-10-01',
  startsOn: '2026-10-01',
  endsOn: '2027-01-01',
  experienceYears: 0,
  cv: { url: 'https://example.com/kabir.pdf', name: 'kabir.pdf' },
  notes: 'Interviewed on Tuesday. Strong on React.',
  ...over
})

const submit = (user, body = {}) =>
  request(app).post('/api/hiring').set(...authHeader(user)).send(candidate(body))

const list = (user, query = '') =>
  request(app).get(`/api/hiring${query}`).set(...authHeader(user))

const approve = (user, id, body = {}) =>
  request(app).post(`/api/hiring/${id}/approve`).set(...authHeader(user)).send(body)

const reject = (user, id, body = {}) =>
  request(app).post(`/api/hiring/${id}/reject`).set(...authHeader(user)).send(body)

describe('putting somebody forward', () => {
  it('is a manager\'s to do, not an employee\'s', async () => {
    const employee = await makeUser()
    expect((await submit(employee)).status).toBe(403)
  })

  it('records who asked, and leaves it waiting', async () => {
    const { manager } = await withTeam()

    const res = await submit(manager)

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('pending')
    expect(res.body.submittedByName).toBe(manager.name)
  })

  it('puts them on the manager\'s own team, whatever was sent', async () => {
    const { manager, team } = await withTeam()
    const other = await withTeam()

    const res = await submit(manager, { team: String(other.team._id) })

    expect(String(res.body.team)).toBe(String(team._id))
  })

  it('refuses an email that already has an account', async () => {
    const { manager } = await withTeam()
    const existing = await makeUser()

    const res = await submit(manager, { email: existing.email })
    expect(res.status).toBe(409)
  })

  it('refuses a second submission for the same person', async () => {
    const { manager } = await withTeam()
    const first = await submit(manager)

    const res = await submit(manager, { email: first.body.email })
    expect(res.status).toBe(409)
  })

  it('takes a CV as a link, and does without one', async () => {
    const { manager } = await withTeam()

    const withCv = await submit(manager)
    const without = await submit(manager, { cv: { url: '', name: '' } })

    expect(withCv.body.cv.url).toMatch(/kabir\.pdf$/)
    expect(without.status).toBe(201)
  })

  it('refuses something that is not a link at all', async () => {
    const { manager } = await withTeam()

    const res = await submit(manager, { cv: { url: 'my desktop', name: '' } })
    expect(res.status).toBe(400)
  })
})

describe('what each side sees', () => {
  it('shows a manager their own submissions and nobody else\'s', async () => {
    const a = await withTeam()
    const b = await withTeam()
    await submit(a.manager, { name: 'Mine' })
    await submit(b.manager, { name: 'Theirs' })

    const res = await list(a.manager)

    expect(res.body.candidates.map(c => c.name)).toEqual(['Mine'])
    expect(res.body.canDecide).toBe(false)
  })

  it('shows an admin everything waiting', async () => {
    const admin = await makeUser({ role: 'admin' })
    const a = await withTeam()
    await submit(a.manager, { name: 'Waiting one' })

    const res = await list(admin)

    expect(res.body.canDecide).toBe(true)
    expect(res.body.candidates.map(c => c.name)).toContain('Waiting one')
    expect(res.body.pendingCount).toBeGreaterThanOrEqual(1)
  })

  it('keeps the proposed pay from a reader who cannot see pay', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { manager } = await withTeam()
    const made = await request(app).post('/api/hiring').set(...authHeader(admin))
      .send(candidate({ expectedSalary: { amount: 800000, period: 'year' } }))

    const theirs = await list(manager)
    const mine = await list(admin)

    expect(theirs.body.maySeePay).toBe(false)
    expect(mine.body.candidates.find(c => c._id === made.body._id).expectedSalary.amount)
      .toBe(800000)
  })
})

describe('approving', () => {
  it('is not something the manager who asked can do', async () => {
    const { manager } = await withTeam()
    const made = await submit(manager)

    expect((await approve(manager, made.body._id)).status).toBe(403)
  })

  it('goes through with no body at all, which is what the button sends', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { manager } = await withTeam()
    const made = await submit(manager)

    // No .send(): axios posts nothing when there is nothing to say
    const res = await request(app)
      .post(`/api/hiring/${made.body._id}/approve`).set(...authHeader(admin))

    expect(res.status).toBe(200)
    expect(res.body.account.email).toBe(made.body.email)
  })

  it('creates the account with the record already filled in', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { manager, team } = await withTeam()
    const made = await submit(manager)

    const res = await approve(admin, made.body._id)

    expect(res.status).toBe(200)
    expect(res.body.account.tempPassword).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}$/)

    const user = await User.findOne({ email: made.body.email }).lean()
    expect(user.employment.position).toBe('Frontend intern')
    expect(user.employment.type).toBe('intern')
    expect(String(user.team)).toBe(String(team._id))
    expect(user.phone).toBe('+91 90000 11111')
    expect(user.address.pincode).toBe('411014')
  })

  it('puts them on the team roster as well as the account', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { manager, team } = await withTeam()
    const made = await submit(manager)

    await approve(admin, made.body._id)

    const after = await Team.findById(team._id).lean()
    const user = await User.findOne({ email: made.body.email }).lean()
    expect(after.members.map(String)).toContain(String(user._id))
  })

  it('lets them sign in with the password it hands back', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { manager } = await withTeam()
    const made = await submit(manager)

    const res = await approve(admin, made.body._id)

    const signIn = await request(app).post('/api/auth/login').send({
      email: made.body.email,
      password: res.body.account.tempPassword
    })

    expect(signIn.status).toBe(200)
    expect(signIn.body.role).toBe('employee')
  })

  it('tells the manager who asked', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { manager } = await withTeam()
    const made = await submit(manager)

    await approve(admin, made.body._id)

    const { default: Notification } = await import('../models/Notification.js')
    const [latest] = await Notification.find({ recipient: manager._id })
      .sort({ createdAt: -1 }).limit(1).lean()

    expect(latest.message).toMatch(/approved/i)
  })

  it('cannot be done twice', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { manager } = await withTeam()
    const made = await submit(manager)

    await approve(admin, made.body._id)
    const again = await approve(admin, made.body._id)

    expect(again.status).toBe(400)
    expect(again.body.message).toMatch(/already approved/i)
  })
})

describe('rejecting', () => {
  it('needs a reason, because the manager has to act on it', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { manager } = await withTeam()
    const made = await submit(manager)

    const res = await reject(admin, made.body._id, { reason: '' })
    expect(res.status).toBe(400)
  })

  it('keeps the reason on the record and tells the manager', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { manager } = await withTeam()
    const made = await submit(manager)

    const res = await reject(admin, made.body._id, { reason: 'No headcount until April' })

    expect(res.status).toBe(200)
    const after = await Candidate.findById(made.body._id).lean()
    expect(after.status).toBe('rejected')
    expect(after.reason).toBe('No headcount until April')

    const { default: Notification } = await import('../models/Notification.js')
    const [latest] = await Notification.find({ recipient: manager._id })
      .sort({ createdAt: -1 }).limit(1).lean()
    expect(latest.message).toMatch(/No headcount/)
  })

  it('creates no account', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { manager } = await withTeam()
    const made = await submit(manager)

    await reject(admin, made.body._id, { reason: 'Not this quarter' })

    expect(await User.findOne({ email: made.body.email })).toBeNull()
  })
})

describe('withdrawing', () => {
  it('is the submitter\'s to do while nobody has decided', async () => {
    const { manager } = await withTeam()
    const made = await submit(manager)

    const res = await request(app).delete(`/api/hiring/${made.body._id}`)
      .set(...authHeader(manager))

    expect(res.status).toBe(200)
    expect(await Candidate.findById(made.body._id)).toBeNull()
  })

  it('is refused once it has been decided', async () => {
    const admin = await makeUser({ role: 'admin' })
    const { manager } = await withTeam()
    const made = await submit(manager)
    await approve(admin, made.body._id)

    const res = await request(app).delete(`/api/hiring/${made.body._id}`)
      .set(...authHeader(manager))

    expect(res.status).toBe(400)
  })

  it('is not open to another manager', async () => {
    const a = await withTeam()
    const b = await withTeam()
    const made = await submit(a.manager)

    const res = await request(app).delete(`/api/hiring/${made.body._id}`)
      .set(...authHeader(b.manager))

    expect(res.status).toBe(403)
  })
})
