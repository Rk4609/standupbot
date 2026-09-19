import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { IconAlert } from '../components/ui/icons'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { meetingWhen, orderMeetings, REVIEW_STATUS } from '../lib/reviews'

const Row = ({ to, title, sub, badge }) => (
  <li>
    <Link to={to} className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-surface-sunken/60 md:px-6">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-content">{title}</p>
        {sub && <p className="mt-0.5 text-xs text-content-muted">{sub}</p>}
      </div>
      {badge}
    </Link>
  </li>
)

export function MeetingList({ meetings, empty, nameOf }) {
  if (meetings.length === 0) return <p className="px-4 pb-5 text-sm text-content-subtle md:px-6">{empty}</p>
  return (
    <ul className="divide-y divide-line">
      {orderMeetings(meetings).map(m => {
        const open = m.items.filter(i => i.kind === 'action' && !i.done).length
        return (
          <Row
            key={m._id}
            to={`/one-on-ones/${m._id}`}
            title={`1:1 with ${nameOf(m)}`}
            sub={`${meetingWhen(m.date, m.time)}${open ? ` · ${open} open action${open === 1 ? '' : 's'}` : ''}`}
            badge={<Badge tone={m.status === 'done' ? 'neutral' : 'info'}>{m.status === 'done' ? 'Held' : 'Coming up'}</Badge>}
          />
        )
      })}
    </ul>
  )
}

/** My reviews and my 1:1s with my manager. */
export default function Reviews() {
  const live = useLiveRefresh()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([API.get('/reviews/mine'), API.get('/one-on-ones')])
      .then(([reviews, meetings]) => {
        setData({ reviews: reviews.data.reviews, meetings: meetings.data.oneOnOnes.filter(m => m.side === 'employee') })
        setError('')
      })
      .catch(err => setError(apiErrorMessage(err, 'Could not load your reviews')))
  }, [live])

  if (error && !data) {
    return <PageShell><PageHeader title="Reviews & 1:1s" /><EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} /></PageShell>
  }
  if (!data) {
    return <PageShell><Skeleton className="mb-7 h-9 w-56" /><Skeleton className="h-80 rounded-card" /></PageShell>
  }

  return (
    <PageShell>
      <PageHeader title="Reviews & 1:1s" subtitle="How you are doing, in writing — and the conversations with your manager." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card padded={false}>
          <div className="px-4 pt-4 md:px-6 md:pt-5"><CardTitle>1:1s with your manager</CardTitle></div>
          <MeetingList meetings={data.meetings} nameOf={m => m.managerName} empty="None yet. Your manager sets them up; you can add what you want to talk about." />
        </Card>
        <Card padded={false}>
          <div className="px-4 pt-4 md:px-6 md:pt-5"><CardTitle>Your reviews</CardTitle></div>
          {data.reviews.length === 0
            ? <p className="px-4 pb-5 text-sm text-content-subtle md:px-6">No review round has started yet.</p>
            : (
              <ul className="divide-y divide-line">
                {data.reviews.map(r => (
                  <Row
                    key={r._id}
                    to={`/reviews/${r._id}`}
                    title={r.cycleName}
                    sub={r.status === 'self' ? 'Write your self-review' : r.status === 'shared' ? 'Your manager shared it — read it' : null}
                    badge={<Badge tone={REVIEW_STATUS[r.status].tone}>{REVIEW_STATUS[r.status].label}</Badge>}
                  />
                ))}
              </ul>
            )}
        </Card>
      </div>
    </PageShell>
  )
}
