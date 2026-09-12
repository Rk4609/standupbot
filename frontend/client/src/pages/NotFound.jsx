import { useLocation, useNavigate } from 'react-router-dom'
import PageShell from '../components/ui/PageShell'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { IconAlert } from '../components/ui/icons'

/**
 * Unknown URLs used to redirect to the dashboard. That hid real problems: a
 * tab running a stale bundle would click a nav link, silently land on the
 * dashboard, and read as a broken link rather than as an out-of-date page.
 * Saying what happened — and offering the reload that usually fixes it — costs
 * one screen and saves the guesswork.
 */
export default function NotFound({ user }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  return (
    <PageShell width="sm">
      <Card className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <IconAlert className="h-6 w-6" />
        </div>

        <h1 className="text-heading font-semibold text-content">Page not found</h1>

        <p className="mt-2 text-sm text-content-muted">
          Nothing is routed at{' '}
          <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-xs text-content">
            {pathname}
          </code>
          .
        </p>

        <p className="mt-3 text-sm text-content-subtle">
          If you followed a link from inside the app, this page is probably out of
          date — reloading picks up the latest version.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Reload the app</Button>
          <Button variant="outline" to={user ? '/dashboard' : '/login'}>
            {user ? 'Go to dashboard' : 'Go to sign in'}
          </Button>
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>
      </Card>
    </PageShell>
  )
}
