import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { Checkbox, Field, Input, Select, Textarea } from '../components/ui/Field'
import { IconAlert, IconInbox, IconTrash } from '../components/ui/icons'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { prettyDate } from '../lib/dates'

const blank = { title: '', body: '', important: false, team: '' }

/** Post a notice, and see who has read the ones already out. */
export default function Announcements() {
  const live = useLiveRefresh()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() =>
    API.get('/announcements')
      .then(res => { setData(res.data); setError('') })
      .catch(err => setError(apiErrorMessage(err, 'Could not load announcements'))), [])

  useEffect(() => { load() }, [load, live])

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await API.post('/announcements', {
        title: form.title.trim(),
        body: form.body.trim(),
        important: form.important,
        ...(data.postTo === 'any' ? { team: form.team || null } : {})
      })
      toast.success('Announcement sent')
      setForm(blank)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not send that'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (item) => {
    try {
      await API.delete(`/announcements/${item._id}`)
      toast.success('Announcement removed')
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not remove that'))
    }
  }

  if (error && !data) {
    return (
      <PageShell>
        <PageHeader title="Announcements" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell>
        <Skeleton className="mb-7 h-9 w-56" />
        <Skeleton className="h-72 rounded-card" />
      </PageShell>
    )
  }

  const audience = data.postTo === 'any'
    ? (form.team ? data.teams.find(t => t._id === form.team)?.name : 'everybody')
    : data.postTo?.name

  return (
    <PageShell>
      <PageHeader title="Announcements" subtitle="Notices stay on everybody's dashboard until they have read them." />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {data.canPost && (
          <Card className="h-fit">
            <CardTitle>New announcement</CardTitle>
            <form onSubmit={submit} className="space-y-4">
              {data.postTo === 'any' && (
                <Field label="To">
                  <Select value={form.team} onChange={e => set('team', e.target.value)}>
                    <option value="">Everybody</option>
                    {data.teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                  </Select>
                </Field>
              )}
              <Field label="Title">
                <Input value={form.title} maxLength={120} onChange={e => set('title', e.target.value)} placeholder="Office closed on Friday" />
              </Field>
              <Field label="Message" hint={`${form.body.length}/2000`}>
                <Textarea rows={5} maxLength={2000} value={form.body} onChange={e => set('body', e.target.value)} />
              </Field>
              <Checkbox label="Important — shown in red, first" checked={form.important} onChange={e => set('important', e.target.checked)} />
              <Button type="submit" full loading={saving} disabled={form.title.trim().length < 3 || form.body.trim().length < 3}>
                Send to {audience}
              </Button>
            </form>
          </Card>
        )}

        <div className="space-y-3">
          {data.announcements.length === 0 ? (
            <EmptyState icon={<IconInbox className="h-6 w-6" />} title="No announcements yet" />
          ) : data.announcements.map(item => (
            <Card key={item._id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.important && <Badge tone="danger">Important</Badge>}
                    <Badge>{item.team ? item.team.name : 'Everybody'}</Badge>
                    {item.readCount !== undefined && (
                      <Badge tone="positive">Read by {Math.max(0, item.readCount - 1)} of {item.audienceCount}</Badge>
                    )}
                  </div>
                  <h2 className="mt-2 text-base font-semibold text-content">{item.title}</h2>
                  <p className="mt-1 whitespace-pre-line text-sm text-content-muted">{item.body}</p>
                  <p className="mt-2 text-xs text-content-subtle">{item.authorName} · {prettyDate(item.createdAt)}</p>
                </div>
                {item.canDelete && (
                  <button type="button" onClick={() => remove(item)} aria-label={`Remove ${item.title}`}
                    className="rounded-full p-1.5 text-content-subtle hover:bg-red-500/10 hover:text-red-600">
                    <IconTrash className="h-4 w-4" />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PageShell>
  )
}
