import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import EmptyState from '../components/ui/EmptyState'
import { Field, Input, Select } from '../components/ui/Field'
import { IconAlert, IconPlus } from '../components/ui/icons'
import { MeetingList } from './Reviews'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { REVIEW_STATUS } from '../lib/reviews'

function Schedule({ people, today, onClose }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ employee: people[0]?._id || '', date: today, time: '11:00' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { data } = await API.post('/one-on-ones', form)
      toast.success('1:1 booked — they have been told')
      navigate(`/one-on-ones/${data.oneOnOne._id}`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not book that'))
      setBusy(false)
    }
  }

  return (
    <Modal title="Set up a 1:1" subtitle="Open actions from your last one with them carry over." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="With">
          <Select value={form.employee} onChange={e => set('employee', e.target.value)}>
            {people.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Day"><Input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></Field>
          <Field label="Time"><Input type="time" value={form.time} onChange={e => set('time', e.target.value)} /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Not now</Button>
          <Button type="submit" loading={busy} disabled={!form.employee || !form.date}>Book it</Button>
        </div>
      </form>
    </Modal>
  )
}

function StartRound({ onClose, onStarted }) {
  const year = new Date().getFullYear()
  const [form, setForm] = useState({ name: `H1 ${year}`, from: `${year}-01-01`, to: `${year}-06-30`, dueOn: '' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { data } = await API.post('/reviews/cycles', form)
      toast.success(data.message)
      onStarted(data.cycle._id)
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not start it'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Start a review round" subtitle="Everybody gets a self-review to write, and their manager a review to write for them." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name"><Input value={form.name} maxLength={80} onChange={e => set('name', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Looking back from"><Input type="date" value={form.from} onChange={e => set('from', e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={form.to} onChange={e => set('to', e.target.value)} /></Field>
        </div>
        <Field label="Due by"><Input type="date" value={form.dueOn} onChange={e => set('dueOn', e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Not now</Button>
          <Button type="submit" loading={busy} disabled={form.name.trim().length < 3 || !form.from || !form.to || !form.dueOn}>Start for everybody</Button>
        </div>
      </form>
    </Modal>
  )
}

/** A lead's 1:1s, and the reviews they write this round. */
export default function TeamReviews() {
  const live = useLiveRefresh()
  const [cycleId, setCycleId] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [modal, setModal] = useState('')

  const load = useCallback(() =>
    Promise.all([API.get('/one-on-ones'), API.get('/reviews/cycles', { params: cycleId ? { cycle: cycleId } : {} })])
      .then(([meetings, reviews]) => {
        setData({ ...meetings.data, oneOnOnes: meetings.data.oneOnOnes.filter(m => m.side === 'manager'), round: reviews.data })
        setError('')
      })
      .catch(err => setError(apiErrorMessage(err, 'Could not load this'))), [cycleId])

  useEffect(() => { load() }, [load, live])

  if (error && !data) {
    return <PageShell><PageHeader title="Reviews & 1:1s" /><EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} /></PageShell>
  }
  if (!data) {
    return <PageShell><Skeleton className="mb-7 h-9 w-56" /><Skeleton className="h-96 rounded-card" /></PageShell>
  }

  const { round } = data
  const closeRound = async () => {
    try {
      await API.post(`/reviews/cycles/${round.cycle._id}/close`, {})
      toast.success('Round closed')
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not close it'))
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Reviews & 1:1s"
        subtitle="Regular 1:1s with your people, and their reviews when a round is open."
        actions={
          <>
            {round.canStart && <Button variant="ghost" onClick={() => setModal('round')}>Start a review round</Button>}
            {data.people.length > 0 && <Button onClick={() => setModal('schedule')}><IconPlus className="h-4 w-4" />Set up a 1:1</Button>}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card padded={false}>
          <div className="px-4 pt-4 md:px-6 md:pt-5"><CardTitle>Your 1:1s</CardTitle></div>
          <MeetingList meetings={data.oneOnOnes} nameOf={m => m.employeeName} empty="None yet. A short one every week or two keeps small problems small." />
        </Card>

        <Card padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 md:px-6 md:pt-5">
            <CardTitle className="mb-0">Reviews</CardTitle>
            {round.cycles.length > 1 && (
              <div className="w-40">
                <Select value={round.cycle?._id || ''} onChange={e => setCycleId(e.target.value)} aria-label="Review round" className="py-2 text-sm">
                  {round.cycles.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </Select>
              </div>
            )}
          </div>
          {!round.cycle ? (
            <p className="px-4 py-5 text-sm text-content-subtle md:px-6">
              No review round yet.{round.canStart ? ' Start one to ask everybody for a self-review.' : ' An admin starts one.'}
            </p>
          ) : (
            <>
              <p className="px-4 pb-3 pt-2 text-xs text-content-muted md:px-6">
                {round.cycle.status === 'closed' ? 'Closed · ' : `Due ${round.cycle.dueOn} · `}
                {round.progress.shared} of {round.progress.total} shared · {round.progress.self} self-reviews still to come
                {round.canStart && round.cycle.status === 'open' && (
                  <button type="button" onClick={closeRound} className="ml-2 underline underline-offset-2">Close round</button>
                )}
              </p>
              {round.reviews.length === 0
                ? <p className="px-4 pb-5 text-sm text-content-subtle md:px-6">Nobody for you to review in this round.</p>
                : (
                  <ul className="divide-y divide-line border-t border-line">
                    {round.reviews.map(r => (
                      <li key={r._id}>
                        <Link to={`/reviews/${r._id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-sunken/60 md:px-6">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-content">{r.employeeName}</p>
                            <p className="text-xs text-content-subtle">
                              {r.team?.name || 'No team'}{r.manager?.overall ? ` · overall ${r.manager.overall}/5` : ''}
                            </p>
                          </div>
                          <Badge tone={REVIEW_STATUS[r.status].tone}>{REVIEW_STATUS[r.status].label}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
            </>
          )}
        </Card>
      </div>

      <AnimatePresence>
        {modal === 'schedule' && <Schedule people={data.people} today={data.today} onClose={() => setModal('')} />}
        {modal === 'round' && <StartRound onClose={() => setModal('')} onStarted={setCycleId} />}
      </AnimatePresence>
    </PageShell>
  )
}
