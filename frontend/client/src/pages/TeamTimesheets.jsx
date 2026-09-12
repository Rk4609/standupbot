import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { Textarea } from '../components/ui/Field'
import { IconAlert, IconTimer } from '../components/ui/icons'
import { cn } from '../lib/cn'
import { collapseVariants, itemVariants, listVariants } from '../lib/motion'
import { apiErrorMessage } from '../lib/apiError'
import { STATUS_LABEL, STATUS_TONE, shiftWeek } from '../lib/timesheet'
import WeekGrid from '../components/WeekGrid'

export default function TeamTimesheets() {
  const [weekStart, setWeekStart] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')

  const load = (week) =>
    API.get('/timesheets', { params: week ? { weekStart: week } : {} })
      .then(res => {
        setData(res.data)
        setWeekStart(res.data.week.weekStart)
        setError('')
      })
      .catch(err => setError(apiErrorMessage(err, 'Could not load timesheets')))

  useEffect(() => {
    load(weekStart)
  }, [weekStart])

  const open = async (person) => {
    if (openId === person._id) {
      setOpenId(null)
      return
    }

    setOpenId(person._id)
    setDetail(null)
    setNote('')

    try {
      const { data: d } = await API.get(`/timesheets/${person._id}`, {
        params: { weekStart }
      })
      setDetail(d)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not load that week'))
    }
  }

  const review = async (person, action) => {
    if (action === 'request_changes' && !note.trim()) {
      toast.error('Say what needs changing')
      return
    }

    setBusy(person._id + action)
    try {
      await API.patch(`/timesheets/${person._id}`, { weekStart, action, note })
      await load(weekStart)
      setNote('')
      toast.success(
        action === 'approve' ? 'Approved' :
          action === 'reopen' ? 'Reopened' : 'Sent back'
      )
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not save that'))
    } finally {
      setBusy('')
    }
  }

  if (error) {
    return (
      <PageShell width="xl">
        <PageHeader title="Team timesheets" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell width="xl">
        <Skeleton className="mb-2 h-9 w-56" />
        <Skeleton className="mb-7 h-4 w-72" />
        <Skeleton className="h-96 rounded-card" />
      </PageShell>
    )
  }

  return (
    <PageShell width="xl">
      <PageHeader
        title="Team timesheets"
        subtitle={data.week.weekLabel}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="ghost" onClick={() => setWeekStart(shiftWeek(weekStart, -1))}>
              ← Previous
            </Button>
            <Button variant="ghost" onClick={() => setWeekStart(shiftWeek(weekStart, 1))}>
              Next →
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard value={data.totals.hours} label="Hours booked" tone="brand" />
        <StatCard value={data.totals.billable} label="Billable" tone="positive" />
        <StatCard value={data.totals.awaiting} label="Waiting for you" tone="warning" />
        <StatCard value={data.totals.approved} label="Approved" tone="neutral" />
      </div>

      {data.people.length === 0 ? (
        <EmptyState
          icon={<IconTimer className="h-6 w-6" />}
          title="Nobody on this team yet"
        />
      ) : (
        <Card padded={false}>
          <motion.ul
            variants={listVariants}
            initial="initial"
            animate="animate"
            className="divide-y divide-line"
          >
            {data.people.map(person => (
              <motion.li key={person._id} variants={itemVariants}>
                <button
                  type="button"
                  onClick={() => open(person)}
                  aria-expanded={openId === person._id}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 text-left transition-colors hover:bg-surface-sunken md:px-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-content">
                      {person.name}
                    </span>
                    <span className="block truncate text-xs text-content-subtle">
                      {person.daysSubmitted} of 5 days
                    </span>
                  </span>

                  {person.changedSinceSubmit && (
                    <Badge tone="warning">
                      Edited after submitting · was {person.submittedTotal} h
                    </Badge>
                  )}

                  <Badge tone={STATUS_TONE[person.status]}>
                    {STATUS_LABEL[person.status]}
                  </Badge>

                  <span className="tabular w-20 shrink-0 text-right text-sm text-content">
                    {person.totalHours} h
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {openId === person._id && (
                    <motion.div
                      variants={collapseVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="overflow-hidden"
                    >
                      <div className="border-t border-line bg-surface-sunken/40 px-4 py-4 md:px-6">
                        {!detail ? (
                          <Skeleton className="h-40 rounded-card" />
                        ) : (
                          <>
                            {person.changedSinceSubmit && (
                              <div className="mb-4 flex gap-2.5 rounded-xl border-l-2 border-amber-500/70 bg-amber-500/[0.055] py-2.5 pl-3.5 pr-4">
                                <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                <p className="text-sm text-content-muted">
                                  This week was <span className="font-medium text-content">
                                    {person.submittedTotal} hours
                                  </span> when it was submitted and is{' '}
                                  <span className="font-medium text-content">
                                    {person.totalHours}
                                  </span> now.
                                </p>
                              </div>
                            )}

                            <WeekGrid data={detail} />

                            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
                              <div className="min-w-0 flex-1">
                                <Textarea
                                  rows={2}
                                  value={note}
                                  onChange={e => setNote(e.target.value)}
                                  placeholder="Why are you sending it back? (needed to request changes)"
                                  aria-label={`Note for ${person.name}`}
                                  maxLength={500}
                                />
                              </div>

                              <div className={cn('flex shrink-0 flex-wrap gap-2')}>
                                {person.status === 'approved' ? (
                                  <Button
                                    variant="outline"
                                    onClick={() => review(person, 'reopen')}
                                    loading={busy === person._id + 'reopen'}
                                  >
                                    Reopen
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      variant="outline"
                                      onClick={() => review(person, 'request_changes')}
                                      loading={busy === person._id + 'request_changes'}
                                      disabled={person.status === 'draft'}
                                    >
                                      Request changes
                                    </Button>
                                    <Button
                                      onClick={() => review(person, 'approve')}
                                      loading={busy === person._id + 'approve'}
                                      disabled={person.status === 'draft'}
                                    >
                                      Approve
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>

                            {person.status === 'draft' && (
                              <p className="mt-2 text-xs text-content-subtle">
                                Nothing to review until they submit the week.
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            ))}
          </motion.ul>
        </Card>
      )}
    </PageShell>
  )
}
