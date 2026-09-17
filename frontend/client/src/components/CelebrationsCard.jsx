import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import Card from './ui/Card'
import Button from './ui/Button'
import Modal from './ui/Modal'
import { Field, Textarea } from './ui/Field'
import { cn } from '../lib/cn'
import { apiErrorMessage } from '../lib/apiError'
import { initials } from '../lib/attendance'

const LIMIT = 120

const dayLabel = (c) => {
  if (c.inDays === 0) return 'Today'
  if (c.inDays === 1) return 'Tomorrow'
  return new Date(`${c.date}T00:00:00.000Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

const what = (c) => {
  if (c.kind === 'birthday') return c.isMe ? 'Your birthday' : 'Birthday'
  const years = `${c.years} ${c.years === 1 ? 'year' : 'years'}`
  return c.isMe ? `${years} with the team` : `${years} work anniversary`
}

function WishForm({ celebration, onClose, onSent }) {
  const first = celebration.user.name.split(' ')[0]
  const [message, setMessage] = useState(
    celebration.kind === 'birthday'
      ? `Happy birthday, ${first}! Have a lovely day.`
      : `Happy work anniversary, ${first}! Thank you for everything.`
  )
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await API.post('/celebrations/wish', {
        to: celebration.user._id,
        kind: celebration.kind,
        message: message.trim()
      })
      toast.success(data.message)
      onSent()
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not send that'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={celebration.kind === 'birthday' ? `Wish ${first} a happy birthday` : `Congratulate ${first}`}
      subtitle="They get it as a notification."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Message" hint={`${message.length}/${LIMIT}`}>
          <Textarea rows={3} maxLength={LIMIT} value={message} onChange={e => setMessage(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Not now</Button>
          <Button type="submit" loading={saving}>Send wish</Button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Birthdays and work anniversaries in the week ahead, on the dashboard.
 *
 * Hidden when there are none, so an ordinary week does not show an empty box.
 * Wishes can be sent on the day itself.
 */
export default function CelebrationsCard({ refresh = 0 }) {
  const [data, setData] = useState(null)
  const [wishing, setWishing] = useState(null)

  const load = useCallback(() =>
    API.get('/celebrations')
      .then(res => setData(res.data))
      .catch(() => setData({ celebrations: [] })), [])

  useEffect(() => {
    load()
  }, [load, refresh])

  if (!data || data.celebrations.length === 0) return null

  return (
    <Card className="mt-4">
      <h2 className="mb-4 text-lg tracking-tight text-content">Celebrations this week</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.celebrations.map(c => {
          const today = c.inDays === 0
          return (
            <li
              key={`${c.user._id}-${c.kind}`}
              className={cn(
                'flex items-center gap-3 rounded-2xl border p-3',
                today ? 'border-transparent bg-brand-400/25 dark:bg-brand-400/15' : 'border-line/70'
              )}
            >
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-sunken text-xs font-semibold text-content-muted">
                {c.user.avatar ? <img src={c.user.avatar} alt="" className="h-full w-full object-cover" /> : initials(c.user.name)}
                <span className="absolute -bottom-0.5 -right-0.5 text-base" aria-hidden="true">
                  {c.kind === 'birthday' ? '🎂' : '🎉'}
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-content">{c.isMe ? 'You' : c.user.name}</p>
                <p className="truncate text-xs text-content-subtle">{what(c)} · {dayLabel(c)}</p>
              </div>
              {today && !c.isMe && (
                c.wished
                  ? <span className="text-xs text-content-subtle">Wished ✓</span>
                  : <Button size="xs" onClick={() => setWishing(c)}>Wish</Button>
              )}
            </li>
          )
        })}
      </ul>

      <AnimatePresence>
        {wishing && <WishForm celebration={wishing} onClose={() => setWishing(null)} onSent={load} />}
      </AnimatePresence>
    </Card>
  )
}
