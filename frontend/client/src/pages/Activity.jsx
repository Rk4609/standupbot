import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import Skeleton from '../components/ui/Skeleton'
import Pagination from '../components/ui/Pagination'
import { Select } from '../components/ui/Field'
import { IconAlert, IconList, IconPencil, IconShield, IconTrash } from '../components/ui/icons'
import { cn } from '../lib/cn'
import { itemVariants, listVariants } from '../lib/motion'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'

const ACTION_META = {
  'standup.updated': { label: 'Standup edited', icon: IconPencil, tone: 'neutral' },
  'standup.deleted': { label: 'Standup deleted', icon: IconTrash, tone: 'danger' },
  'user.role_changed': { label: 'Role changed', icon: IconShield, tone: 'warning' }
}

const FIELD_LABEL = {
  yesterday: 'Accomplished yesterday',
  today: "Today's plan",
  blockers: 'Blockers',
  mood: 'Mood',
  role: 'Role'
}

const when = (iso) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

/** One before/after pair. Long text wraps; a one-word value stays on the line. */
function Change({ change }) {
  const short = change.from.length + change.to.length < 60

  return (
    <div className={cn('text-xs', short && 'flex flex-wrap items-baseline gap-x-2')}>
      <span className="font-medium text-content-muted">
        {FIELD_LABEL[change.field] || change.field}
      </span>
      <span className={cn(!short && 'mt-1 block')}>
        <span className="whitespace-pre-line text-content-subtle line-through decoration-red-400/60">
          {change.from || '(empty)'}
        </span>
        <span className="mx-1.5 text-content-subtle" aria-hidden="true">→</span>
        <span className="whitespace-pre-line text-content">{change.to || '(empty)'}</span>
      </span>
    </div>
  )
}

function Entry({ entry }) {
  const meta = ACTION_META[entry.action] || {
    label: entry.action,
    icon: IconList,
    tone: 'neutral'
  }
  const Icon = meta.icon

  return (
    <motion.li
      variants={itemVariants}
      className="flex gap-3 px-4 py-4 md:px-6"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-content-muted">
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <span className="tabular text-xs text-content-subtle">{when(entry.createdAt)}</span>
        </div>

        <p className="mt-1.5 text-sm text-content">
          <span className="font-medium">{entry.actorName || 'Someone'}</span>
          {entry.subjectName && entry.subjectName !== entry.actorName && (
            <>
              {' → '}
              <span className="font-medium">{entry.subjectName}</span>
            </>
          )}
          {entry.note && (
            <span className="text-content-subtle"> · {entry.note}</span>
          )}
        </p>

        {entry.changes.length > 0 && (
          <div className="mt-2 space-y-1.5 border-l-2 border-line pl-3">
            {entry.changes.map(c => (
              <Change key={c.field} change={c} />
            ))}
          </div>
        )}
      </div>
    </motion.li>
  )
}

export default function Activity() {
  // Reload in place when something new may have happened — see liveRefresh
  const live = useLiveRefresh()
  const [query, setQuery] = useState({ page: 1, limit: 20, action: '' })
  const [loaded, setLoaded] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    API.get('/audit', { params: { ...query, action: query.action || undefined } })
      .then(res => {
        if (cancelled) return
        setLoaded({ data: res.data, query })
        setError('')
      })
      .catch(err => {
        if (cancelled) return
        setError(apiErrorMessage(err, 'Could not load activity'))
        setLoaded(prev => prev ?? { data: null, query })
      })

    return () => {
      cancelled = true
    }
  }, [query, live])

  const data = loaded?.data
  const loading = loaded === null || loaded.query !== query

  if (loading && !data) {
    return (
      <PageShell>
        <Skeleton className="mb-2 h-9 w-44" />
        <Skeleton className="mb-7 h-4 w-80" />
        <Skeleton className="h-96 rounded-card" />
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell>
        <PageHeader title="Activity" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Activity"
        subtitle="Every edit to a standup and every role change, with what moved."
        actions={
          <div className="w-52">
            <Select
              value={query.action}
              onChange={e => setQuery(q => ({ ...q, action: e.target.value, page: 1 }))}
              aria-label="Filter by action"
              className="py-2 text-sm"
            >
              <option value="">All activity</option>
              {data.actions.map(a => (
                <option key={a} value={a}>
                  {ACTION_META[a]?.label || a}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      <div className={cn('transition-opacity', loading && 'opacity-60')}>
        {data.entries.length === 0 ? (
          <EmptyState
            icon={<IconList className="h-6 w-6" />}
            title="Nothing recorded yet"
            description="Edits to standups and role changes will appear here as they happen."
          />
        ) : (
          <Card padded={false}>
            <motion.ul
              variants={listVariants}
              initial="initial"
              animate="animate"
              className="divide-y divide-line"
            >
              {data.entries.map(entry => (
                <Entry key={entry._id} entry={entry} />
              ))}
            </motion.ul>
          </Card>
        )}

        <Pagination
          className="mt-4"
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          limit={data.limit}
          onPage={page => setQuery(q => ({ ...q, page }))}
        />
      </div>
    </PageShell>
  )
}
