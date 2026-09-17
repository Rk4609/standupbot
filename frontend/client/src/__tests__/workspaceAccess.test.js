import { afterEach, describe, expect, it } from 'vitest'
import { workspaceSectionsFor } from '../lib/workspaceSections'
import { getUser, saveUser, updateUser } from '../store/authStore'

const ALL = [
  'dashboard', 'standup', 'history', 'timesheet', 'support',
  'team', 'employees', 'blockers', 'timesheets', 'analytics', 'retro',
  'projects', 'templates', 'integrations', 'activity',
  'records', 'hiring', 'approvals', 'pay', 'people', 'roles'
]

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('what an admin finds under Workspace', () => {
  it('includes the admin panel and roles, by those names', () => {
    const labels = workspaceSectionsFor({ role: 'admin', modules: ALL }).map(s => s.label)

    expect(labels).toContain('Admin panel')
    expect(labels).toContain('Roles & access')
    expect(labels).toContain('Hiring')
    expect(labels).toContain('Approvals')
  })

  it('leaves out what a manager cannot open', () => {
    const labels = workspaceSectionsFor({
      role: 'manager',
      modules: ALL.filter(m => !['people', 'roles', 'approvals', 'pay'].includes(m))
    }).map(s => s.label)

    expect(labels).not.toContain('Admin panel')
    expect(labels).not.toContain('Roles & access')
    expect(labels).toContain('Hiring')
  })

  it('puts first whatever the role can open, so the landing tab is never refused', () => {
    const [first] = workspaceSectionsFor({ role: 'admin', modules: ['dashboard', 'support', 'roles'] })
    expect(first.to).toBe('roles')
  })
})

describe('refreshing a signed-in session', () => {
  it('adds what the server now allows without losing the token', () => {
    saveUser({ _id: '1', token: 'jwt', role: 'admin', modules: ['dashboard'] })

    const next = updateUser({ modules: ALL, roleName: 'Admin' })

    expect(next.token).toBe('jwt')
    expect(getUser().modules).toContain('hiring')
    expect(getUser().roleName).toBe('Admin')
  })

  it('keeps a "don\'t remember me" session in the tab it belongs to', () => {
    saveUser({ _id: '1', token: 'jwt', role: 'admin' }, { remember: false })

    updateUser({ modules: ALL })

    expect(localStorage.getItem('standupbot_user')).toBeNull()
    expect(JSON.parse(sessionStorage.getItem('standupbot_user')).modules).toContain('roles')
  })

  it('does nothing when nobody is signed in', () => {
    expect(updateUser({ modules: ALL })).toBeNull()
    expect(getUser()).toBeNull()
  })
})
