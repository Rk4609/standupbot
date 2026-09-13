import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Role from '../models/Role.js'
import User from '../models/User.js'
import { invalidate } from '../services/roleService.js'
import { authHeader, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

beforeEach(() => {
  // The service holds resolved roles for a minute; a test that writes one
  // and reads it back in the same second must not see the old answer
  invalidate()
})

const asAdmin = async () => makeUser({ role: 'admin' })

const listRoles = (user) => request(app).get('/api/roles').set(...authHeader(user))

const createRole = (user, body) =>
  request(app).post('/api/roles').set(...authHeader(user)).send(body)

describe('the roles that already existed', () => {
  it('appear the first time anybody looks', async () => {
    const admin = await asAdmin()

    const res = await listRoles(admin)

    expect(res.status).toBe(200)
    expect(res.body.roles.map(r => r.key).sort()).toEqual(['admin', 'employee', 'manager'])
    expect(res.body.roles.every(r => r.builtIn)).toBe(true)
  })

  it('counts the people who hold each one, named or not', async () => {
    const admin = await asAdmin()
    await makeUser()
    await makeUser()

    const res = await listRoles(admin)

    const employee = res.body.roles.find(r => r.key === 'employee')
    expect(employee.people).toBeGreaterThanOrEqual(2)
  })

  it('lists the modules a role of that level may hold at all', async () => {
    const admin = await asAdmin()

    const { body } = await listRoles(admin)

    const employee = body.roles.find(r => r.key === 'employee')
    expect(employee.allowed).not.toContain('activity')
    expect(employee.allowed).toContain('timesheet')
  })

  it('is closed to everybody but an admin', async () => {
    expect((await listRoles(await makeUser())).status).toBe(403)
    expect((await listRoles(await makeUser({ role: 'manager' }))).status).toBe(403)
  })
})

describe('naming a new role', () => {
  it('takes its key from the name', async () => {
    const admin = await asAdmin()

    const res = await createRole(admin, { name: 'Delivery Lead', base: 'manager' })

    expect(res.status).toBe(201)
    expect(res.body.key).toBe('delivery-lead')
    expect(res.body.builtIn).toBe(false)
  })

  it('refuses a second role by the same name', async () => {
    const admin = await asAdmin()
    await createRole(admin, { name: 'Delivery Lead', base: 'manager' })

    const res = await createRole(admin, { name: 'delivery lead', base: 'manager' })
    expect(res.status).toBe(409)
  })

  it('drops anything the level itself could never reach', async () => {
    const admin = await asAdmin()

    // Ticking the audit trail on an employee-level role is not a way in: the
    // route asks for manager authority regardless
    const res = await createRole(admin, {
      name: 'Contractor',
      base: 'employee',
      modules: ['dashboard', 'standup', 'activity', 'people']
    })

    expect(res.body.modules).not.toContain('activity')
    expect(res.body.modules).not.toContain('people')
    expect(res.body.modules).toContain('standup')
  })

  it('keeps the ways back in, whatever was ticked', async () => {
    const admin = await asAdmin()

    const res = await createRole(admin, { name: 'Narrow', base: 'employee', modules: [] })

    expect(res.body.modules).toEqual(expect.arrayContaining(['dashboard', 'support']))
  })
})

describe('changing what a role reaches', () => {
  const patch = (user, role, body) =>
    request(app).patch(`/api/roles/${role._id}`).set(...authHeader(user)).send(body)

  it('takes a module away', async () => {
    const admin = await asAdmin()
    const { body: role } = await createRole(admin, { name: 'Lead A', base: 'manager' })

    const res = await patch(admin, role, {
      modules: role.modules.filter(m => m !== 'analytics')
    })

    expect(res.body.modules).not.toContain('analytics')
  })

  it('will not edit the admin role, because that is the way back in', async () => {
    const admin = await asAdmin()
    await listRoles(admin)
    const adminRole = await Role.findOne({ key: 'admin' })

    const res = await patch(admin, adminRole, { modules: ['dashboard'] })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/way back in/i)
  })

  it('will not re-level a built-in role under everybody holding it', async () => {
    const admin = await asAdmin()
    await listRoles(admin)
    const employeeRole = await Role.findOne({ key: 'employee' })

    const res = await patch(admin, employeeRole, { base: 'admin' })
    expect(res.status).toBe(400)
  })
})

