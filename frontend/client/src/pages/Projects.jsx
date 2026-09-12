import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { Checkbox, Field, Input } from '../components/ui/Field'
import { IconAlert, IconBriefcase, IconPlus } from '../components/ui/icons'
import { cn } from '../lib/cn'
import { DURATION, EASE } from '../lib/motion'
import { apiErrorMessage } from '../lib/apiError'

const blank = { name: '', code: '', client: '', billable: true }

export default function Projects() {
  const [projects, setProjects] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState(blank)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = () =>
    API.get('/projects/all')
      .then(res => setProjects(res.data))
      .catch(err => setError(apiErrorMessage(err, 'Could not load projects')))

  useEffect(() => {
    load()
  }, [])

  const create = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await API.post('/projects', {
        name: form.name.trim(),
        code: form.code.trim(),
        client: form.client.trim(),
        billable: form.billable
      })
      setForm(blank)
      setAdding(false)
      await load()
      toast.success('Project added')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not add that project'))
    } finally {
      setSaving(false)
    }
  }

  const setActive = async (project, active) => {
    try {
      await API.patch(`/projects/${project._id}`, { active })
      await load()
      toast.success(active ? 'Project reopened' : 'Project archived')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not save that'))
    }
  }

  if (error) {
    return (
      <PageShell width="md">
        <PageHeader title="Projects" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (!projects) {
    return (
      <PageShell width="md">
        <Skeleton className="mb-2 h-9 w-40" />
        <Skeleton className="mb-7 h-4 w-72" />
        <Skeleton className="h-80 rounded-card" />
      </PageShell>
    )
  }

  const open = projects.filter(p => p.active)
  const archived = projects.filter(p => !p.active)

  return (
    <PageShell width="md">
      <PageHeader
        title="Projects"
        subtitle="What your team books its hours against."
        actions={
          <Button onClick={() => setAdding(v => !v)} variant={adding ? 'ghost' : 'solid'}>
            {adding ? 'Cancel' : (
              <>
                <IconPlus className="h-4 w-4" />
                New project
              </>
            )}
          </Button>
        }
      />

      <AnimatePresence initial={false}>
        {adding && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: DURATION.fast, ease: EASE }}
            className="mb-4"
          >
            <Card>
              <CardTitle>New project</CardTitle>
              <form onSubmit={create} className="space-y-4">
                <Field label="Name">
                  <Input
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Acme rebuild"
                    maxLength={120}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Client" hint="Who it is for. Leave empty for internal work.">
                    <Input
                      value={form.client}
                      onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
                      placeholder="Acme Ltd"
                      maxLength={120}
                    />
                  </Field>
                  <Field label="Short code" hint="Shown in the timesheet grid.">
                    <Input
                      value={form.code}
                      onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                      placeholder="ACME"
                      maxLength={12}
                    />
                  </Field>
                </div>

                <Checkbox
                  label="Billable"
                  checked={form.billable}
                  onChange={e => setForm(f => ({ ...f, billable: e.target.checked }))}
                />

                <Button type="submit" loading={saving} disabled={!form.name.trim()}>
                  Add project
                </Button>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {projects.length === 0 ? (
        <EmptyState
          icon={<IconBriefcase className="h-6 w-6" />}
          title="No projects yet"
          description="Add one, and your team can start booking hours against it in their standup."
        />
      ) : (
        <>
          <ProjectList title="Open" projects={open} onArchive={p => setActive(p, false)} />
          {archived.length > 0 && (
            <ProjectList
              title="Archived"
              projects={archived}
              onReopen={p => setActive(p, true)}
              muted
            />
          )}
        </>
      )}
    </PageShell>
  )
}

function ProjectList({ title, projects, onArchive, onReopen, muted }) {
  if (projects.length === 0) return null

  return (
    <Card padded={false} className={cn('mb-4', muted && 'opacity-75')}>
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <CardTitle className="mb-0">{title}</CardTitle>
        <span className="text-xs text-content-subtle">{projects.length}</span>
      </div>

      <ul className="divide-y divide-line border-t border-line">
        {projects.map(p => (
          <li key={p._id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-content">
                {p.code && (
                  <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] text-content-subtle">
                    {p.code}
                  </code>
                )}
                {p.name}
                {!p.billable && <Badge tone="neutral">Non-billable</Badge>}
                {!p.team && <Badge tone="neutral">Shared</Badge>}
              </p>
              <p className="mt-0.5 text-xs text-content-subtle">
                {p.client || 'Internal'}
                {p.team?.name ? ` · ${p.team.name}` : ''}
              </p>
            </div>

            <div className="tabular shrink-0 text-right text-sm text-content-muted">
              {p.hours > 0 ? `${p.hours} h` : '—'}
            </div>

            <div className="shrink-0">
              {onArchive && (
                <button
                  type="button"
                  onClick={() => onArchive(p)}
                  className="rounded-md px-2 py-1 text-xs text-content-subtle transition-colors hover:bg-surface-sunken hover:text-content"
                >
                  Archive
                </button>
              )}
              {onReopen && (
                <button
                  type="button"
                  onClick={() => onReopen(p)}
                  className="rounded-md px-2 py-1 text-xs text-content-subtle transition-colors hover:bg-surface-sunken hover:text-content"
                >
                  Reopen
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
