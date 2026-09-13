import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ErrorBoundary from '../components/ErrorBoundary'
import { isStaleChunk } from '../lib/staleChunk'

/** A component that throws on render, which is what a boundary is for. */
const Boom = ({ message }) => {
  throw new Error(message)
}

const reload = vi.fn()
const assign = vi.fn()

const renderAt = (path, children) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </MemoryRouter>
  )

/** The two halves of the loop guard are two separate visits to the page. */
const visit = (path, children) => {
  const { unmount } = renderAt(path, children)
  return unmount
}

beforeEach(() => {
  reload.mockReset()
  assign.mockReset()
  sessionStorage.clear()

  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname: '/dashboard', reload, assign }
  })

  // React logs the caught error; the test is not about that noise
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isStaleChunk', () => {
  it('recognises the ways a missing chunk is reported', () => {
    expect(isStaleChunk(new Error('Failed to fetch dynamically imported module: /assets/x.js')))
      .toBe(true)
    expect(isStaleChunk(new Error('error loading dynamically imported module')))
      .toBe(true)
    expect(isStaleChunk(new Error('Importing a module script failed.'))).toBe(true)
    expect(isStaleChunk(new Error('ChunkLoadError: Loading chunk 3 failed'))).toBe(true)
  })

  it('does not mistake an ordinary bug for one', () => {
    expect(isStaleChunk(new Error("Cannot read properties of undefined"))).toBe(false)
    expect(isStaleChunk(new Error(''))).toBe(false)
    expect(isStaleChunk(undefined)).toBe(false)
  })
})

describe('when a page throws', () => {
  it('keeps the app up and says so, instead of going blank', () => {
    renderAt('/dashboard', <Boom message="Cannot read properties of undefined" />)

    expect(screen.getByText('Something went wrong here')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
  })

  it('does not reload on its own for an ordinary bug', () => {
    // Reloading would just crash again and lose whatever the person was doing
    renderAt('/dashboard', <Boom message="x.map is not a function" />)

    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads when asked', async () => {
    const user = userEvent.setup()
    renderAt('/dashboard', <Boom message="x.map is not a function" />)

    await user.click(screen.getByRole('button', { name: /reload/i }))

    expect(reload).toHaveBeenCalled()
  })

  it('offers a way out of the broken screen', async () => {
    const user = userEvent.setup()
    renderAt('/dashboard', <Boom message="x.map is not a function" />)

    await user.click(screen.getByRole('button', { name: /go to dashboard/i }))

    expect(assign).toHaveBeenCalledWith('/dashboard')
  })

  it('renders children untouched when nothing throws', () => {
    renderAt('/dashboard', <p>The page</p>)

    expect(screen.getByText('The page')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong here')).not.toBeInTheDocument()
  })
})

describe('when the chunk is simply gone', () => {
  const staleMessage = 'Failed to fetch dynamically imported module: /assets/Analytics-abc.js'

  it('fetches the page again rather than explaining a deploy to anybody', () => {
    renderAt('/analytics', <Boom message={staleMessage} />)

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('gives up after one try instead of looping', () => {
    const unmount = visit('/analytics', <Boom message={staleMessage} />)
    expect(reload).toHaveBeenCalledTimes(1)
    unmount()

    // The reload happened and the chunk is still missing
    reload.mockClear()
    visit('/analytics', <Boom message={staleMessage} />)

    expect(reload).not.toHaveBeenCalled()
    expect(screen.getByText('This page is out of date')).toBeInTheDocument()
  })

  it('says what happened rather than showing a stack trace', () => {
    sessionStorage.setItem('standupbot_reloaded_for_chunk', '1')
    renderAt('/analytics', <Boom message={staleMessage} />)

    expect(screen.getByText(/newer version of the app/i)).toBeInTheDocument()
  })
})
