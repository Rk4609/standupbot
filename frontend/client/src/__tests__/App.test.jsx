import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

vi.mock('../api/axios', () => ({
  default: {
    // Everything a page asks for stays pending, except the permission check
    // the shell makes on start, which answers the way the server now would
    get: vi.fn((url) =>
      url === '/roles/me'
        ? Promise.resolve({
            data: {
              role: { key: 'admin', name: 'Admin', base: 'admin' },
              modules: [
                'dashboard', 'standup', 'history', 'support',
                'team', 'employees', 'blockers', 'analytics', 'retro',
                'projects', 'templates', 'integrations', 'activity',
                'records', 'hiring', 'approvals', 'pay', 'people', 'roles'
              ]
            }
          })
        : new Promise(() => {})
    ),
    put: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }
  }
}))

vi.mock('../socket', () => ({
  default: { connect: vi.fn(), disconnect: vi.fn(), on: vi.fn(), off: vi.fn() }
}))

import App from '../App'

const openAt = (path) => {
  window.history.pushState({}, '', path)
  return render(<App />)
}

afterEach(() => {
  localStorage.clear()
  window.history.pushState({}, '', '/')
})

describe('the front door', () => {
  it('sends somebody who is signed out to the sign-in screen', async () => {
    openAt('/')

    await waitFor(() => expect(window.location.pathname).toBe('/login'))
  })

  it('sends somebody who is signed in straight to their dashboard', async () => {
    localStorage.setItem('standupbot_user', JSON.stringify({
      _id: 'u1', name: 'Asha', email: 'asha@acme.test', role: 'employee', token: 't'
    }))

    openAt('/')

    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'))
  })

  it('brings an older session up to date with what the role can open now', async () => {
    // Signed in before Hiring and Approvals existed: the stored list lacks them
    localStorage.setItem('standupbot_user', JSON.stringify({
      _id: 'u1', name: 'Rakesh', email: 'r@acme.test', role: 'admin', token: 't',
      modules: ['dashboard', 'support', 'projects', 'people', 'roles']
    }))

    openAt('/dashboard')

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('standupbot_user'))
      expect(stored.modules).toEqual(expect.arrayContaining(['hiring', 'approvals', 'records']))
      expect(stored.roleName).toBe('Admin')
      expect(stored.token).toBe('t')
    })
  })

  it('still says "not found" for an address that really is not a page', async () => {
    const { findByText } = openAt('/no-such-page')

    expect(await findByText(/Page not found/i)).toBeInTheDocument()
  })
})
