import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import { saveUser } from '../store/authStore'

let API
let warmUp
let clearWarm
let live
let mock

beforeEach(async () => {
  localStorage.clear()
  sessionStorage.clear()
  vi.resetModules()
  // Imported after the reset so the client and the test share one heartbeat
  const client = await import('../api/axios')
  live = await import('../lib/liveRefresh')
  API = client.default
  warmUp = client.warmUp
  clearWarm = client.clearWarm
  mock = new MockAdapter(API)
  saveUser({ _id: 'u1', name: 'Asha', token: 'token-a' })
})

afterEach(() => {
  mock.restore()
  vi.useRealTimers()
})

/** How many times the network was actually asked for this path. */
const calls = (path) => mock.history.get.filter(r => r.url === path).length

const later = (ms) => vi.setSystemTime(Date.now() + ms)
const tick = () => new Promise(r => setTimeout(r, 80))

describe('opening a module whose data was fetched ahead', () => {
  it('shows it without asking the network again', async () => {
    mock.onGet('/standups/blockers').reply(200, [{ _id: 'b1' }])

    await warmUp('/standups/blockers')
    const res = await API.get('/standups/blockers')

    expect(res.data).toEqual([{ _id: 'b1' }])
    expect(calls('/standups/blockers')).toBe(1)
  })

  it('serves every module that asks for the same thing, not just the first', async () => {
    mock.onGet('/standups/my').reply(200, [])

    await warmUp('/standups/my')
    await API.get('/standups/my') // the dashboard
    await API.get('/standups/my') // history, opened a moment later

    expect(calls('/standups/my')).toBe(1)
  })

  it('matches the same request however its parameters are spelled', async () => {
    mock.onGet('/employees').reply(200, { employees: [] })

    await warmUp('/employees', { params: { page: 1, limit: 20 } })
    await API.get('/employees', {
      params: { limit: 20, page: 1, search: undefined, role: undefined }
    })

    expect(calls('/employees')).toBe(1)
  })

  it('is not used for a different request', async () => {
    mock.onGet('/employees').reply(200, { employees: [] })

    await warmUp('/employees', { params: { page: 1, limit: 20 } })
    await API.get('/employees', { params: { page: 2, limit: 20 } })

    expect(calls('/employees')).toBe(2)
  })

  it('does not remember anything that was never fetched ahead', async () => {
    mock.onGet('/audit').reply(200, [])

    await API.get('/audit')
    await API.get('/audit')

    expect(calls('/audit')).toBe(2)
  })
})

describe('keeping it honest', () => {
  it('checks again straight after showing an answer that is not brand new', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    mock.onGet('/support/mine').reply(200, { tickets: [] })
    const refreshes = vi.fn()
    live.onRefresh(refreshes)

    await warmUp('/support/mine')
    later(11_000)
    await API.get('/support/mine')
    await tick()

    expect(calls('/support/mine')).toBe(1)
    expect(refreshes).toHaveBeenCalledTimes(1)
  })

  it('does not ask for that check when the answer is only seconds old', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    mock.onGet('/support/mine').reply(200, { tickets: [] })
    const refreshes = vi.fn()
    live.onRefresh(refreshes)

    await warmUp('/support/mine')
    later(2_000)
    await API.get('/support/mine')
    await tick()

    expect(refreshes).not.toHaveBeenCalled()
  })

  it('sends a refresh of what is on screen to the network, and keeps the answer', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    let version = 'old'
    mock.onGet('/timesheets').reply(() => [200, { version }])

    await warmUp('/timesheets')
    const shown = await API.get('/timesheets') // the module opens
    expect(shown.data.version).toBe('old')

    version = 'new'
    later(1_500)
    live.requestRefresh()
    const refreshed = await API.get('/timesheets') // the module refreshes

    expect(refreshed.data.version).toBe('new')
    expect(calls('/timesheets')).toBe(2)

    // Opening it again shows the newer answer, without another trip
    later(3_000)
    const next = await API.get('/timesheets')
    expect(next.data.version).toBe('new')
    expect(calls('/timesheets')).toBe(2)
  })

  it('still lets a module opening for the first time use it, even just after a refresh', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    mock.onGet('/standups/blockers').reply(200, [])

    await warmUp('/standups/blockers')
    later(500)
    live.requestRefresh() // something else on screen refreshed
    later(300)
    await API.get('/standups/blockers') // blockers opens now

    expect(calls('/standups/blockers')).toBe(1)
  })

  it('never lets a slow early answer replace a newer one', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    let finishWarm
    mock.onGet('/standups/stats').reply(config =>
      config.warm
        ? new Promise(resolve => { finishWarm = () => resolve([200, { version: 'old' }]) })
        : [200, { version: 'new' }]
    )

    const warming = warmUp('/standups/stats')
    await new Promise(r => setTimeout(r, 0))
    later(500)
    await API.get('/standups/stats') // sent after the warm-up, answers first
    finishWarm()
    await warming

    later(3_000)
    const next = await API.get('/standups/stats')
    expect(next.data.version).toBe('new')
  })

  it('forgets everything as soon as a change is sent', async () => {
    mock.onGet('/standups/my').reply(200, [])
    mock.onPost('/standups').reply(201, {})

    await warmUp('/standups/my')
    await API.post('/standups', { today: 'ship it' })
    await API.get('/standups/my')

    expect(calls('/standups/my')).toBe(2)
  })

  it('goes stale after five minutes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    mock.onGet('/analytics/overview').reply(200, {})

    await warmUp('/analytics/overview')
    later(5 * 60_000 + 1)
    await API.get('/analytics/overview')

    expect(calls('/analytics/overview')).toBe(2)
  })
})

describe('whose it is', () => {
  it('belongs to the session that fetched it, not the next one', async () => {
    mock.onGet('/standups/my').reply(200, [{ owner: 'a' }])

    await warmUp('/standups/my')
    saveUser({ _id: 'u2', name: 'Rohit', token: 'token-b' })
    await API.get('/standups/my')

    expect(calls('/standups/my')).toBe(2)
  })

  it('is forgotten on sign-out', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    mock.onGet('/standups/my').reply(200, [])

    await warmUp('/standups/my')
    clearWarm()
    later(10)
    await API.get('/standups/my')

    expect(calls('/standups/my')).toBe(2)
  })

  it('costs nothing when the early fetch fails', async () => {
    mock.onGet('/analytics/overview').reply(500)

    await expect(warmUp('/analytics/overview')).resolves.toBeUndefined()
    mock.onGet('/analytics/overview').reply(200, { ok: true })

    const res = await API.get('/analytics/overview')
    expect(res.data).toEqual({ ok: true })
  })
})
