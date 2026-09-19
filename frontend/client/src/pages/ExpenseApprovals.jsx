import { useCallback, useEffect, useState } from 'react'
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
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import PageSizeSelect from '../components/ui/PageSizeSelect'
import { Field, Select, Textarea } from '../components/ui/Field'
import { IconAlert, IconCheck, IconClose, IconInbox } from '../components/ui/icons'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { money } from '../lib/money'
import { shortDay } from '../lib/leave'
import { CATEGORY_LABEL, EXPENSE_STATUS } from '../lib/expenses'
import { usePageSize } from '../lib/paging'

/** Claims from my team, waiting first. */
export default function ExpenseApprovals() {
  const live = useLiveRefresh()
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const [size, setSize] = usePageSize('expense-approvals')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [note, setNote] = useState('')

  const load = useCallback(() => {
    const params = { page, limit: size, ...(status ? { status } : {}) }
    return API.get('/expenses/team', { params })
      .then(res => { setData(res.data); setError('') })
      .catch(err => setError(apiErrorMessage(err, 'Could not load claims')))
  }, [page, size, status])

  useEffect(() => { load() }, [load, live])

  const act = async (item, verdict, body = {}) => {
    setBusy(item._id)
    try {
      const { data: res } = await API.post(`/expenses/${item._id}/${verdict}`, body)
      toast.success(res.message)
      setRejecting(null)
      setNote('')
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'That did not go through'))
    } finally {
      setBusy(null)
    }
  }

  if (error && !data) {
    return <PageShell><PageHeader title="Expense approvals" /><EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} /></PageShell>
  }
  if (!data) {
    return <PageShell><Skeleton className="mb-7 h-9 w-56" /><Skeleton className="h-80 rounded-card" /></PageShell>
  }

  return (
    <PageShell>
      <PageHeader
        title="Expense approvals"
        subtitle={data.pending.count ? `${data.pending.count} waiting · ${money(data.pending.amount)}` : 'Nothing is waiting on you.'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data.total > 10 && <PageSizeSelect value={size} onChange={n => { setSize(n); setPage(1) }} />}
            <div className="w-40">
              <Select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} aria-label="Filter by status" className="py-2 text-sm">
                <option value="">All of them</option>
                {data.statuses.map(s => <option key={s} value={s}>{EXPENSE_STATUS[s].label}</option>)}
              </Select>
            </div>
          </div>
        }
      />

      <Card padded={false}>
        {data.expenses.length === 0 ? (
          <div className="p-6"><EmptyState icon={<IconInbox className="h-6 w-6" />} title="No claims here" /></div>
        ) : (
          <ul className="divide-y divide-line">
            {data.expenses.map(item => (
              <li key={item._id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 md:px-6">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-content">
                    <span className="font-medium">{item.userName}</span>
                    <span className="text-content-subtle">{item.team?.name ? ` · ${item.team.name}` : ''}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-content">
                    {money(item.amount)} <span className="text-xs text-content-subtle">{CATEGORY_LABEL[item.category]} · {shortDay(item.spentOn)}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-content-muted">{item.description}</p>
                  {item.receipt?.url
                    ? <a href={item.receipt.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-content-muted underline underline-offset-2">View receipt</a>
                    : <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">No receipt attached</p>}
                </div>
                {item.canDecide ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="quiet-danger" disabled={busy === item._id} onClick={() => { setRejecting(item); setNote('') }}>
                      <IconClose className="h-3.5 w-3.5" />Reject
                    </Button>
                    <Button size="sm" loading={busy === item._id} onClick={() => act(item, 'approve')}>
                      <IconCheck className="h-3.5 w-3.5" />Approve
                    </Button>
                  </div>
                ) : <Badge tone={EXPENSE_STATUS[item.status].tone}>{EXPENSE_STATUS[item.status].label}</Badge>}
              </li>
            ))}
          </ul>
        )}
        {data.totalPages > 1 && (
          <div className="border-t border-line px-4 py-3 md:px-6">
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit || size} onPage={setPage} />
          </div>
        )}
      </Card>

      <AnimatePresence>
        {rejecting && (
          <Modal title={`Reject ${rejecting.userName}'s claim`} subtitle={`${money(rejecting.amount)} · ${rejecting.description}`} onClose={() => setRejecting(null)}>
            <form onSubmit={e => { e.preventDefault(); act(rejecting, 'reject', { note: note.trim() }) }} className="space-y-4">
              <Field label="Why" hint="They paid for it, so they will want to know.">
                <Textarea rows={3} maxLength={300} value={note} onChange={e => setNote(e.target.value)} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setRejecting(null)}>Not now</Button>
                <Button type="submit" variant="danger" loading={busy === rejecting._id} disabled={note.trim().length < 3}>Reject</Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </PageShell>
  )
}
