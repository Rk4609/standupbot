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
import PageSizeSelect from '../components/ui/PageSizeSelect'
import ListPager from '../components/ui/ListPager'
import { Field, Input, Select } from '../components/ui/Field'
import { IconAlert, IconPlus, IconPrinter } from '../components/ui/icons'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { usePaged } from '../lib/paging'
import { LETTER_STATUS, LETTER_TYPE, letterDate } from '../lib/letters'

function AskForm({ types, onClose, onSaved }) {
  const [form, setForm] = useState({ type: 'employment', purpose: '', addressedTo: '' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await API.post('/letters/request', {
        type: form.type,
        ...(form.purpose.trim() ? { purpose: form.purpose.trim() } : {}),
        ...(form.addressedTo.trim() ? { addressedTo: form.addressedTo.trim() } : {})
      })
      toast.success('Sent to HR — you will be told when it is ready')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not send that'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Ask for a letter" subtitle="HR issues it with your details as they are on record." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Which letter" hint={LETTER_TYPE[form.type].hint}>
          <Select value={form.type} onChange={e => set('type', e.target.value)}>
            {types.map(t => <option key={t} value={t}>{LETTER_TYPE[t].label}</option>)}
          </Select>
        </Field>
        <Field label="What it is for" hint="Optional — it is written into the letter, e.g. “a home loan application”">
          <Input value={form.purpose} maxLength={200} onChange={e => set('purpose', e.target.value)} />
        </Field>
        <Field label="Addressed to" hint="Optional — otherwise “To whomsoever it may concern”">
          <Input value={form.addressedTo} maxLength={200} onChange={e => set('addressedTo', e.target.value)} placeholder="The Branch Manager, HDFC Bank" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Not now</Button>
          <Button type="submit" loading={busy}>Send to HR</Button>
        </div>
      </form>
    </Modal>
  )
}

/** My HR letters: the ones issued, and the ones I have asked for. */
export default function Documents() {
  const live = useLiveRefresh()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [asking, setAsking] = useState(false)
  const paged = usePaged(data?.letters, 'my-letters')

  const load = useCallback(() =>
    API.get('/letters/mine')
      .then(res => { setData(res.data); setError('') })
      .catch(err => setError(apiErrorMessage(err, 'Could not load your documents'))), [])

  useEffect(() => { load() }, [load, live])

  const cancel = async (letter) => {
    try {
      await API.post(`/letters/${letter._id}/cancel`, {})
      toast.success('Request cancelled')
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not cancel that'))
    }
  }

  if (error && !data) {
    return <PageShell><PageHeader title="Documents" /><EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} /></PageShell>
  }
  if (!data) {
    return <PageShell><Skeleton className="mb-7 h-9 w-48" /><Skeleton className="h-72 rounded-card" /></PageShell>
  }

  const askButton = <Button onClick={() => setAsking(true)}><IconPlus className="h-4 w-4" />Ask for a letter</Button>

  return (
    <PageShell>
      <PageHeader
        title="Documents"
        subtitle="Letters from HR, ready to download as a PDF."
        actions={<>{paged.total > 10 && <PageSizeSelect value={paged.size} onChange={paged.setSize} />}{askButton}</>}
      />

      <Card padded={false}>
        {data.letters.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<IconPrinter className="h-6 w-6" />} title="No letters yet" description="Need proof of employment for a bank, a visa or a rental? Ask HR for it here." action={askButton} />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {paged.rows.map(letter => (
              <li key={letter._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 md:px-6">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-content">{LETTER_TYPE[letter.type].label}</p>
                  <p className="mt-0.5 text-xs text-content-muted">
                    {letter.status === 'issued'
                      ? `${letter.number} · ${letterDate(letter.issuedOn)}`
                      : letter.purpose ? `For ${letter.purpose}` : 'Asked for'}
                  </p>
                  {letter.status === 'declined' && letter.note && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{letter.note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={LETTER_STATUS[letter.status].tone}>{LETTER_STATUS[letter.status].label}</Badge>
                  {letter.status === 'issued' && <Button size="xs" variant="ghost" to={`/letters/${letter._id}`}>Open</Button>}
                  {letter.status === 'requested' && <Button size="xs" variant="quiet-danger" onClick={() => cancel(letter)}>Cancel</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <ListPager paged={paged} />
      </Card>
      <p className="mt-4 text-xs text-content-subtle">
        Every letter carries a verification code printed at the bottom, so a bank or a next employer can confirm it is genuine.
      </p>

      <AnimatePresence>
        {asking && <AskForm types={data.types} onClose={() => setAsking(false)} onSaved={load} />}
      </AnimatePresence>
    </PageShell>
  )
}
