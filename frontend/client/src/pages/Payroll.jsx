import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Skeleton from '../components/ui/Skeleton'
import StatCard from '../components/ui/StatCard'
import EmptyState from '../components/ui/EmptyState'
import { Input } from '../components/ui/Field'
import { IconAlert, IconCheck, IconRefresh, IconSearch, IconUsers } from '../components/ui/icons'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { money, monthLabel } from '../lib/money'

const shiftMonth = (month, by) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7)
}

const STATUS = {
  draft: { label: 'Draft', tone: 'warning' },
  published: { label: 'Published', tone: 'positive' }
}

/** Big figures as "₹12.4L" on a card; the table has the exact ones. */
const compact = (amount) =>
  amount >= 100_000
    ? `₹${(amount / 100_000).toFixed(amount >= 10_000_000 ? 0 : 1)}L`
    : money(amount)

/**
 * A month's payroll: work the slips out as drafts, check them, publish.
 *
 * Nothing reaches anybody until it is published, and a published slip is
 * never redone — a second run only refreshes drafts, so a correction made
 * after somebody has read their slip is a conversation, not a silent edit.
 */
export default function Payroll() {
  const live = useLiveRefresh()
  const [month, setMonth] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(() =>
    API.get('/payslips/run', { params: month ? { month } : {} })
      .then(res => {
        setData(res.data)
        setError('')
      })
      .catch(err => setError(apiErrorMessage(err, 'Could not load payroll'))), [month])

  useEffect(() => {
    load()
  }, [load, live])

  const act = async (path, label) => {
    setBusy(path)
    try {
      const { data: res } = await API.post(`/payslips/${path}`, { month: data.month })
      toast.success(res.message)
      setConfirming(false)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, `Could not ${label}`))
    } finally {
      setBusy('')
    }
  }

  if (error && !data) {
    return (
      <PageShell>
        <PageHeader title="Payroll" />
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
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-card" />)}
        </div>
        <Skeleton className="h-96 rounded-card" />
      </PageShell>
    )
  }

  const { counts, totals } = data
  const thisMonth = data.today.slice(0, 7)
  const query = search.trim().toLowerCase()
  const rows = data.rows.filter(r => !query || r.user.name.toLowerCase().includes(query))

  return (
    <PageShell>
      <PageHeader
        title="Payroll"
        subtitle={`${monthLabel(data.month)} · ${counts.published} published · ${counts.drafts} drafts · ${counts.notRun} not run`}
        actions={
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth(shiftMonth(data.month, -1))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-content-muted hover:text-content"
            >
              ‹
            </button>
            <Input
              type="month"
              aria-label="Month"
              value={data.month}
              max={thisMonth}
              onChange={e => e.target.value && setMonth(e.target.value)}
              className="w-40 py-2 text-sm"
            />
            <button
              type="button"
              aria-label="Next month"
              disabled={data.month >= thisMonth}
              onClick={() => setMonth(shiftMonth(data.month, 1))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-content-muted hover:text-content disabled:opacity-40"
            >
              ›
            </button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard value={counts.people} label="People paid" tone="neutral" />
        <StatCard value={compact(totals.gross)} label="Gross" tone="brand" />
        <StatCard value={compact(totals.deductions)} label="Deductions" tone="warning" />
        <StatCard value={compact(totals.net)} label="Net payout" tone="positive" />
      </div>

      <Card className="mb-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-content">
              {counts.notRun === counts.people
                ? 'Not run yet for this month'
                : counts.drafts > 0
                  ? `${counts.drafts} drafts waiting to be checked and published`
                  : 'Everything for this month is published'}
            </p>
            <p className="mt-1 text-xs text-content-subtle">
              Loss of pay comes from approved unpaid leave and absences in attendance.
              {data.month === thisMonth && ' This month is still running, so absences are counted up to yesterday.'}
            </p>
            {counts.withoutSalary > 0 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                {counts.withoutSalary} {counts.withoutSalary === 1 ? 'person has' : 'people have'} no salary on record and {counts.withoutSalary === 1 ? 'is' : 'are'} left out —{' '}
                <Link to="/workspace/records" className="underline underline-offset-2">add it in People records</Link>.
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant={counts.drafts > 0 ? 'outline' : 'primary'}
              loading={busy === 'run'}
              disabled={data.isFuture || counts.people === 0 || counts.published === counts.people}
              onClick={() => act('run', 'generate payslips')}
            >
              <IconRefresh className="h-4 w-4" />
              {counts.drafts > 0 ? 'Work out again' : 'Generate payslips'}
            </Button>
            {counts.drafts > 0 && (
              <Button onClick={() => setConfirming(true)}>
                <IconCheck className="h-4 w-4" />
                Publish {counts.drafts}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card padded={false}>
        <div className="flex items-center justify-between gap-3 px-4 py-4 md:px-6">
          <p className="text-sm font-semibold text-content">People</p>
          <Input
            icon={IconSearch}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search people"
            aria-label="Search people"
            className="w-44 py-2 text-sm md:w-56"
          />
        </div>

        {rows.length === 0 ? (
          <div className="px-4 pb-6 md:px-6">
            <EmptyState
              icon={<IconUsers className="h-6 w-6" />}
              title={data.rows.length === 0 ? 'Nobody has a salary on record' : 'Nobody by that name'}
              description={data.rows.length === 0 ? 'Add salaries in People records, then run payroll.' : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-content-subtle">
                  <th className="px-4 py-2.5 font-medium md:px-6">Person</th>
                  <th className="px-3 py-2.5 text-right font-medium">Monthly</th>
                  <th className="px-3 py-2.5 text-right font-medium">LOP days</th>
                  <th className="px-3 py-2.5 text-right font-medium">Net pay</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 md:px-6"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(row => {
                  const figures = row.slip || row.preview
                  return (
                    <tr key={row.user._id}>
                      <td className="px-4 py-3 md:px-6">
                        <p className="font-medium text-content">{row.user.name}</p>
                        <p className="text-xs text-content-subtle">
                          {[row.user.position, row.user.team].filter(Boolean).join(' · ')}
                        </p>
                      </td>
                      <td className="tabular px-3 py-3 text-right text-content-muted">{money(row.monthly, row.currency)}</td>
                      <td className="tabular px-3 py-3 text-right text-content-muted">{figures.lossOfPayDays || '—'}</td>
                      <td className="tabular px-3 py-3 text-right font-medium text-content">
                        {money(figures.net, row.currency)}
                        {!row.slip && <span className="block text-[10px] font-normal text-content-subtle">estimate</span>}
                      </td>
                      <td className="px-3 py-3">
                        {row.slip
                          ? <Badge tone={STATUS[row.slip.status].tone}>{STATUS[row.slip.status].label}</Badge>
                          : <Badge>Not run</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right md:px-6">
                        {row.slip && (
                          <Button size="xs" variant="outline" to={`/payslips/${row.slip._id}`}>View</Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AnimatePresence>
        {confirming && (
          <Modal
            title={`Publish ${counts.drafts} payslips?`}
            subtitle={monthLabel(data.month)}
            onClose={() => setConfirming(false)}
          >
            <p className="text-sm text-content-muted">
              Everybody gets a notification and can open their slip straight away.
              A published slip is not worked out again, so check the drafts first.
            </p>
            <p className="mt-3 text-sm text-content">
              Net payout: <span className="tabular font-semibold">{money(totals.net)}</span>
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirming(false)}>Not yet</Button>
              <Button loading={busy === 'publish'} onClick={() => act('publish', 'publish')}>
                Publish
              </Button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </PageShell>
  )
}
