import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import { IconAlert, IconPlus, IconSparkles } from '../components/ui/icons'
import KudosCard from '../components/KudosCard'
import KudosForm from '../components/KudosForm'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { initials } from '../lib/attendance'

/**
 * Thank-yous across the team, newest first, and who has been thanked most
 * this month.
 */
export default function Kudos() {
  const live = useLiveRefresh()
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [giving, setGiving] = useState(false)

  const load = useCallback(() =>
    API.get('/kudos', { params: { page } })
      .then(res => {
        setData(res.data)
        setError('')
      })
      .catch(err => setError(apiErrorMessage(err, 'Could not load kudos'))), [page])

  useEffect(() => {
    load()
  }, [load, live])

  const replace = (updated) =>
    setData(d => ({ ...d, kudos: d.kudos.map(k => (k._id === updated._id ? updated : k)) }))

  if (error && !data) {
    return (
      <PageShell>
        <PageHeader title="Kudos" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell>
        <Skeleton className="mb-2 h-9 w-40" />
        <Skeleton className="mb-7 h-4 w-72" />
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-card" />)}
        </div>
      </PageShell>
    )
  }

  const give = (
    <Button onClick={() => setGiving(true)}>
      <IconPlus className="h-4 w-4" />
      Give kudos
    </Button>
  )

  return (
    <PageShell>
      <PageHeader title="Kudos" subtitle="Thank-yous from around the team." actions={give} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          {data.kudos.length === 0 ? (
            <EmptyState
              icon={<IconSparkles className="h-6 w-6" />}
              title="No kudos yet"
              description="Somebody helped you this week. Say so."
              action={give}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.kudos.map(k => (
                <KudosCard key={k._id} kudos={k} onChange={replace} onRemoved={load} />
              ))}
            </div>
          )}

          {data.totalPages > 1 && (
            <Pagination
              className="mt-4"
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              limit={20}
              onPage={setPage}
            />
          )}
        </div>

        {/* First on a phone, beside the feed on a wide screen */}
        <Card className="order-first h-fit lg:order-none">
          <CardTitle>Most thanked this month</CardTitle>
          {data.top.length === 0 ? (
            <p className="text-sm text-content-subtle">Nobody yet this month.</p>
          ) : (
            <ol className="space-y-3">
              {data.top.map((person, i) => (
                <li key={person._id} className="flex items-center gap-3">
                  <span className="tabular w-4 text-sm text-content-subtle">{i + 1}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-sunken text-xs font-semibold text-content-muted">
                    {initials(person.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-content">{person.name}</span>
                  <span className="tabular text-xs text-content-muted">{person.count} 🙌</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <AnimatePresence>
        {giving && <KudosForm onClose={() => setGiving(false)} onSent={() => (page === 1 ? load() : setPage(1))} />}
      </AnimatePresence>
    </PageShell>
  )
}
