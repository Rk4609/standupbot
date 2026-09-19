import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import { IconAlert, IconClose } from '../components/ui/icons'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { meetingWhen } from '../lib/reviews'

/** Talking points or actions: tick, add, take back. */
function Items({ meeting, kind, title, empty, onChange }) {
  const [text, setText] = useState('')
  const [owner, setOwner] = useState('employee')
  const items = meeting.items.filter(i => i.kind === kind)
  const names = { manager: meeting.managerName, employee: meeting.employeeName }

  const call = async (request) => {
    try {
      const { data } = await request
      onChange(data.oneOnOne)
      return true
    } catch (err) {
      toast.error(apiErrorMessage(err, 'That did not go through'))
      return false
    }
  }

  const add = async (e) => {
    e.preventDefault()
    const body = { kind, text: text.trim(), ...(kind === 'action' ? { owner: meeting.side === 'manager' ? owner : 'employee' } : {}) }
    if (await call(API.post(`/one-on-ones/${meeting._id}/items`, body))) setText('')
  }

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {items.length === 0 ? <p className="text-sm text-content-subtle">{empty}</p> : (
        <ul className="space-y-1">
          {items.map(item => (
            <li key={item._id} className="group flex items-start gap-3 rounded-xl px-1 py-1.5">
              <input
                type="checkbox"
                aria-label={item.text}
                checked={item.done}
                onChange={e => call(API.patch(`/one-on-ones/${meeting._id}/items/${item._id}`, { done: e.target.checked }))}
                className="mt-0.5 h-4 w-4 accent-brand-600"
              />
              <div className="min-w-0 flex-1">
                <p className={item.done ? 'text-sm text-content-subtle line-through' : 'text-sm text-content'}>{item.text}</p>
                <p className="text-xs text-content-subtle">
                  {kind === 'action' ? `${names[item.owner] || names[item.by]} to do` : `from ${names[item.by]}`}
                  {item.carried ? ' · carried from last time' : ''}
                </p>
              </div>
              {(item.by === meeting.side || meeting.side === 'manager') && (
                <button
                  type="button"
                  aria-label={`Remove ${item.text}`}
                  onClick={() => call(API.delete(`/one-on-ones/${meeting._id}/items/${item._id}`))}
                  className="rounded-full p-1 text-content-subtle opacity-60 hover:bg-surface-sunken hover:opacity-100"
                >
                  <IconClose className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-4 flex flex-wrap gap-2">
        <div className="min-w-0 flex-1">
          <Input value={text} maxLength={300} onChange={e => setText(e.target.value)} placeholder={kind === 'point' ? 'Something to talk about' : 'Something to do'} aria-label={`New ${kind === 'point' ? 'talking point' : 'action'}`} />
        </div>
        {kind === 'action' && meeting.side === 'manager' && (
          <div className="w-36">
            <Select value={owner} onChange={e => setOwner(e.target.value)} aria-label="Who does it">
              <option value="employee">{meeting.employeeName}</option>
              <option value="manager">Me</option>
            </Select>
          </div>
        )}
        <Button type="submit" variant="ghost" disabled={text.trim().length < 2}>Add</Button>
      </form>
    </Card>
  )
}

/** The notes: the manager writes, the employee reads the shared part. */
function Notes({ meeting, onChange }) {
  const [notes, setNotes] = useState(meeting.notes)
  const [privateNote, setPrivateNote] = useState(meeting.privateNote || '')
  const [busy, setBusy] = useState(false)

  if (meeting.side !== 'manager') {
    return (
      <Card>
        <CardTitle>Notes</CardTitle>
        <p className="whitespace-pre-line text-sm text-content">{meeting.notes || <span className="text-content-subtle">Your manager has not written any notes yet.</span>}</p>
      </Card>
    )
  }

  const save = async () => {
    setBusy(true)
    try {
      const { data } = await API.patch(`/one-on-ones/${meeting._id}`, { notes, privateNote })
      onChange(data.oneOnOne)
      toast.success('Notes saved')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not save the notes'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardTitle>Notes</CardTitle>
      <div className="space-y-4">
        <Field label="Shared notes" hint={`${meeting.employeeName} can read these`}>
          <Textarea rows={5} maxLength={4000} value={notes} onChange={e => setNotes(e.target.value)} />
        </Field>
        <Field label="Private note" hint="Only you see this">
          <Textarea rows={2} maxLength={2000} value={privateNote} onChange={e => setPrivateNote(e.target.value)} />
        </Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" loading={busy} onClick={save}>Save notes</Button>
      </div>
    </Card>
  )
}

export default function OneOnOneDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const live = useLiveRefresh()
  const [meeting, setMeeting] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() =>
    API.get(`/one-on-ones/${id}`)
      .then(res => { setMeeting(res.data.oneOnOne); setError('') })
      .catch(err => setError(apiErrorMessage(err, 'Could not load that 1:1'))), [id])

  useEffect(() => { load() }, [load, live])

  if (error && !meeting) {
    return <PageShell><PageHeader title="1:1" /><EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} /></PageShell>
  }
  if (!meeting) {
    return <PageShell><Skeleton className="mb-7 h-9 w-56" /><Skeleton className="h-96 rounded-card" /></PageShell>
  }

  const manager = meeting.side === 'manager'
  const other = manager ? meeting.employeeName : meeting.managerName
  const done = meeting.status === 'done'

  const setDone = async (value) => {
    try {
      const { data } = await API.patch(`/one-on-ones/${meeting._id}`, { done: value })
      setMeeting(data.oneOnOne)
      toast.success(value ? 'Marked as held' : 'Opened again')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'That did not go through'))
    }
  }
  const callOff = async () => {
    try {
      await API.delete(`/one-on-ones/${meeting._id}`)
      toast.success('1:1 called off')
      navigate('/team-reviews')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not call it off'))
    }
  }

  return (
    <PageShell>
      <PageHeader
        title={`1:1 with ${other}`}
        subtitle={meetingWhen(meeting.date, meeting.time)}
        actions={
          <>
            <Badge tone={done ? 'positive' : 'info'}>{done ? 'Held' : 'Coming up'}</Badge>
            {manager && !done && <Button size="sm" variant="quiet-danger" onClick={callOff}>Call off</Button>}
            {manager && <Button size="sm" variant={done ? 'ghost' : 'primary'} onClick={() => setDone(!done)}>{done ? 'Open again' : 'Mark as held'}</Button>}
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Items meeting={meeting} kind="point" title="To talk about" empty="Nothing yet — add what is on your mind." onChange={setMeeting} />
        <Items meeting={meeting} kind="action" title="Agreed actions" empty="Nothing agreed yet." onChange={setMeeting} />
        <div className="lg:col-span-2"><Notes key={meeting._id} meeting={meeting} onChange={setMeeting} /></div>
      </div>
    </PageShell>
  )
}
