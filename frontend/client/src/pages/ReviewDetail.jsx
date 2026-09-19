import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { Field, Textarea } from '../components/ui/Field'
import { IconAlert } from '../components/ui/icons'
import RatingPicker, { RatingRow } from '../components/RatingPicker'
import { apiErrorMessage } from '../lib/apiError'
import { AREA_LABEL, RATING_LABEL, REVIEW_STATUS } from '../lib/reviews'
import { shortDay } from '../lib/leave'

const Text = ({ title, children }) => (
  <div className="mt-4">
    <p className="text-xs font-medium uppercase tracking-wide text-content-subtle">{title}</p>
    <p className="mt-1 whitespace-pre-line text-sm text-content">{children || '—'}</p>
  </div>
)

/** What the record says about their period: standups, blockers, kudos, leave. */
function Facts({ facts, name }) {
  const items = [
    [facts.standups, 'standups'],
    [facts.blockers, 'blockers raised'],
    [facts.kudos, 'kudos received'],
    [facts.leaveDays, 'days of leave']
  ]
  return (
    <Card className="mb-5">
      <CardTitle>From {name}&apos;s record this period</CardTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {items.map(([n, label]) => (
          <div key={label} className="rounded-2xl bg-surface-sunken px-3 py-2.5">
            <p className="tabular text-xl font-light text-content">{n}</p>
            <p className="text-xs text-content-muted">{label}</p>
          </div>
        ))}
      </div>
      {facts.recentKudos.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {facts.recentKudos.map((k, i) => (
            <li key={i} className="text-xs text-content-muted">“{k.message}” — {k.from}</li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** The employee's own half: a form until handed in. */
function SelfForm({ review, areas, onSaved }) {
  const [ratings, setRatings] = useState(review.self?.ratings || {})
  const [wins, setWins] = useState(review.self?.wins || '')
  const [improve, setImprove] = useState(review.self?.improve || '')
  const [busy, setBusy] = useState('')

  const save = async (submit) => {
    setBusy(submit ? 'submit' : 'draft')
    try {
      const { data } = await API.put(`/reviews/${review._id}/self`, { ratings, wins, improve, submit })
      toast.success(submit ? 'Handed in — your manager can read it now' : 'Draft saved')
      onSaved(data.review)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not save that'))
    } finally {
      setBusy('')
    }
  }

  const complete = areas.every(a => ratings[a])

  return (
    <Card>
      <CardTitle>Your self-review</CardTitle>
      <p className="-mt-2 mb-5 text-sm text-content-muted">Your manager sees this only once you hand it in.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {areas.map(a => (
          <RatingPicker key={a} label={AREA_LABEL[a]} value={ratings[a]} onChange={n => setRatings(r => ({ ...r, [a]: n }))} />
        ))}
      </div>
      <div className="mt-2 space-y-4">
        <Field label="What went well">
          <Textarea rows={4} maxLength={2000} value={wins} onChange={e => setWins(e.target.value)} placeholder="What you shipped, fixed or helped with" />
        </Field>
        <Field label="What you want to get better at">
          <Textarea rows={3} maxLength={2000} value={improve} onChange={e => setImprove(e.target.value)} />
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" loading={busy === 'draft'} onClick={() => save(false)}>Save draft</Button>
        <Button loading={busy === 'submit'} disabled={!complete} onClick={() => save(true)}>Hand it in</Button>
      </div>
    </Card>
  )
}

/** The manager's half: a draft until shared, and fixed after. */
function ManagerForm({ review, areas, onSaved }) {
  const m = review.manager || {}
  const [ratings, setRatings] = useState(m.ratings || {})
  const [overall, setOverall] = useState(m.overall || null)
  const [strengths, setStrengths] = useState(m.strengths || '')
  const [growth, setGrowth] = useState(m.growth || '')
  const [busy, setBusy] = useState('')

  const save = async (share) => {
    setBusy(share ? 'share' : 'draft')
    try {
      const { data } = await API.put(`/reviews/${review._id}/manager`, { ratings, overall, strengths, growth })
      if (share) {
        const shared = await API.post(`/reviews/${review._id}/share`, {})
        toast.success(shared.data.message)
        onSaved(shared.data.review)
      } else {
        toast.success('Draft saved')
        onSaved(data.review)
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not save that'))
    } finally {
      setBusy('')
    }
  }

  const ready = areas.every(a => ratings[a]) && overall && strengths.trim().length >= 3 && growth.trim().length >= 3

  return (
    <Card>
      <CardTitle>Your review of {review.employeeName}</CardTitle>
      <p className="-mt-2 mb-5 text-sm text-content-muted">A draft until you share it. Once shared it cannot be changed.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {areas.map(a => (
          <RatingPicker
            key={a}
            label={AREA_LABEL[a]}
            value={ratings[a]}
            onChange={n => setRatings(r => ({ ...r, [a]: n }))}
            hint={review.self?.ratings?.[a] ? `They said ${review.self.ratings[a]}` : null}
          />
        ))}
      </div>
      <div className="mt-2 space-y-4">
        <Field label="Strengths">
          <Textarea rows={4} maxLength={2000} value={strengths} onChange={e => setStrengths(e.target.value)} />
        </Field>
        <Field label="Where to grow next">
          <Textarea rows={3} maxLength={2000} value={growth} onChange={e => setGrowth(e.target.value)} />
        </Field>
        <RatingPicker label="Overall" value={overall} onChange={setOverall} />
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" loading={busy === 'draft'} onClick={() => save(false)}>Save draft</Button>
        <Button loading={busy === 'share'} disabled={!ready} onClick={() => save(true)}>Share with {review.employeeName}</Button>
      </div>
    </Card>
  )
}

function SelfRead({ review, areas, title }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {areas.map(a => <RatingRow key={a} label={AREA_LABEL[a]} value={review.self.ratings?.[a]} />)}
      <Text title="What went well">{review.self.wins}</Text>
      <Text title="What they want to get better at">{review.self.improve}</Text>
    </Card>
  )
}

function ManagerRead({ review, areas }) {
  const m = review.manager
  return (
    <Card>
      <CardTitle>{m.writtenByName || review.reviewerName || 'Your manager'}&apos;s review</CardTitle>
      <div className="mb-4 rounded-2xl bg-brand-600/10 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-content-subtle">Overall</p>
        <p className="text-lg text-content">{m.overall}/5 · {RATING_LABEL[m.overall]}</p>
      </div>
      {areas.map(a => (
        <RatingRow key={a} label={AREA_LABEL[a]} value={m.ratings?.[a]} other={review.self?.ratings?.[a]} otherLabel="self:" />
      ))}
      <Text title="Strengths">{m.strengths}</Text>
      <Text title="Where to grow next">{m.growth}</Text>
    </Card>
  )
}

function Acknowledge({ review, onSaved }) {
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async () => {
    setBusy(true)
    try {
      const { data } = await API.post(`/reviews/${review._id}/acknowledge`, { comment: comment.trim() })
      toast.success('Thanks — noted')
      onSaved(data.review)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not save that'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <CardTitle>Read it?</CardTitle>
      <Field label="Anything to say back" hint="Optional — your manager sees it">
        <Textarea rows={2} maxLength={1000} value={comment} onChange={e => setComment(e.target.value)} />
      </Field>
      <div className="mt-4 flex justify-end">
        <Button loading={busy} onClick={send}>I have read my review</Button>
      </div>
    </Card>
  )
}

/** One review: the owner writes or reads it, the reviewer writes the other half. */
export default function ReviewDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() =>
    API.get(`/reviews/${id}`)
      .then(res => { setData(res.data); setError('') })
      .catch(err => setError(apiErrorMessage(err, 'Could not load that review'))), [id])

  useEffect(() => { load() }, [load])

  const replace = (review) => setData(d => ({ ...d, review: { ...review, viewer: d.review.viewer } }))

  if (error && !data) {
    return <PageShell><PageHeader title="Review" /><EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} /></PageShell>
  }
  if (!data) {
    return <PageShell><Skeleton className="mb-7 h-9 w-56" /><Skeleton className="h-96 rounded-card" /></PageShell>
  }

  const { review, areas, facts } = data
  const mine = review.viewer === 'employee'
  const shared = ['shared', 'acknowledged'].includes(review.status)
  const status = REVIEW_STATUS[review.status]

  return (
    <PageShell>
      <PageHeader
        title={mine ? review.cycleName : `${review.employeeName} · ${review.cycleName}`}
        subtitle={`Looking back on ${shortDay(review.from)} – ${shortDay(review.to)}`}
        actions={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      {mine ? (
        <div className="space-y-5">
          {review.status === 'self'
            ? <SelfForm review={review} areas={areas} onSaved={replace} />
            : <SelfRead review={review} areas={areas} title="Your self-review" />}
          {review.manager && <ManagerRead review={review} areas={areas} />}
          {review.status === 'shared' && <Acknowledge review={review} onSaved={replace} />}
          {review.status === 'manager' && (
            <p className="text-sm text-content-muted">Handed in. You will get a notification when your manager shares their review.</p>
          )}
          {review.status === 'acknowledged' && review.employeeComment && <Text title="What you said back">{review.employeeComment}</Text>}
        </div>
      ) : (
        <div className="space-y-5">
          {facts && <Facts facts={facts} name={review.employeeName} />}
          {review.self
            ? <SelfRead review={review} areas={areas} title={`${review.employeeName}'s self-review`} />
            : <Card><p className="text-sm text-content-muted">{review.employeeName} has not handed in their self-review yet. You can start your part meanwhile.</p></Card>}
          {shared
            ? <ManagerRead review={review} areas={areas} />
            : <ManagerForm review={review} areas={areas} onSaved={replace} />}
          {review.status === 'acknowledged' && (
            <Card><Text title={`${review.employeeName} read it`}>{review.employeeComment || 'No comment.'}</Text></Card>
          )}
        </div>
      )}
    </PageShell>
  )
}
