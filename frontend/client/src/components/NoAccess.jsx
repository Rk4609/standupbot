import PageShell from './ui/PageShell'
import Card from './ui/Card'
import Button from './ui/Button'
import { IconLock } from './ui/icons'

/** Reads better than a module key when somebody lands here. */
const LABEL = {
  standup: 'submitting a standup',
  history: 'your standup history',
  team: 'the team overview',
  employees: 'the employees list',
  blockers: 'the blockers board',
  analytics: 'analytics and exports',
  projects: 'projects',
  templates: 'the standup template',
  integrations: 'integrations',
  activity: 'the activity log',
  people: 'people and teams',
  roles: 'roles and access'
}

/**
 * Somebody whose role does not include this part of the app.
 *
 * Not an error and not a dead end: the page says which part, and that an
 * admin is who turns it back on, because the usual next thing that happens
 * is they go and ask.
 */
export default function NoAccess({ module }) {
  return (
    <PageShell className="max-w-xl">
      <Card className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <IconLock className="h-6 w-6" />
        </div>

        <h1 className="text-heading font-semibold text-content">Not part of your role</h1>

        <p className="mt-2 text-sm text-content-muted">
          Your role does not include {LABEL[module] || 'this part of the app'}.
        </p>

        <p className="mt-3 text-sm text-content-subtle">
          An admin can add it under Workspace → Roles &amp; access, or move you to
          a role that already has it.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button to="/dashboard">Back to the dashboard</Button>
          <Button to="/support" variant="outline">
            Ask about it
          </Button>
        </div>
      </Card>
    </PageShell>
  )
}
