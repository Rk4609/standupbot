import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import { IconAlert, IconPlus, IconPrinter } from '../components/ui/icons'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { usePageSize } from '../lib/paging'
import { LETTER_STATUS, LETTER_TYPE, NEEDS_LAST_DAY, letterDate } from '../lib/letters'

/** Issue a letter: straight to somebody, or in answer to what they asked for. */
function IssueForm({ request, types, onClose }) {
  const navigate = useNavigate()
  const [people, setPeople] = useState(null)
  const [form, setForm] = useState({ user: '', type: request?.type || 'employment', purpose: '', addressedTo: '', lastDay: '' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const type = request?.type || form.type

  useEffect(() => {
    if (request) return
    API.get('/letters/people').then(res => {
      setPeople(res.data.people)
      setForm(f => ({ ...f, user: res.data.people[0]?._id || '' }))
    }).catch(() => setPeople([]))
  }, [request])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const lastDay = NEEDS_LAST_DAY.includes(type) ? { lastDay: form.lastDay } : {}
    try {
      const { data } = request
        ? await API.post(`/letters/${request._id}/issue`, lastDay)
        : await API.post('/letters', {
          user: form.user,
          type,
          ...(form.purpose.trim() ? { purpose: form.purpose.trim() } : {}),
          ...(form.addressedTo.trim() ? { addressedTo: form.addressedTo.trim() } : {}),
          ...lastDay
        })
      toast.success(data.message)
      navigate(`/letters/${data.letter._id}`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not issue it'))
      setBusy(false)
    }
  }

  const ready = (request || form.user) && (!NEEDS_LAST_DAY.includes(type) || form.lastDay)

  return (
    <Modal
      title={request ? `Issue ${request.userName}'s letter` : 'Issue a letter'}
      subtitle="Written from their record and your company details, numbered, and sent to them."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        {request ? (
          <p className="text-sm text-content-muted">
            {LETTER_TYPE[request.type].label}{request.purpose ? ` · for ${request.purpose}` : ''}{request.addressedTo ? ` · to ${request.addressedTo}` : ''}
          </p>
        ) : (
          <>
            <Field label="For">
              <Select value={form.user} onChange={e => set('user', e.target.value)} disabled={!people}>
                {(people || []).map(p => <option key={p._id} value={p._id}>{p.name}{p.position ? ` — ${p.position}` : ''}</option>)}
              </Select>
            </Field>
            <Field label="Letter" hint={LETTER_TYPE[form.type].hint}>
              <Select value={form.type} onChange={e => set('type', e.target.value)}>
                {types.map(t => <option key={t} value={t}>{LETTER_TYPE[t].label}</option>)}
              </Select>
            </Field>
            <Field label="What it is for" hint="Optional">
              <Input value={form.purpose} maxLength={200} onChange={e => set('purpose', e.target.value)} />
            </Field>
            <Field label="Addressed to" hint="Optional">
              <Input value={form.addressedTo} maxLength={200} onChange={e => set('addressedTo', e.target.value)} />
            </Field>
          </>
        )}
        {NEEDS_LAST_DAY.includes(type) && (
          <Field label="Last working day">
            <Input type="date" value={form.lastDay} onChange={e => set('lastDay', e.target.value)} />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Not now</Button>
          <Button type="submit" loading={busy} disabled={!ready}>Issue letter</Button>
        </div>
      </form>
    </Modal>
  )
}

/** HR's desk: requests waiting, and every letter issued. */
export default function Letters() {
  const live = useLiveRefresh()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [size, setSize] = usePageSize('letters')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [issuing, setIssuing] = useState(null)
  const [declining, setDeclining] = useState(null)
  const [note, setNote] = useState('')

  const load = useCallback(() =>
    API.get('/letters', { params: { page, limit: size, ...(status ? { status } : {}) } })
      .then(res => { setData(res.data); setError('') })
      .catch(err => setError(apiErrorMessage(err, 'Could not load letters'))), [page, size, status])

  useEffect(() => { load() }, [load, live])

  const decline = async (e) => {
    e.preventDefault()
    try {
      const { data: res } = await API.post(`/letters/${declining._id}/decline`, { note: note.trim() })
      toast.success(res.message)
      setDeclining(null)
      setNote('')
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not decline it'))
    }
  }

  if (error && !data) {
    return <PageShell><PageHeader title="Letters" /><EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} /></PageShell>
  }
  if (!data) {
    return <PageShell><Skeleton className="mb-7 h-9 w-48" /><Skeleton className="h-80 rounded-card" /></PageShell>
  }

  const types = data.types.filter(t => t !== 'salary' || data.canSalary)

  return (
    <PageShell>
      <PageHeader
        title="Letters"
        subtitle={data.waiting ? `${data.waiting} request${data.waiting === 1 ? '' : 's'} waiting` : 'Employment, salary, experience and relieving letters.'}
        actions={
          <>
            {data.total > 10 && <PageSizeSelect value={size} onChange={n => { setSize(n); setPage(1) }} />}
            <div className="w-36">
              <Select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} aria-label="Filter by status" className="py-2 text-sm">
                <option value="">All of them</option>
                <option value="requested">Waiting</option>
                <option value="issued">Issued</option>
                <option value="declined">Declined</option>
              </Select>
            </div>
            <Button onClick={() => setIssuing('new')}><IconPlus className="h-4 w-4" />Issue a letter</Button>
          </>
        }
      />

      <Card padded={false}>
        {data.letters.length === 0 ? (
          <div className="p-6"><EmptyState icon={<IconPrinter className="h-6 w-6" />} title="No letters here" description="Requests from employees show up here, and so does every letter issued." /></div>
        ) : (
          <ul className="divide-y divide-line">
            {data.letters.map(letter => (
              <li key={letter._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 md:px-6">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-content"><span className="font-medium">{letter.userName}</span> · {LETTER_TYPE[letter.type].label}</p>
                  <p className="mt-0.5 text-xs text-content-muted">
                    {letter.status === 'issued'
                      ? `${letter.number} · ${letterDate(letter.issuedOn)} · by ${letter.issuedByName}`
                      : [letter.purpose && `For ${letter.purpose}`, letter.addressedTo && `to ${letter.addressedTo}`].filter(Boolean).join(' ') || 'No purpose given'}
                  </p>
                </div>
                {letter.status === 'requested' && (letter.type !== 'salary' || data.canSalary) ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="quiet-danger" onClick={() => { setDeclining(letter); setNote('') }}>Decline</Button>
                    <Button size="sm" onClick={() => setIssuing(letter)}>Issue</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge tone={LETTER_STATUS[letter.status].tone}>{LETTER_STATUS[letter.status].label}</Badge>
                    {letter.status === 'issued' && <Button size="xs" variant="ghost" to={`/letters/${letter._id}`}>Open</Button>}
                  </div>
                )}
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
        {issuing && <IssueForm request={issuing === 'new' ? null : issuing} types={types} onClose={() => setIssuing(null)} />}
        {declining && (
          <Modal title={`Decline ${declining.userName}'s request`} subtitle={LETTER_TYPE[declining.type].label} onClose={() => setDeclining(null)}>
            <form onSubmit={decline} className="space-y-4">
              <Field label="Why" hint="They will see this">
                <Textarea rows={3} maxLength={300} value={note} onChange={e => setNote(e.target.value)} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setDeclining(null)}>Not now</Button>
                <Button type="submit" variant="danger" disabled={note.trim().length < 3}>Decline</Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </PageShell>
  )
}
