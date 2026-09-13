import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import { getUser, saveUser } from '../store/authStore'

/**
 * The "redirect once" guard is module state, and in a browser it is only ever
 * reached once because the page is on its way out. Each test gets a fresh
 * module so one case cannot leave it tripped for the next.
 */
let API
let mock

const load = async () => {
  vi.resetModules()
  API = (await import('../api/axios')).default
  mock = new MockAdapter(API)
}

const signedIn = () =>
  saveUser({ _id: 'u1', name: 'Someone', email: 'a@b.test', token: 'a-token' })

/** window.location is read-only in jsdom, so stand in for it. */
const stubLocation = (pathname = '/dashboard') => {
  const replace = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname, replace, href: `http://localhost${pathname}` }
  })
  return replace
}

beforeEach(async () => {
  localStorage.clear()
  sessionStorage.clear()
  await load()
})

afterEach(() => {
  mock.restore()
  vi.unstubAllGlobals()
})

describe('the request interceptor', () => {
  it('attaches the stored token', async () => {
    signedIn()
    mock.onGet('/anything').reply(200, {})

    await API.get('/anything')

    expect(mock.history.get[0].headers.Authorization).toBe('Bearer a-token')
  })

  it('sends nothing when nobody is signed in', async () => {
    mock.onGet('/anything').reply(200, {})

    await API.get('/anything')

    expect(mock.history.get[0].headers.Authorization).toBeUndefined()
  })
})

describe('when a session lapses', () => {
  it('clears the session and goes to sign-in with a reason', async () => {
    signedIn()
    const replace = stubLocation('/dashboard')
    mock.onGet('/users/profile').reply(401, { message: 'Token invalid' })

    await expect(API.get('/users/profile')).rejects.toBeTruthy()

    expect(getUser()).toBeNull()
    expect(replace).toHaveBeenCalledWith('/login?expired=1')
  })

  it('still rejects, so the caller is not left waiting', async () => {
    signedIn()
    stubLocation('/dashboard')
    mock.onGet('/team').reply(401, { message: 'Token invalid' })

    await expect(API.get('/team')).rejects.toMatchObject({
      response: { status: 401 }
    })
  })

  it('redirects once however many requests fail together', async () => {
    signedIn()
    const replace = stubLocation('/dashboard')
    mock.onGet(/.*/).reply(401, { message: 'Token invalid' })

    await Promise.allSettled([
      API.get('/a'),
      API.get('/b'),
      API.get('/c')
    ])

    expect(replace).toHaveBeenCalledTimes(1)
  })
})

describe('signing in', () => {
  it('leaves a wrong password to the form, rather than bouncing the page', async () => {
    const replace = stubLocation('/login')
    mock.onPost('/auth/login').reply(401, { message: 'Invalid email ya password' })

    await expect(API.post('/auth/login', {})).rejects.toMatchObject({
      response: { status: 401 }
    })

    // Throwing someone out of a session they are not in yet would replace the
    // error message with a blank form
    expect(replace).not.toHaveBeenCalled()
  })

  it('leaves a lapsed reset link to its own page', async () => {
    const replace = stubLocation('/reset-password/abc')
    mock.onPost('/auth/reset-password/abc').reply(401, { message: 'Link expired' })

    await expect(API.post('/auth/reset-password/abc', {})).rejects.toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })
})

describe('other failures', () => {
  it('are passed through untouched', async () => {
    signedIn()
    const replace = stubLocation('/blockers')
    mock.onGet('/blockers').reply(500, { message: 'Something broke' })

    await expect(API.get('/blockers')).rejects.toMatchObject({
      response: { status: 500 }
    })

    expect(getUser()).not.toBeNull()
    expect(replace).not.toHaveBeenCalled()
  })

  it('leaves a 403 alone — that is a permission, not an expiry', async () => {
    signedIn()
    const replace = stubLocation('/analytics')
    mock.onGet('/analytics/overview').reply(403, { message: 'Access denied' })

    await expect(API.get('/analytics/overview')).rejects.toBeTruthy()

    expect(getUser()).not.toBeNull()
    expect(replace).not.toHaveBeenCalled()
  })
})