describe('removing a role', () => {
  const remove = (user, role) =>
    request(app).delete(`/api/roles/${role._id}`).set(...authHeader(user))

  it('keeps the three that shipped', async () => {
    const admin = await asAdmin()
    await listRoles(admin)
    const managerRole = await Role.findOne({ key: 'manager' })

    const res = await remove(admin, managerRole)
    expect(res.status).toBe(400)
  })

  it('refuses while somebody still holds it', async () => {
    const admin = await asAdmin()
    const person = await makeUser()
    const { body: role } = await createRole(admin, { name: 'Held', base: 'employee' })

    await request(app).post(`/api/roles/${role._id}/assign`)
      .set(...authHeader(admin)).send({ users: [String(person._id)] })

    const res = await remove(admin, role)
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Move them first/i)
  })

  it('removes one nobody is on', async () => {
    const admin = await asAdmin()
    const { body: role } = await createRole(admin, { name: 'Unused', base: 'employee' })

    expect((await remove(admin, role)).status).toBe(200)
    expect(await Role.findById(role._id)).toBeNull()
  })
})

describe('giving somebody a role', () => {
  const assign = (user, role, users) =>
    request(app).post(`/api/roles/${role._id}/assign`).set(...authHeader(user)).send({ users })

  it('sets the level the server enforces as well as the name', async () => {
    const admin = await asAdmin()
    const person = await makeUser()
    const { body: role } = await createRole(admin, { name: 'Delivery Lead', base: 'manager' })

    const res = await assign(admin, role, [String(person._id)])

    expect(res.status).toBe(200)
    const after = await User.findById(person._id).lean()
    expect(after.role).toBe('manager')
    expect(String(after.accessRole)).toBe(String(role._id))
  })

  it('moves several people at once', async () => {
    const admin = await asAdmin()
    const a = await makeUser()
    const b = await makeUser()
    const { body: role } = await createRole(admin, { name: 'Squad', base: 'employee' })

    const res = await assign(admin, role, [String(a._id), String(b._id)])
    expect(res.body.count).toBe(2)
  })

  it('drops the named role when somebody is put back on a plain one', async () => {
    const admin = await asAdmin()
    const person = await makeUser()
    const { body: role } = await createRole(admin, { name: 'Temp lead', base: 'manager' })
    await assign(admin, role, [String(person._id)])

    await request(app).patch(`/api/users/${person._id}/role`)
      .set(...authHeader(admin)).send({ role: 'employee' })

    const after = await User.findById(person._id).lean()
    expect(after.accessRole).toBeNull()
    expect(after.role).toBe('employee')
  })

  it('will not let an admin change their own level by the back door', async () => {
    const admin = await asAdmin()
    const { body: role } = await createRole(admin, { name: 'Downgrade', base: 'employee' })

    const res = await assign(admin, role, [String(admin._id)])
    expect(res.status).toBe(400)
  })

  it('leaves a trail, because somebody will ask who moved them', async () => {
    const admin = await asAdmin()
    const person = await makeUser({ name: 'Asha' })
    const { body: role } = await createRole(admin, { name: 'Trail', base: 'employee' })

    await assign(admin, role, [String(person._id)])

    const { default: AuditLog } = await import('../models/AuditLog.js')
    const [entry] = await AuditLog.find({ action: 'user.role_changed', subjectName: 'Asha' })
      .sort({ createdAt: -1 }).limit(1).lean()

    expect(entry.changes[0].to).toBe('Trail')
  })
})

describe('what the permission actually does', () => {
  const withRole = async (name, base, modules) => {
    const admin = await asAdmin()
    const { body: role } = await createRole(admin, { name, base, modules })
    const person = await makeUser({ role: base })
    await request(app).post(`/api/roles/${role._id}/assign`)
      .set(...authHeader(admin)).send({ users: [String(person._id)] })
    invalidate()
    return await User.findById(person._id)
  }

  it('refuses a manager whose role no longer has analytics', async () => {
    const lead = await withRole('No numbers', 'manager', [
      'dashboard', 'standup', 'support', 'team', 'blockers'
    ])

    const res = await request(app).get('/api/analytics/team').set(...authHeader(lead))

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/does not have access/i)
  })

  it('lets the same person through to what they do have', async () => {
    const lead = await withRole('Blockers only', 'manager', [
      'dashboard', 'standup', 'support', 'blockers'
    ])
    await makeTeam(lead)

    const res = await request(app).get('/api/standups/blockers').set(...authHeader(lead))
    expect(res.status).toBe(200)
  })

  it('tells somebody what they may open', async () => {
    const lead = await withRole('Reader', 'manager', ['dashboard', 'support', 'team'])

    const res = await request(app).get('/api/roles/me').set(...authHeader(lead))

    expect(res.body.role.name).toBe('Reader')
    expect(res.body.modules).toContain('team')
    expect(res.body.modules).not.toContain('analytics')
  })

  it('leaves everybody who was never given a named role exactly as they were', async () => {
    const manager = await makeUser({ role: 'manager' })

    const res = await request(app).get('/api/roles/me').set(...authHeader(manager))

    expect(res.body.modules).toContain('analytics')
    expect(res.body.modules).not.toContain('roles')
  })
})
