import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import ExportButton from '../components/ExportButton'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import { Field, Select, Textarea } from '../components/ui/Field'
import { IconAlert, IconCalendar, IconCheck, IconClose } from '../components/ui/icons'
import LeaveCalendar from '../components/LeaveCalendar'
import { cn } from '../lib/cn'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import {
  STATUS_LABEL, STATUS_TONE, TYPE_DOT, TYPE_LABEL, dayRange, dayWord, shortDay
} from '../lib/leave'

/**
 * Time off waiting on me, and who is away.
 *
 * Each request shows what the person has left of that kind, and the calendar
 * beside it shows who else is off, so a yes is not given blind.
 */
export default function LeaveApprovals() {
  const live = useLiveRefresh()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [note, setNote] = useState('')
  const [changes, setChanges] = useState(0)

  const load = useCallback(() => {
    const params = { page }
    if (status) params.status = status
    return API.get('/leave/team', { params })
      .then(res => {
        setData(res.data)
        setError('')
      })
      .catch(err => setError(apiErrorMessage(err, 'Could not load leave requests')))
  }, [page, status])

  useEffect(() => {
    load()
  }, [load, live])

  const changed = () => {
    load()
    setChanges(n => n + 1)
  }

  const approve = async (leave) => {
    setBusy(leave._id)
    try {
      const { data: res } = await API.post(`/leave/${leave._id}/approve`, {})
      toast.success(res.message)
      changed()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not approve that'))
    } finally {
      setBusy(null)
    }
  }

  const reject = async (e) => {
    e.preventDefault()
    setBusy(rejecting._id)
    try {
      const { data: res } = await API.post(`/leave/${rejecting._id}/reject`, { note: note.trim() })
      toast.success(res.message)
      setRejecting(null)
      setNote('')
      changed()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not reject that'))
    } finally {
      setBusy(null)
    }
  }

  if (error && !data) {
    return (
      <PageShell>
        <PageHeader title="Leave approvals" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell>
        <Skeleton className="mb-2 h-9 w-56" />
        <Skeleton className="mb-7 h-4 w-80" />
        <Skeleton className="mb-5 h-20 rounded-card" />
        <Skeleton className="h-80 rounded-card" />
      </PageShell>
    )
  }

  const waiting = data.pendingCount || 0

  return (
    <PageShell>
      <PageHeader
        title="Leave approvals"
        subtitle={
          waiting > 0
            ? `${waiting} ${waiting === 1 ? 'request is' : 'requests are'} waiting on you.`
            : 'Nothing is waiting on you.'
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <ExportButton path="/exports/leave" params={{ year: data.today.slice(0, 4) }} label="Export requests" fallbackName="leave-requests.csv" />
            <ExportButton path="/exports/leave" params={{ year: data.today.slice(0, 4), view: 'balances' }} label="Export balances" fallbackName="leave-balances.csv" />
          </div>
        }
      />

      <Card className="mb-5">
        <p className="eyebrow">Away today</p>
        {data.away.length === 0 ? (
          <p className="mt-2 text-sm text-content-muted">Everybody is in today.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.away.map(person => (
              <li
                key={person._id}
                className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-content"
              >
                <span className={cn('h-2 w-2 rounded-full', TYPE_DOT[person.type])} />
                {person.userName}
                <span className="text-xs text-content-subtle">
                  {person.halfDay ? 'half day' : `back after ${shortDay(person.to)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,26rem)]">
        <Card padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
            <CardTitle className="mb-0">Requests</CardTitle>
            <div className="w-40">
              <Select
                value={status}
                onChange={e => {
                  setStatus(e.target.value)
                  setPage(1)
                }}
                aria-label="Filter by status"
                className="py-2 text-sm"
              >
                <option value="">All of them</option>
                {data.statuses.map(s => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </Select>
            </div>
          </div>

          {data.requests.length === 0 ? (
            <div className="px-4 pb-6 md:px-6">
              <EmptyState
                icon={<IconCalendar className="h-6 w-6" />}
                title={status === 'pending' ? 'Nothing waiting' : 'No requests here'}
                description="When somebody on your team asks for time off, it lands here."
              />
            </div>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {data.requests.map(leave => (
                <li key={leave._id} className="px-4 py-4 md:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-medium text-content">{leave.userName}</span>
                        {leave.team?.name && (
                          <span className="text-xs text-content-subtle">{leave.team.name}</span>
                        )}
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-content">
                        <span className={cn('h-2 w-2 rounded-full', TYPE_DOT[leave.type])} />
                        {dayRange(leave.from, leave.to)}
                        <span className="text-xs text-content-subtle">
                          {TYPE_LABEL[leave.type]} · {leave.halfDay ? 'half day' : dayWord(leave.days)}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-content-muted">{leave.reason}</p>
                      {leave.balance?.allowance !== null && leave.balance && (
                        <p className="mt-1 text-[11px] text-content-subtle">
                          {dayWord(leave.balance.used)} used · {dayWord(leave.balance.remaining)} left of {leave.balance.allowance}
                        </p>
                      )}
                      {leave.status !== 'pending' && leave.decidedByName && (
                        <p className="mt-1 text-[11px] text-content-subtle">
                          {STATUS_LABEL[leave.status]} by {leave.decidedByName}{leave.note ? ` · ${leave.note}` : ''}
                        </p>
                      )}
                    </div>

                    {leave.canDecide ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="quiet-danger"
                          disabled={busy === leave._id}
                          onClick={() => { setRejecting(leave); setNote('') }}
                        >
                          <IconClose className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                        <Button size="sm" loading={busy === leave._id} onClick={() => approve(leave)}>
                          <IconCheck className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                      </div>
                    ) : (
                      <Badge tone={STATUS_TONE[leave.status]}>{STATUS_LABEL[leave.status]}</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {data.totalPages > 1 && (
            <div className="border-t border-line px-4 py-3 md:px-6">
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                limit={data.limit}
                onPage={setPage}
              />
            </div>
          )}
        </Card>

        <LeaveCalendar title="Team calendar" refreshKey={changes} />
      </div>

      <AnimatePresence>
        {rejecting && (
          <Modal
            title={`Reject ${rejecting.userName}'s leave`}
            subtitle={`${dayRange(rejecting.from, rejecting.to)} · ${TYPE_LABEL[rejecting.type]}`}
            onClose={() => setRejecting(null)}
          >
            <form onSubmit={reject} className="space-y-4">
              <Field label="Why" hint="They will see this, so they can plan around it.">
                <Textarea
                  rows={3}
                  maxLength={500}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Release week — could you move it to the week after?"
                />
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setRejecting(null)}>Not now</Button>
                <Button
                  type="submit"
                  variant="danger"
                  loading={busy === rejecting._id}
                  disabled={note.trim().length < 3}
                >
                  Reject
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </PageShell>
  )
}
