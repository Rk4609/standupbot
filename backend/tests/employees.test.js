import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

/** 25 employees across two teams, with predictable names for search tests. */
const seedRoster = async () => {
  const admin = await makeUser({ role: 'admin', name: 'Zara Admin' })
  const alpha = await makeTeam(await makeUser({ role: 'manager' }), { name: 'Alpha' })
  const beta = await makeTeam(await makeUser({ role: 'manager' }), { name: 'Beta' })

  for (let i = 0; i < 25; i++) {
    const user = await makeUser({ name: `Person ${String(i).padStart(2, '0')}` })
    await joinTeam(user, i % 2 === 0 ? alpha : beta)
  }
  return { admin }
}

describe('GET /api/employees pagination', () => {
  it('defaults to 20 per page', async () => {
    const { admin } = await seedRoster()

    const res = await request(app).get('/api/employees').set(...authHeader(admin))

    expect(res.status).toBe(200)
    expect(res.body.limit).toBe(20)
    expect(res.body.employees).toHaveLength(20)
    expect(res.body.page).toBe(1)
  })

  it('splits the roster across pages without repeating or dropping anyone', async () => {
    const { admin } = await seedRoster()

    const first = await request(app)
      .get('/api/employees?limit=10&page=1').set(...authHeader(admin))
    const second = await request(app)
      .get('/api/employees?limit=10&page=2').set(...authHeader(admin))
    const third = await request(app)
      .get('/api/employees?limit=10&page=3').set(...authHeader(admin))

    const ids = [...first.body.employees, ...second.body.employees, ...third.body.employees]
      .map(e => e._id)

    expect(first.body.totalPages).toBe(3)
    expect(ids).toHaveLength(first.body.total)
    expect(new Set(ids).size).toBe(ids.length) // no duplicates across pages
  })

  it('clamps a page past the end to the last page instead of returning nothing', async () => {
    const { admin } = await seedRoster()

    const res = await request(app)
      .get('/api/employees?limit=10&page=99').set(...authHeader(admin))

    expect(res.body.page).toBe(res.body.totalPages)
    expect(res.body.employees.length).toBeGreaterThan(0)
  })

  it('falls back to the default for a limit that is not offered', async () => {
    const { admin } = await seedRoster()

    const res = await request(app).get('/api/employees?limit=7').set(...authHeader(admin))

    expect(res.body.limit).toBe(20)
  })

  it('narrows by search without changing the roster total', async () => {
    const { admin } = await seedRoster()

    const res = await request(app)
      .get('/api/employees?search=Person 03').set(...authHeader(admin))

    expect(res.body.total).toBe(1)
    expect(res.body.employees[0].name).toBe('Person 03')
    // The headline count still describes everyone
    expect(res.body.rosterTotal).toBeGreaterThan(1)
  })

  it('treats the search term as literal text, not a pattern', async () => {
    const { admin } = await seedRoster()

    // `.*` would match everything if the input were used as a regex
    const res = await request(app)
      .get('/api/employees?search=.*').set(...authHeader(admin))

    expect(res.body.total).toBe(0)
  })

  it('filters by team while keeping the full team list for the dropdown', async () => {
    const { admin } = await seedRoster()

    const res = await request(app).get('/api/employees?team=Alpha').set(...authHeader(admin))

    expect(res.body.employees.every(e => e.team?.name === 'Alpha')).toBe(true)
    expect(res.body.teams).toEqual(expect.arrayContaining(['Alpha', 'Beta']))
  })

  it('matches nothing for a team that does not exist', async () => {
    const { admin } = await seedRoster()

    // A missing lookup must not fall through to "no filter"
    const res = await request(app).get('/api/employees?team=Nope').set(...authHeader(admin))

    expect(res.body.total).toBe(0)
  })

  it('filters by role', async () => {
    const { admin } = await seedRoster()

    const res = await request(app).get('/api/employees?role=manager').set(...authHeader(admin))

    expect(res.body.employees.every(e => e.role === 'manager')).toBe(true)
    expect(res.body.total).toBe(2)
  })

  it('never includes the password hash or reset token', async () => {
    const { admin } = await seedRoster()

    const res = await request(app).get('/api/employees').set(...authHeader(admin))
    const serialised = JSON.stringify(res.body)

    expect(serialised).not.toContain('password')
    expect(serialised).not.toContain('resetPasswordToken')
  })

  it('rejects a malformed employee id', async () => {
    const { admin } = await seedRoster()

    const res = await request(app).get('/api/employees/not-an-id').set(...authHeader(admin))

    expect(res.status).toBe(400)
  })
})
