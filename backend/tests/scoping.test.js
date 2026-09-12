import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { authHeader, joinTeam, makeStandup, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

/**
 * Role scoping is the part of this API that most needs guarding: a manager
 * seeing another team's standups, or an employee reaching a manager route, is
 * a data leak rather than a glitch.
 */
describe('role scoping', () => {
  const setup = async () => {
    const admin = await makeUser({ role: 'admin' })

    const alphaManager = await makeUser({ role: 'manager' })
    const alpha = await makeTeam(alphaManager, { name: 'Alpha' })
    const alphaEmployee = await joinTeam(await makeUser(), alpha)

    const betaManager = await makeUser({ role: 'manager' })
    const beta = await makeTeam(betaManager, { name: 'Beta' })
    const betaEmployee = await joinTeam(await makeUser(), beta)

    return { admin, alphaManager, alpha, alphaEmployee, betaManager, beta, betaEmployee }
  }

  it('keeps an employee out of the manager-only routes', async () => {
    const employee = await makeUser()

    for (const path of ['/api/standups/team', '/api/standups/blockers', '/api/employees', '/api/retro']) {
      const res = await request(app).get(path).set(...authHeader(employee))
      expect(res.status, `${path} should be forbidden`).toBe(403)
    }
  })

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/employees')
    expect(res.status).toBe(401)
  })

  it('rejects a token for a user who has since been deleted', async () => {
    const ghost = await makeUser()
    const header = authHeader(ghost)
    await ghost.deleteOne()

    const res = await request(app).get('/api/standups/my').set(...header)
    expect(res.status).toBe(401)
  })

  it('shows a manager only their own team in the roster', async () => {
    const { alphaManager, alphaEmployee, betaEmployee } = await setup()

    const res = await request(app).get('/api/employees').set(...authHeader(alphaManager))

    expect(res.status).toBe(200)
    const ids = res.body.employees.map(e => e._id)
    expect(ids).toContain(String(alphaEmployee._id))
    expect(ids).not.toContain(String(betaEmployee._id))
  })

  it('lets an admin see everyone', async () => {
    const { admin, alphaEmployee, betaEmployee } = await setup()

    const res = await request(app).get('/api/employees').set(...authHeader(admin))

    const ids = res.body.employees.map(e => e._id)
    expect(ids).toEqual(expect.arrayContaining([
      String(alphaEmployee._id), String(betaEmployee._id)
    ]))
  })

  it('404s when a manager opens an employee from another team', async () => {
    const { alphaManager, betaEmployee } = await setup()

    const res = await request(app)
      .get(`/api/employees/${betaEmployee._id}`)
      .set(...authHeader(alphaManager))

    expect(res.status).toBe(404)
  })

  it('returns only the manager\'s own team standups', async () => {
    const { alphaManager, alphaEmployee, betaEmployee } = await setup()
    await makeStandup(alphaEmployee, { today: 'alpha work' })
    await makeStandup(betaEmployee, { today: 'beta work' })

    const res = await request(app).get('/api/standups/team').set(...authHeader(alphaManager))

    expect(res.status).toBe(200)
    const plans = res.body.map(s => s.today)
    expect(plans).toContain('alpha work')
    expect(plans).not.toContain('beta work')
  })

  it('tells a manager with no team that they have none, rather than showing everyone', async () => {
    const orphan = await makeUser({ role: 'manager' })
    const other = await joinTeam(await makeUser(), await makeTeam(await makeUser({ role: 'manager' })))
    await makeStandup(other, { hasBlocker: true, blockers: 'secret blocker' })

    // Previously the team filter was skipped when there was no team, which
    // silently showed every team's blockers
    const res = await request(app).get('/api/standups/blockers').set(...authHeader(orphan))

    expect(res.status).toBe(400)
    expect(JSON.stringify(res.body)).not.toContain('secret blocker')
  })

  it('stops a manager editing another team\'s blocker', async () => {
    const { alphaManager, betaEmployee } = await setup()
    const standup = await makeStandup(betaEmployee, { hasBlocker: true, blockers: 'beta blocker' })

    const res = await request(app)
      .put(`/api/standups/${standup._id}/blocker`)
      .set(...authHeader(alphaManager))
      .send({ blockers: 'tampered' })

    expect(res.status).toBe(403)
  })

  it('stops a manager deleting another team\'s standup', async () => {
    const { alphaManager, betaEmployee } = await setup()
    const standup = await makeStandup(betaEmployee)

    const res = await request(app)
      .delete(`/api/standups/${standup._id}`)
      .set(...authHeader(alphaManager))

    expect(res.status).toBe(403)
  })

  it('lets an admin delete any standup', async () => {
    const { admin, betaEmployee } = await setup()
    const standup = await makeStandup(betaEmployee)

    const res = await request(app)
      .delete(`/api/standups/${standup._id}`)
      .set(...authHeader(admin))

    expect(res.status).toBe(200)
  })

  it('keeps non-admins out of the admin routes', async () => {
    const manager = await makeUser({ role: 'manager' })

    expect((await request(app).get('/api/users').set(...authHeader(manager))).status).toBe(403)
    expect((await request(app).get('/api/teams').set(...authHeader(manager))).status).toBe(403)
  })
})
