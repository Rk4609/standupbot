import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Skeleton from '../components/ui/Skeleton'
import StatCard from '../components/ui/StatCard'
import EmptyState from '../components/ui/EmptyState'
import PageSizeSelect from '../components/ui/PageSizeSelect'
import ListPager from '../components/ui/ListPager'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import { IconAlert, IconPlus } from '../components/ui/icons'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { usePaged } from '../lib/paging'
import { money } from '../lib/money'
import { shortDay } from '../lib/leave'
import { CATEGORY_LABEL, EXPENSE_STATUS } from '../lib/expenses'

/** A new claim: what, how much, when, and the bill. */
function ClaimForm({ categories, today, onClose, onSaved }) {
  const [form, setForm] = useState({ category: 'travel', amount: '', spentOn: today, description: '' })
  const [receipt, setReceipt] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const upload = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const body = new FormData()
      body.append('receipt', file)
      const { data } = await API.post('/expenses/receipt', body)
      setReceipt(data)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'The receipt could not be uploaded'))
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await API.post('/expenses', {
        ...form,
        amount: Number(form.amount),
        description: form.description.trim(),
        ...(receipt ? { receipt } : {})
      })
      toast.success('Claim sent to your manager')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not send that'))
    } finally {
      setSaving(false)
    }
  }

  const ready = Number(form.amount) >= 1 && form.spentOn && form.description.trim().length >= 3 && !uploading

  return (
    <Modal title="Claim an expense" subtitle="Approved claims are paid with your next payslip." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="What for">
            <Select value={form.category} onChange={e => set('category', e.target.value)}>
              {categories.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </Select>
          </Field>
          <Field label="Amount (₹)">
            <Input type="number" min="1" inputMode="decimal" value={form.amount} onChange={e => set('amount', e.target.value)} />
          </Field>
        </div>
        <Field label="Spent on">
          <Input type="date" max={today} value={form.spentOn} onChange={e => set('spentOn', e.target.value)} />
        </Field>
        <Field label="Details">
          <Textarea rows={2} maxLength={300} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Cab to the client office and back" />
        </Field>
        <Field label="Receipt" hint={uploading ? 'Uploading…' : receipt ? `Attached: ${receipt.name}` : 'A photo or PDF of the bill — optional, but it helps it get approved'}>
          <Input type="file" accept="image/*,application/pdf" onChange={e => upload(e.target.files?.[0])} className="py-2 text-sm" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Not now</Button>
          <Button type="submit" loading={saving} disabled={!ready}>Send claim</Button>
        </div>
      </form>
    </Modal>
  )
}

/** My expense claims and where each one is. */
export default function Expenses() {
  const live = useLiveRefresh()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [claiming, setClaiming] = useState(false)
  const paged = usePaged(data?.expenses, 'my-expenses')

  const load = useCallback(() =>
    API.get('/expenses/mine')
      .then(res => { setData(res.data); setError('') })
      .catch(err => setError(apiErrorMessage(err, 'Could not load your claims'))), [])

  useEffect(() => { load() }, [load, live])

  const cancel = async (item) => {
    try {
      await API.post(`/expenses/${item._id}/cancel`, {})
      toast.success('Claim cancelled')
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not cancel that'))
    }
  }

  if (error && !data) {
    return <PageShell><PageHeader title="Expenses" /><EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} /></PageShell>
  }
  if (!data) {
    return <PageShell><Skeleton className="mb-7 h-9 w-48" /><Skeleton className="h-80 rounded-card" /></PageShell>
  }

  const claimButton = <Button onClick={() => setClaiming(true)}><IconPlus className="h-4 w-4" />Claim an expense</Button>

  return (
    <PageShell>
      <PageHeader title="Expenses" subtitle="Money you spent for work, paid back with your salary." actions={claimButton} />

      <div className="mb-5 grid grid-cols-3 gap-3 md:gap-4">
        <StatCard value={money(data.totals.waiting)} label="Waiting" tone="warning" />
        <StatCard value={money(data.totals.approved)} label="Coming with next payslip" tone="brand" />
        <StatCard value={money(data.totals.paid)} label="Paid back" tone="positive" />
      </div>

      <Card padded={false}>
        <div className="flex items-center justify-between gap-3 px-4 pt-4 md:px-6 md:pt-5">
          <CardTitle className="mb-0">Your claims</CardTitle>
          {paged.total > 10 && <PageSizeSelect value={paged.size} onChange={paged.setSize} />}
        </div>
        {data.expenses.length === 0 ? (
          <div className="px-4 py-6 md:px-6">
            <EmptyState icon={<IconPlus className="h-6 w-6" />} title="No claims yet" description="Paid for a cab, a meal or a cable for work? Claim it back." action={claimButton} />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {paged.rows.map(item => (
              <li key={item._id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 md:px-6">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-content">
                    {money(item.amount)} <span className="font-normal text-content-subtle">· {CATEGORY_LABEL[item.category]} · {shortDay(item.spentOn)}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-content-muted">{item.description}</p>
                  {item.receipt?.url && (
                    <a href={item.receipt.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-content-muted underline underline-offset-2">Receipt</a>
                  )}
                  {item.status === 'rejected' && item.note && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{item.decidedByName}: {item.note}</p>
                  )}
                  {item.status === 'paid' && <p className="mt-1 text-xs text-content-subtle">Paid with the {item.paidMonth} payslip</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={EXPENSE_STATUS[item.status].tone}>{EXPENSE_STATUS[item.status].label}</Badge>
                  {item.status === 'pending' && <Button size="xs" variant="quiet-danger" onClick={() => cancel(item)}>Cancel</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <ListPager paged={paged} />
      </Card>

      <AnimatePresence>
        {claiming && <ClaimForm categories={data.categories} today={data.today} onClose={() => setClaiming(false)} onSaved={load} />}
      </AnimatePresence>
    </PageShell>
  )
}
