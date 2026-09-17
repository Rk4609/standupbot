import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import API from '../api/axios'
import Button from './ui/Button'
import { cn } from '../lib/cn'
import { apiErrorMessage } from '../lib/apiError'

/** Unread announcements at the top of the dashboard, until each is acknowledged. */
export default function AnnouncementBanner({ refresh = 0 }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    API.get('/announcements')
      .then(res => setItems(res.data.announcements.filter(a => !a.read)))
      .catch(() => setItems([]))
  }, [refresh])

  const gotIt = async (item) => {
    setItems(list => list.filter(a => a._id !== item._id))
    try {
      await API.post(`/announcements/${item._id}/read`, {})
    } catch (err) {
      setItems(list => [item, ...list])
      toast.error(apiErrorMessage(err, 'Could not mark that read'))
    }
  }

  if (items.length === 0) return null

  return (
    <div className="mb-4 space-y-3">
      {items.map(item => (
        <section
          key={item._id}
          aria-label="Announcement"
          className={cn(
            'flex flex-col gap-3 rounded-card p-5 shadow-card sm:flex-row sm:items-start',
            item.important
              ? 'bg-red-600 text-white dark:bg-red-900/60'
              : 'bg-brand-600 text-white dark:bg-surface-raised dark:text-content'
          )}
        >
          <span className="text-2xl" aria-hidden="true">📣</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.14em] opacity-70">
              {item.important ? 'Important · ' : ''}{item.team ? item.team.name : 'Everybody'} · {item.authorName}
            </p>
            <h2 className="mt-1 text-lg font-medium tracking-tight text-white dark:text-content">{item.title}</h2>
            <p className="mt-1 whitespace-pre-line text-sm opacity-85">{item.body}</p>
          </div>
          <Button size="sm" variant="subtle" onClick={() => gotIt(item)} className="self-start">
            Got it
          </Button>
        </section>
      ))}
    </div>
  )
}
