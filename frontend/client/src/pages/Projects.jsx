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
import { Checkbox, Field, Input, Select } from '../components/ui/Field'
import { IconAlert, IconBriefcase, IconCalendar, IconPlus, IconUsers } from '../components/ui/icons'
import ProjectMembers from '../components/ProjectMembers'
import ProjectActivity from '../components/ProjectActivity'
import { cn } from '../lib/cn'
import { collapseVariants, DURATION, EASE, SPRING } from '../lib/motion'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'

const blank = { name: '', code: '', client: '', billable: true }

/** The value the picker uses for "every team can book to this". */
const SHARED = '__shared__'

const TABS = [
  { id: 'projects', label: 'Projects', icon: IconBriefcase },
  { id: 'today', label: 'Who is on what', icon: IconCalendar }
]

export default function Projects() {
  // Reload in place when something new may have happened — see liveRefresh
  const live = useLiveRefresh()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState(blank)
  const [team, setTeam] = useState(null)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('projects')
  const [openId, setOpenId] = useState(null)

  const load = () =>
    API.get('/projects/all')
      .then(res => {
        setData(res.data)
        // Default to the team this person runs, not to "shared" — a project
        // with a client's name on it belongs to a team
        setTeam(t => t ?? (res.data.defaultTeam || SHARED))
      })
      .catch(err => setError(apiErrorMessage(err, 'Could not load projects')))

  useEffect(() => {
    load()
  }, [live])

  const create = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await API.post('/projects', {
        name: form.name.trim(),
        code: form.code.trim(),
        client: form.client.trim(),
        billable: form.billable,
        // Only sent when there is a choice to make. null means shared.
        ...(data.canShare ? { team: team === SHARED ? null : team } : {})
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
      <PageShell>
        <PageHeader title="Projects" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell>
        <Skeleton className="mb-2 h-9 w-40" />
        <Skeleton className="mb-7 h-4 w-72" />
        <Skeleton className="h-80 rounded-card" />
      </PageShell>
    )
  }

  const open = data.projects.filter(p => p.active)
  const archived = data.projects.filter(p => !p.active)

  return (
    <PageShell>
      <PageHeader
        title="Projects"
        subtitle="Who works on what, and what your team books its hours against."
        actions={
          tab === 'projects' && (
            <Button onClick={() => setAdding(v => !v)} variant={adding ? 'ghost' : 'solid'}>
              {adding ? 'Cancel' : (
                <>
                  <IconPlus className="h-4 w-4" />
                  New project
                </>
              )}
            </Button>
          )
        }
      />

      {/* A segmented control, not two buttons — these switch a view */}
      <div
        role="tablist"
        aria-label="Projects view"
        className="mb-4 inline-flex rounded-xl bg-surface-sunken p-1"
      >
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'relative rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              tab === t.id ? 'text-content' : 'text-content-muted hover:text-content'
            )}
          >
            {tab === t.id && (
              <motion.span
                layoutId="projects-tab"
                transition={SPRING}
                className="absolute inset-0 rounded-lg bg-surface shadow-card"
              />
            )}
            <span className="relative flex items-center gap-1.5">
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </span>
          </button>
        ))}
      </div>

      {tab === 'today' ? <ProjectActivity /> : <>

      <AnimatePresence initial={false}>
        {adding && (
          <Card
            // On the Card itself, not on a wrapper around it. Card carries
            // `variants` and takes its labels from the nearest motion parent;
            // a wrapper animating to plain objects gives it no label to
            // resolve, so it sits at its own initial state — invisible — and
            // only when it mounts on demand, which is why the list of cards
            // above looks fine.
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: DURATION.fast, ease: EASE }}
            className="mb-4"
          >
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

              {data.canShare && (
                <Field
                  label="Who books to it"
                  hint="Shared projects appear for every team — that is for internal work, not for a client."
                >
                  <Select value={team || SHARED} onChange={e => setTeam(e.target.value)}>
                    {data.teams.map(t => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                    <option value={SHARED}>Shared — every team</option>
                  </Select>
                </Field>
              )}

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
        )}
      </AnimatePresence>

      {data.projects.length === 0 ? (
        <EmptyState
          icon={<IconBriefcase className="h-6 w-6" />}
          title="No projects yet"
          description="Add one, and your team can start booking hours against it in their standup."
        />
      ) : (
        <>
          <ProjectList
            title="Open"
            projects={open}
            onArchive={p => setActive(p, false)}
            assignable={data.assignable || []}
            allProjects={data.projects}
            openId={openId}
            onToggle={id => setOpenId(openId === id ? null : id)}
            onChanged={load}
          />
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
      </>}
    </PageShell>
  )
}

function ProjectList({
  title, projects, onArchive, onReopen, muted,
  assignable = [], allProjects = [], openId, onToggle, onChanged
}) {
  if (projects.length === 0) return null

  return (
    <Card padded={false} className={cn('mb-4', muted && 'opacity-75')}>
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <CardTitle className="mb-0">{title}</CardTitle>
        <span className="text-xs text-content-subtle">{projects.length}</span>
      </div>

      <ul className="divide-y divide-line border-t border-line">
        {projects.map(p => {
          const open = openId === p._id
          const named = p.members?.length || 0

          return (
            <li key={p._id}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => onToggle?.(p._id)}
                  aria-expanded={open}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-content">
                    {p.code && (
                      <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] text-content-subtle">
                        {p.code}
                      </code>
                    )}
                    {p.name}
                    {!p.billable && <Badge tone="neutral">Non-billable</Badge>}
                    {!p.team && <Badge tone="neutral">Shared</Badge>}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-content-subtle">
                    <IconUsers className="h-3 w-3" />
                    {named > 0
                      ? `${named} ${named === 1 ? 'person' : 'people'}`
                      : 'Open to the team'}
                    <span aria-hidden="true">·</span>
                    {p.client || 'Internal'}
                    {p.team?.name ? ` · ${p.team.name}` : ''}
                  </span>
                </button>

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
              </div>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    variants={collapseVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="overflow-hidden"
                  >
                    <div className="border-t border-line bg-surface-sunken/40 px-5 py-4">
                      <ProjectMembers
                        project={p}
                        assignable={assignable}
                        projects={allProjects}
                        onChanged={onChanged}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
