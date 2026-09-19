import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import PageSizeSelect from '../components/ui/PageSizeSelect'
import ListPager from '../components/ui/ListPager'
import { Field, Input, Select } from '../components/ui/Field'
import { IconAlert, IconPlus, IconUsers } from '../components/ui/icons'
import { cn } from '../lib/cn'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { shortDay } from '../lib/leave'
import { initials } from '../lib/attendance'
import { usePaged } from '../lib/paging'

const OWNER = { hr: 'HR', manager: 'Manager', employee: 'Joiner' }

/** Start a checklist for somebody who joined before these existed. */
function StartForm({ people, onClose }) {
  const navigate = useNavigate()
  const [user, setUser] = useState('')
  const [startsOn, setStartsOn] = useState('')
  const [saving, setSaving] = useState(false)

  const picked = people.find(p => p._id === user)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await API.post('/onboarding', { user, ...(startsOn ? { startsOn } : {}) })
      toast.success(data.message)
      onClose()
      navigate(`/onboarding/${data.onboarding._id}`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not start that'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Start onboarding" subtitle="New hires get a checklist when they are approved." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Person">
          <Select value={user} onChange={e => setUser(e.target.value)}>
            <option value="">Choose somebody</option>
            {people.map(p => (
              <option key={p._id} value={p._id}>
                {p.name}{p.position ? ` · ${p.position}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="First day"
          hint={picked?.joinedOn ? `Leave empty to use their joining date, ${new Date(picked.joinedOn).toLocaleDateString()}.` : 'Leave empty to use today.'}
        >
          <Input type="date" value={startsOn} onChange={e => setStartsOn(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Not now</Button>
          <Button type="submit" loading={saving} disabled={!user}>Start</Button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Everybody in their first weeks: how far along, and what is next.
 */
export default function Onboarding() {
  const live = useLiveRefresh()
  const [status, setStatus] = useState('active')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const paged = usePaged(data?.onboardings, 'onboarding')

  const load = useCallback(() =>
    API.get('/onboarding', { params: { status } })
      .then(res => {
        setData(res.data)
        setError('')
      })
      .catch(err => setError(apiErrorMessage(err, 'Could not load onboarding'))), [status])

  useEffect(() => {
    load()
  }, [load, live])

  if (error && !data) {
    return (
      <PageShell>
        <PageHeader title="Onboarding" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell>
        <Skeleton className="mb-2 h-9 w-48" />
        <Skeleton className="mb-7 h-4 w-72" />
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-44 rounded-card" />)}
        </div>
      </PageShell>
    )
  }

  const start = data.people.length > 0 && (
    <Button onClick={() => setStarting(true)}>
      <IconPlus className="h-4 w-4" />
      Start onboarding
    </Button>
  )

  return (
    <PageShell>
      <PageHeader
        title="Onboarding"
        subtitle={`${data.counts.active} in their first weeks · ${data.counts.complete} finished`}
        actions={start}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1" role="tablist" aria-label="Show">
          {[['active', 'In progress', data.counts.active], ['complete', 'Finished', data.counts.complete]].map(([id, label, n]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={status === id}
              onClick={() => { setStatus(id); paged.setPage(1) }}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs transition-colors',
                status === id
                  ? 'bg-brand-600 font-medium text-white dark:bg-brand-400 dark:text-brand-700'
                  : 'bg-surface-sunken text-content-muted hover:text-content'
              )}
            >
              {label} <span className="tabular opacity-70">{n}</span>
            </button>
          ))}
        </div>
        {paged.total > 10 && <PageSizeSelect value={paged.size} onChange={paged.setSize} />}
      </div>

      {data.onboardings.length === 0 ? (
        <EmptyState
          icon={<IconUsers className="h-6 w-6" />}
          title={status === 'active' ? 'Nobody is onboarding right now' : 'No finished checklists yet'}
          description="Approving a new joiner in Hiring starts their checklist."
          action={status === 'active' ? start : undefined}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {paged.rows.map(item => (
              <Link
                key={item._id}
                to={`/onboarding/${item._id}`}
                className="group block rounded-card border border-line/70 bg-surface/85 p-5 shadow-card transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-400 text-xs font-semibold text-brand-700">
                    {initials(item.userName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-content">{item.userName}</p>
                    <p className="truncate text-xs text-content-subtle">
                      {[item.position, item.team, `joined ${shortDay(item.startsOn)}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {item.progress.overdue > 0 && <Badge tone="danger">{item.progress.overdue} overdue</Badge>}
                  {item.status === 'complete' && <Badge tone="positive">Complete</Badge>}
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-brand-600 transition-[width] duration-500 dark:bg-brand-400"
                      style={{ width: `${item.progress.percent}%` }}
                    />
                  </div>
                  <span className="tabular text-xs text-content-muted">{item.progress.done}/{item.progress.total}</span>
                </div>

                {item.next && (
                  <p className="mt-3 truncate text-xs text-content-muted">
                    <span className={item.next.overdue ? 'text-red-600 dark:text-red-400' : 'text-content-subtle'}>
                      Next · {OWNER[item.next.owner]} · {shortDay(item.next.dueOn)}:
                    </span>{' '}
                    {item.next.title}
                  </p>
                )}
              </Link>
            ))}
          </div>
          <ListPager paged={paged} className="mt-5" />
        </>
      )}

      <AnimatePresence>
        {starting && <StartForm people={data.people} onClose={() => setStarting(false)} />}
      </AnimatePresence>
    </PageShell>
  )
}
