import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { IconAlert, IconCheck } from '../components/ui/icons'
import { itemVariants, listVariants } from '../lib/motion'
import { apiErrorMessage } from '../lib/apiError'
import { STATUS_LABEL, STATUS_TONE, shiftWeek } from '../lib/timesheet'
import WeekGrid from '../components/WeekGrid'

export default function Timesheet() {
  const [weekStart, setWeekStart] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = (week) =>
    API.get('/timesheets/me', { params: week ? { weekStart: week } : {} })
      .then(res => {
        setData(res.data)
        setWeekStart(res.data.week.weekStart)
        setError('')
      })
      .catch(err => setError(apiErrorMessage(err, 'Could not load your timesheet')))

  useEffect(() => {
    // weekStart is set from the response, so this runs once per chosen week
    load(weekStart)
  }, [weekStart])

  const submit = async () => {
    setSaving(true)
    try {
      await API.post('/timesheets/submit', { weekStart })
      await load(weekStart)
      toast.success('Sent to your manager')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not submit this week'))
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <PageShell>
        <PageHeader title="My timesheet" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell>
        <Skeleton className="mb-2 h-9 w-48" />
        <Skeleton className="mb-7 h-4 w-72" />
        <Skeleton className="h-72 rounded-card" />
      </PageShell>
    )
  }

  const locked = data.status === 'approved'
  const canSubmit = data.totalHours > 0 && !locked

  return (
    <PageShell>
      <PageHeader
        title="My timesheet"
        subtitle={data.week.weekLabel}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" onClick={() => setWeekStart(shiftWeek(weekStart, -1))}>
                ← Previous
              </Button>
              <Button variant="ghost" onClick={() => setWeekStart(shiftWeek(weekStart, 1))}>
                Next →
              </Button>
            </div>
            <Button onClick={submit} loading={saving} disabled={!canSubmit}>
              {data.status === 'submitted' ? 'Resubmit' : 'Submit for approval'}
            </Button>
          </div>
        }
      />

      <motion.div variants={listVariants} initial="initial" animate="animate">
        <motion.div variants={itemVariants} className="mb-4 flex flex-wrap items-center gap-3">
          <Badge tone={STATUS_TONE[data.status]}>
            {data.status === 'approved' && <IconCheck className="h-3 w-3" />}
            {STATUS_LABEL[data.status]}
          </Badge>

          <span className="tabular text-sm text-content-muted">
            <span className="font-semibold text-content">{data.totalHours}</span> hours
            {data.billableHours !== data.totalHours && ` · ${data.billableHours} billable`}
          </span>

          <span className="text-sm text-content-subtle">
            {data.daysSubmitted} of 5 days filled in
          </span>
        </motion.div>

        {data.note && data.status === 'changes_requested' && (
          <motion.div variants={itemVariants} className="mb-4">
            <div className="flex gap-2.5 rounded-xl border-l-2 border-amber-500/70 bg-amber-500/[0.055] py-3 pl-3.5 pr-4">
              <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-medium text-content">
                  {data.reviewedBy || 'Your manager'} asked for changes
                </p>
                <p className="mt-0.5 text-sm text-content-muted">{data.note}</p>
              </div>
            </div>
          </motion.div>
        )}

        {locked && (
          <motion.div variants={itemVariants} className="mb-4">
            <p className="text-sm text-content-subtle">
              This week is approved. Ask your manager to reopen it if something needs
              changing.
            </p>
          </motion.div>
        )}

        <motion.div variants={itemVariants}>
          <WeekGrid data={data} />
        </motion.div>

        <motion.div variants={itemVariants} className="mt-4">
          <Card>
            <CardTitle>Where these come from</CardTitle>
            <p className="text-sm text-content-muted">
              Hours are entered with your daily standup, not here. That keeps one record
              of the day rather than two that can disagree — fill in your standup and this
              week fills itself.
            </p>
          </Card>
        </motion.div>
      </motion.div>
    </PageShell>
  )
}
