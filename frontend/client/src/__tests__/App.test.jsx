import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

vi.mock('../api/axios', () => ({
  default: {
    get: vi.fn(() => new Promise(() => {})),
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

  it('still says "not found" for an address that really is not a page', async () => {
    const { findByText } = openAt('/no-such-page')

    expect(await findByText(/Page not found/i)).toBeInTheDocument()
  })
})
