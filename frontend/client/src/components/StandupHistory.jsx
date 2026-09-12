import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import API from '../api/axios'
import Skeleton from './ui/Skeleton'
import { DURATION, EASE } from '../lib/motion'
import { apiErrorMessage } from '../lib/apiError'

const FIELD_LABEL = {
  yesterday: 'Accomplished yesterday',
  today: "Today's plan",
  blockers: 'Blockers',
  mood: 'Mood'
}

/** "2 hours ago" reads better than a timestamp for something this recent. */
const ago = (iso) => {
  const seconds = Math.round((Date.now() - new Date(iso)) / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`

  const days = Math.round(hours / 24)
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`

  return new Date(iso).toLocaleDateString()
}

/** What one field looked like before and after, side by side. */
function Change({ change }) {
  return (
    <div className="text-xs">
      <p className="mb-1 font-medium text-content-muted">
        {FIELD_LABEL[change.field] || change.field}
      </p>
      <p className="whitespace-pre-line text-content-subtle line-through decoration-red-400/60">
        {change.from || '(empty)'}
      </p>
      <p className="mt-0.5 whitespace-pre-line text-content">{change.to || '(empty)'}</p>
    </div>
  )
}

/**
 * The edit trail for one standup.
 *
 * Fetched only when someone opens it — most standups are never edited, and
 * loading a trail for every card in a list would be a request per row.
 */
export default function StandupHistory({ standupId }) {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    API.get(`/standups/${standupId}/history`)
      .then(res => {
        if (!cancelled) setEntries(res.data)
      })
      .catch(err => {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load the history'))
      })

    return () => {
      cancelled = true
    }
  }, [standupId])

  if (error) {
    return <p className="text-xs text-red-500">{error}</p>
  }

  if (entries === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-full" />
      </div>
    )
  }

  if (entries.length === 0) {
    return <p className="text-xs text-content-subtle">No changes recorded.</p>
  }

  return (
    <motion.ol
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.fast, ease: EASE }}
      className="space-y-3 border-l border-line pl-4"
    >
      {entries.map(entry => (
        <li key={entry._id} className="relative">
          <span
            aria-hidden="true"
            className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand-500"
          />
          <p className="text-xs text-content-muted">
            <span className="font-medium text-content">{entry.actorName || 'Someone'}</span>
            {entry.action === 'standup.deleted' ? ' deleted this' : ' edited this'}
            <span className="text-content-subtle"> · {ago(entry.createdAt)}</span>
          </p>
          <div className="mt-2 space-y-2.5">
            {entry.changes.map(c => (
              <Change key={c.field} change={c} />
            ))}
          </div>
        </li>
      ))}
    </motion.ol>
  )
}
