import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Candidate from '../models/Candidate.js'
import Leave from '../models/Leave.js'
import Project from '../models/Project.js'
import SupportTicket from '../models/SupportTicket.js'
import { invalidate } from '../services/roleService.js'
import { authHeader, joinTeam, makeStandup, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

beforeEach(() => {
  invalidate()
})

const find = (user, q) => request(app).get('/api/search').query({ q }).set(...authHeader(user))
const group = (res, key) => res.body.groups.find(g => g.key === key)?.results || []

const world = async () => {
  const manager = await makeUser({ role: 'manager', name: 'Deepak Lead' })
  const team = await makeTeam(manager)
  const riya = await joinTeam(await makeUser({ name: 'Riya Das', employment: { position: 'QA engineer' } }), team)
  const otherManager = await makeUser({ role: 'manager' })
  const otherTeam = await makeTeam(otherManager)
  const riyaElsewhere = await joinTeam(await makeUser({ name: 'Riya Kapoor' }), otherTeam)
  const admin = await makeUser({ role: 'admin' })
  return { manager, team, riya, otherManager, otherTeam, riyaElsewhere, admin }
}

describe('searching', () => {
  it('needs at least two letters', async () => {
    const { riya } = await world()
    const res = await find(riya, 'r')
    expect(res.status).toBe(200)
    expect(res.body.groups).toEqual([])
  })

  it('finds people in a manager\'s own team only, and never their pay', async () => {
    const { manager } = await world()

    const res = await find(manager, 'riya')

    const people = group(res, 'people')
    expect(people.map(p => p.title)).toEqual(['Riya Das'])
    expect(people[0].detail).toContain('QA engineer')
    expect(JSON.stringify(res.body)).not.toMatch(/salary/)
  })

  it('finds everybody for an admin', async () => {
    const { admin } = await world()
    const res = await find(admin, 'riya')
    expect(group(res, 'people').map(p => p.title).sort()).toEqual(['Riya Das', 'Riya Kapoor'])
  })

  it('gives an employee no people at all', async () => {
    const { riya } = await world()
    const res = await find(riya, 'riya')
    expect(group(res, 'people')).toEqual([])
  })

  it('shows somebody their own support tickets, and an admin everybody\'s', async () => {
    const { riya, riyaElsewhere, admin } = await world()
    await SupportTicket.create({ user: riya._id, userName: riya.name, subject: 'Laptop keyboard broken', body: 'Keys stick' })
    await SupportTicket.create({ user: riyaElsewhere._id, userName: riyaElsewhere.name, subject: 'Laptop battery', body: 'Drains' })

    expect(group(await find(riya, 'laptop'), 'tickets').map(t => t.title)).toEqual(['Laptop keyboard broken'])
    expect(group(await find(admin, 'laptop'), 'tickets')).toHaveLength(2)
  })

  it('finds a person\'s own standups by what they wrote', async () => {
    const { riya, riyaElsewhere } = await world()
    await makeStandup(riya, { today: 'Regression tests for the refund flow' })
    await makeStandup(riyaElsewhere, { today: 'Refund flow design' })

    const res = await find(riya, 'refund')

    expect(group(res, 'standups')).toHaveLength(1)
    expect(group(res, 'standups')[0].detail).toMatch(/Your standup/)
  })

  it('shows a manager their team\'s leave by name, but not another team\'s', async () => {
    const { manager, team, riya, riyaElsewhere, otherTeam } = await world()
    await Leave.create({ user: riya._id, userName: riya.name, team: team._id, type: 'sick', from: '2026-09-21', to: '2026-09-21', days: 1, reason: 'Fever' })
    await Leave.create({ user: riyaElsewhere._id, userName: riyaElsewhere.name, team: otherTeam._id, type: 'casual', from: '2026-09-22', to: '2026-09-22', days: 1, reason: 'Errand' })

    const leave = group(await find(manager, 'riya'), 'leave')

    expect(leave.map(l => l.title)).toEqual(['Riya Das · sick leave'])
    expect(JSON.stringify(leave)).not.toMatch(/Fever/)
  })

  it('finds projects a lead can manage, and hides them from employees', async () => {
    const { manager, team, riya, otherTeam } = await world()
    await Project.create({ name: 'Checkout revamp', code: 'CHK', team: team._id })
    await Project.create({ name: 'Checkout for another team', team: otherTeam._id })

    expect(group(await find(manager, 'checkout'), 'projects').map(p => p.title)).toEqual(['Checkout revamp'])
    expect(group(await find(riya, 'checkout'), 'projects')).toEqual([])
  })

  it('shows a manager the candidates they put forward', async () => {
    const { manager, otherManager } = await world()
    await Candidate.create({ name: 'Kabir Sen', email: 'k@example.com', position: 'Intern', submittedBy: manager._id })

    expect(group(await find(manager, 'kabir'), 'candidates')).toHaveLength(1)
    expect(group(await find(otherManager, 'kabir'), 'candidates')).toHaveLength(0)
  })

  it('treats what is typed as text, not a pattern', async () => {
    const { admin } = await world()
    const res = await find(admin, '.*(')
    expect(res.status).toBe(200)
    expect(group(res, 'people')).toEqual([])
  })
})
