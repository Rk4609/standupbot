import { Component } from 'react'
import { useLocation } from 'react-router-dom'
import Card from './ui/Card'
import Button from './ui/Button'
import { IconAlert, IconRefresh } from './ui/icons'
import { isStaleChunk } from '../lib/staleChunk'

/** Reloading is the fix for a stale chunk, but only if it is not already the second try. */
const RELOAD_KEY = 'standupbot_reloaded_for_chunk'

const alreadyTried = () => {
  try {
    return sessionStorage.getItem(RELOAD_KEY) === '1'
  } catch {
    return false
  }
}

const markTried = () => {
  try {
    sessionStorage.setItem(RELOAD_KEY, '1')
  } catch {
    // Private mode — the worst case is that we simply do not auto-reload
  }
}

const clearTried = () => {
  try {
    sessionStorage.removeItem(RELOAD_KEY)
  } catch {
    // as above
  }
}

class Boundary extends Component {
  state = { error: null, stale: false }

  static getDerivedStateFromError(error) {
    return { error, stale: isStaleChunk(error) }
  }

  componentDidCatch(error) {
    // A stale chunk is not a defect to read about, it is a page that needs
    // fetching again — so do that, once. A second failure means reloading is
    // not the answer and the person should be told rather than looped.
    if (isStaleChunk(error) && !alreadyTried()) {
      markTried()
      window.location.reload()
      return
    }

    console.error('Unhandled error in the page:', error)
  }

  componentDidUpdate(prevProps) {
    // Moving to another page clears the error, so one broken screen does not
    // take the rest of the app with it
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, stale: false })
    }
  }

  render() {
    const { error, stale } = this.state
    if (!error) return this.props.children

    return (
      <div className="px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto max-w-xl">
          <Card className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <IconAlert className="h-6 w-6" />
            </div>

            <h1 className="text-heading font-semibold text-content">
              {stale ? 'This page is out of date' : 'Something went wrong here'}
            </h1>

            <p className="mt-2 text-sm text-content-muted">
              {stale
                ? 'A newer version of the app has been released. Reloading picks it up.'
                : 'The rest of the app is fine — this one screen stopped. Nothing you had saved is lost.'}
            </p>

            {import.meta.env.DEV && (
              <pre className="scroll-slim mt-4 max-h-40 overflow-auto rounded-xl bg-surface-sunken p-3 text-left text-xs text-content-muted">
                {error.message}
              </pre>
            )}

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button
                onClick={() => {
                  clearTried()
                  window.location.reload()
                }}
              >
                <IconRefresh className="h-4 w-4" />
                Reload
              </Button>
              <Button variant="outline" onClick={() => window.location.assign('/dashboard')}>
                Go to dashboard
              </Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }
}

/**
 * The boundary itself has to be a class — React offers no hook for catching a
 * render error. This wrapper gives it the current path so navigating away
 * clears whatever broke.
 */
export default function ErrorBoundary({ children }) {
  const { pathname } = useLocation()
  return <Boundary resetKey={pathname}>{children}</Boundary>
}
