import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import Button from './ui/Button'
import Badge from './ui/Badge'
import { Textarea } from './ui/Field'
import { IconCheck, IconRefresh } from './ui/icons'
import { cn } from '../lib/cn'
import { collapseVariants } from '../lib/motion'
import { apiErrorMessage } from '../lib/apiError'

const STATUS_TONE = { open: 'warning', answered: 'info', closed: 'neutral' }
const STATUS_LABEL = { open: 'Waiting', answered: 'Answered', closed: 'Closed' }

const when = (iso) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * One report and everything said about it.
 *
 * Collapsed it is a single line, because a queue of thirty issues is only
 * readable as a list of subjects. Open it carries the whole conversation —
 * the reporter can add to their own thread through the same box the admin
 * answers in, so nobody has to raise a second ticket to add a detail.
 */
export default function TicketThread({ ticket: initial, isAdmin, showWho, defaultOpen }) {
  const [ticket, setTicket] = useState(initial)
  const [open, setOpen] = useState(Boolean(defaultOpen))
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)

  const closed = ticket.status === 'closed'

  const send = async (e) => {
    e.preventDefault()
    if (!reply.trim()) return
    setBusy(true)
    try {
      const { data } = await API.post(`/support/${ticket._id}/reply`, { body: reply.trim() })
      setTicket(data)
      setReply('')
      toast.success(isAdmin ? 'Answer sent' : 'Added to your report')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not send that'))
    } finally {
      setBusy(false)
    }
  }

  const setStatus = async (status) => {
    setBusy(true)
    try {
      const { data } = await API.patch(`/support/${ticket._id}`, { status })
      setTicket(data)
      toast.success(status === 'closed' ? 'Closed' : 'Reopened')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not change that'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={cn(closed && 'opacity-70')}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3.5 text-left md:px-6"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-content">
            {ticket.subject}
          </span>
          <span className="mt-0.5 block text-xs text-content-subtle">
            {showWho ? `${ticket.userName || 'Somebody'} · ` : ''}
            {when(ticket.createdAt)}
            {ticket.replies?.length > 0 &&
              ` · ${ticket.replies.length} ${ticket.replies.length === 1 ? 'reply' : 'replies'}`}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          <Badge tone="neutral">{ticket.category}</Badge>
          <Badge tone={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            variants={collapseVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="overflow-hidden"
          >
            <div className="border-t border-line bg-surface-sunken/40 px-4 py-4 md:px-6">
              <p className="whitespace-pre-line text-sm text-content-muted">{ticket.body}</p>

              {ticket.replies?.length > 0 && (
                <ul className="mt-4 space-y-3">
                  {ticket.replies.map(r => (
                    <li
                      key={r._id}
                      className={cn(
                        'rounded-xl border border-line px-3.5 py-3',
                        r.authorRole === 'admin' ? 'bg-brand-600/[0.06]' : 'bg-surface'
                      )}
                    >
                      <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-content-subtle">
                        <span className="font-medium text-content">{r.authorName}</span>
                        {r.authorRole === 'admin' && <Badge tone="brand">Admin</Badge>}
                        <span>{when(r.createdAt)}</span>
                      </p>
                      <p className="whitespace-pre-line text-sm text-content">{r.body}</p>
                    </li>
                  ))}
                </ul>
              )}

              {closed ? (
                <p className="mt-4 text-xs text-content-subtle">
                  This one is closed. Raise a new report if it comes back.
                </p>
              ) : (
                <form onSubmit={send} className="mt-4 space-y-2">
                  <Textarea
                    rows={3}
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    maxLength={4000}
                    aria-label={`Reply to ${ticket.subject}`}
                    placeholder={isAdmin ? 'Answer them…' : 'Add something to your report…'}
                    className="text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" loading={busy} disabled={!reply.trim()}>
                      {isAdmin ? 'Send answer' : 'Add'}
                    </Button>
                    {isAdmin && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStatus('closed')}
                        disabled={busy}
                      >
                        <IconCheck className="h-4 w-4" />
                        Close
                      </Button>
                    )}
                  </div>
                </form>
              )}

              {isAdmin && closed && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStatus('open')}
                  disabled={busy}
                  className="mt-3"
                >
                  <IconRefresh className="h-4 w-4" />
                  Reopen
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}
