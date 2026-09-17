import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { IconAlert, IconCalendar, IconPlus } from '../components/ui/icons'
import LeaveForm from '../components/LeaveForm'
import LeaveCalendar from '../components/LeaveCalendar'
import { cn } from '../lib/cn'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import {
  STATUS_LABEL, STATUS_TONE, TYPE_DOT, TYPE_LABEL, dayRange, dayWord
} from '../lib/leave'

/** What is left of one kind, as a number and a bar. */
function BalanceCard({ item }) {
  const unlimited = item.allowance === null
  const taken = item.used + item.pending
  const share = unlimited ? 0 : Math.min(100, (taken / item.allowance) * 100)
  const usedShare = unlimited ? 0 : Math.min(100, (item.used / item.allowance) * 100)

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center gap-2 text-xs text-content-muted">
        <span className={cn('h-2 w-2 rounded-full', TYPE_DOT[item.type])} />
        {TYPE_LABEL[item.type]}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="tabular text-3xl font-light tracking-tight text-content">
          {unlimited ? item.used : item.remaining}
        </span>
        <span className="text-xs text-content-subtle">
          {unlimited ? 'taken' : `of ${item.allowance} left`}
        </span>
      </div>

      {!unlimited && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
          <div className="relative h-full" style={{ width: `${share}%` }}>
            <div className="absolute inset-0 rounded-full bg-brand-300 dark:bg-brand-400/40" />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-brand-600 dark:bg-brand-400"
              style={{ width: share ? `${(usedShare / share) * 100}%` : 0 }}
            />
          </div>
        </div>
      )}

      <p className="mt-2 text-[11px] text-content-subtle">
        {item.pending > 0 ? `${item.pending} waiting · ` : ''}
        {unlimited ? 'No limit' : `${item.used} used`}
      </p>
    </Card>
  )
}

/**
 * My time off: what is left, what I asked for, and who else is away.
 */
export default function Leave() {
  const live = useLiveRefresh()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [asking, setAsking] = useState(false)
  const [cancelling, setCancelling] = useState(null)
  const [changes, setChanges] = useState(0)

  const load = useCallback(() =>
    API.get('/leave/mine')
      .then(res => {
        setData(res.data)
        setError('')
      })
      .catch(err => setError(apiErrorMessage(err, 'Could not load your leave'))), [])

  useEffect(() => {
    load()
  }, [load, live])

  const changed = () => {
    load()
    setChanges(n => n + 1)
  }

  const cancel = async (leave) => {
    setCancelling(leave._id)
    try {
      const { data: res } = await API.post(`/leave/${leave._id}/cancel`, {})
      toast.success(res.message)
      changed()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not cancel that'))
    } finally {
      setCancelling(null)
    }
  }

  if (error && !data) {
    return (
      <PageShell>
        <PageHeader title="Leave" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell>
        <Skeleton className="mb-2 h-9 w-40" />
        <Skeleton className="mb-7 h-4 w-72" />
        <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-card" />)}
        </div>
        <Skeleton className="h-80 rounded-card" />
      </PageShell>
    )
  }

  const ask = (
    <Button onClick={() => setAsking(true)}>
      <IconPlus className="h-4 w-4" />
      Ask for leave
    </Button>
  )

  return (
    <PageShell>
      <PageHeader
        title="Leave"
        subtitle={`Your time off in ${data.year}. Weekends are never counted.`}
        actions={ask}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {data.balance.map(item => <BalanceCard key={item.type} item={item} />)}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,26rem)]">
        <Card padded={false}>
          <div className="px-4 pt-4 md:px-6 md:pt-5">
            <CardTitle className="mb-0">Your requests</CardTitle>
          </div>

          {data.requests.length === 0 ? (
            <div className="px-4 py-6 md:px-6">
              <EmptyState
                icon={<IconCalendar className="h-6 w-6" />}
                title="No leave asked for this year"
                description="Ask for a day off and your manager is told straight away."
                action={ask}
              />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {data.requests.map(leave => {
                const upcoming = leave.from > data.today
                const canCancel = leave.status === 'pending' || (leave.status === 'approved' && upcoming)

                return (
                  <li key={leave._id} className="flex flex-wrap items-start gap-3 px-4 py-3.5 md:px-6">
                    <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', TYPE_DOT[leave.type])} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-medium text-content">
                          {dayRange(leave.from, leave.to)}
                        </span>
                        <span className="text-xs text-content-subtle">
                          {TYPE_LABEL[leave.type]} · {leave.halfDay ? 'half day' : dayWord(leave.days)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-content-muted">{leave.reason}</p>
                      {leave.status === 'rejected' && leave.note && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {leave.decidedByName}: {leave.note}
                        </p>
                      )}
                      {leave.status === 'approved' && leave.decidedByName && (
                        <p className="mt-1 text-xs text-content-subtle">
                          Approved by {leave.decidedByName}{leave.note ? ` · ${leave.note}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={STATUS_TONE[leave.status]}>{STATUS_LABEL[leave.status]}</Badge>
                      {canCancel && (
                        <Button
                          size="xs"
                          variant="quiet-danger"
                          loading={cancelling === leave._id}
                          onClick={() => cancel(leave)}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <LeaveCalendar title="Who is away" refreshKey={changes} />
      </div>

      <AnimatePresence>
        {asking && (
          <LeaveForm
            balance={data.balance}
            today={data.today}
            onClose={() => setAsking(false)}
            onSaved={changed}
          />
        )}
      </AnimatePresence>
    </PageShell>
  )
}
