import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useEffect, useState } from 'react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KeptPages from '../components/KeptPages'
import { keepKeyFor } from '../lib/keepAlive'
import { requestRefresh, resetLiveRefresh, useLiveRefresh } from '../lib/liveRefresh'

const user = { role: 'employee', modules: ['dashboard', 'standup', 'history', 'support'] }

const loads = {}

/**
 * Stands in for a real page: counts its data loads the way a page's effect
 * would, listens to live refresh like the real ones, and keeps a typed value.
 */
function FakePage({ name }) {
  const live = useLiveRefresh()
  const [typed, setTyped] = useState('')

  useEffect(() => {
    loads[name] = (loads[name] || 0) + 1
  }, [name, live])

  return (
    <main>
      <h1>{name}</h1>
      <input aria-label={`${name} box`} value={typed} onChange={e => setTyped(e.target.value)} />
      <Link to="/dashboard">to dashboard</Link>
      <Link to="/history">to history</Link>
      <Link to="/standup/new">to new standup</Link>
    </main>
  )
}

const renderApp = (who = user, at = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route element={<KeptPages user={who} />}>
          <Route path="/dashboard" element={<FakePage name="dashboard" />} />
          <Route path="/history" element={<FakePage name="history" />} />
          <Route path="/standup/new" element={<FakePage name="standup" />} />
        </Route>
      </Routes>
    </MemoryRouter>
  )

const visibleHeading = () =>
  screen.getAllByRole('heading', { hidden: true }).find(h => h.checkVisibility?.() ?? true)

beforeEach(() => {
  for (const key of Object.keys(loads)) delete loads[key]
  resetLiveRefresh()
})

afterEach(() => {
  resetLiveRefresh()
})

describe('opening a module again', () => {
  it('shows it as it was left instead of building it from nothing', async () => {
    renderApp()

    await userEvent.type(screen.getByLabelText('dashboard box'), 'half typed')
    await userEvent.click(screen.getByRole('link', { name: 'to history' }))
    await userEvent.click(screen.getAllByRole('link', { name: 'to dashboard' })[0])

    expect(await screen.findByLabelText('dashboard box')).toHaveValue('half typed')
  })

  it('reloads its data in the background when it is shown again', async () => {
    renderApp()
    await act(async () => {})
    const before = loads.dashboard

    await userEvent.click(screen.getByRole('link', { name: 'to history' }))
    await userEvent.click(screen.getAllByRole('link', { name: 'to dashboard' })[0])

    expect(loads.dashboard).toBeGreaterThan(before)
  })

  it('shows only the module that is open', async () => {
    renderApp()

    await userEvent.click(screen.getByRole('link', { name: 'to history' }))

    expect(screen.getByRole('heading', { name: 'history' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'dashboard' })).toBeNull()
  })

  it('opens a new standup empty every time, never with the last one typed', async () => {
    renderApp(user, '/standup/new')

    await userEvent.type(screen.getByLabelText('standup box'), 'already sent')
    await userEvent.click(screen.getByRole('link', { name: 'to dashboard' }))
    await userEvent.click(screen.getAllByRole('link', { name: 'to new standup' })[0])

    expect(await screen.findByLabelText('standup box')).toHaveValue('')
  })

  it('keeps nothing for somebody signed out', () => {
    renderApp(null)
    expect(visibleHeading()).toHaveTextContent('dashboard')
  })
})

describe('new data arriving', () => {
  it('reloads the page on screen in place, without remounting it', async () => {
    renderApp()
    await userEvent.type(screen.getByLabelText('dashboard box'), 'still here')
    const before = loads.dashboard

    await act(async () => {
      requestRefresh()
    })

    expect(loads.dashboard).toBe(before + 1)
    // Same component, same state: nothing was rebuilt
    expect(screen.getByLabelText('dashboard box')).toHaveValue('still here')
  })

  it('collapses a burst of triggers into one reload', async () => {
    renderApp()
    const before = loads.dashboard

    await act(async () => {
      requestRefresh(10_000)
      requestRefresh(10_200)
      requestRefresh(10_900)
    })

    expect(loads.dashboard).toBe(before + 1)
  })
})

describe('which pages are kept', () => {
  it('groups every Workspace tab and leaves the standup form out', () => {
    expect(keepKeyFor('/workspace/roles')).toBe('/workspace')
    expect(keepKeyFor('/workspace/hiring')).toBe('/workspace')
    expect(keepKeyFor('/standup/new')).toBeNull()
    expect(keepKeyFor('/history')).toBe('/history')
  })
})
