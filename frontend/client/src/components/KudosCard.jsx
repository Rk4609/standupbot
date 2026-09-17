import { useState } from 'react'
import toast from 'react-hot-toast'
import API from '../api/axios'
import { IconTrash } from './ui/icons'
import { cn } from '../lib/cn'
import { apiErrorMessage } from '../lib/apiError'
import { ago, valueOf } from '../lib/kudos'

/** One thank-you, with a cheer anybody on the team can add. */
export default function KudosCard({ kudos, onChange, onRemoved, compact = false }) {
  const [busy, setBusy] = useState(false)
  const value = valueOf(kudos.value)

  const cheer = async () => {
    setBusy(true)
    try {
      const { data } = await API.post(`/kudos/${kudos._id}/cheer`, {})
      onChange?.(data.kudos)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not cheer that'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await API.delete(`/kudos/${kudos._id}`)
      toast.success('Kudos removed')
      onRemoved?.(kudos)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not remove that'))
      setBusy(false)
    }
  }

  return (
    <article className={cn('rounded-card border border-line/70 bg-surface/85 shadow-card', compact ? 'p-4' : 'p-5')}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-400 text-lg" aria-hidden="true">
          {value.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-content">
            <span className="font-medium">{kudos.from.name}</span>
            <span className="text-content-subtle"> thanked </span>
            <span className="font-medium">{kudos.to.name}</span>
          </p>
          <p className="text-xs text-content-subtle">{value.label} · {ago(kudos.createdAt)}</p>
        </div>
        {kudos.canDelete && !compact && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            aria-label="Remove these kudos"
            className="rounded-full p-1.5 text-content-subtle hover:bg-red-500/10 hover:text-red-600"
          >
            <IconTrash className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <p className={cn('mt-3 text-content', compact ? 'line-clamp-2 text-sm' : 'text-[15px] leading-relaxed')}>
        “{kudos.message}”
      </p>

      {!compact && (
        <button
          type="button"
          onClick={cheer}
          disabled={busy}
          aria-pressed={kudos.cheered}
          aria-label={kudos.cheered ? 'Take back your cheer' : 'Cheer'}
          className={cn(
            'mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
            kudos.cheered
              ? 'border-transparent bg-brand-100 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300'
              : 'border-line text-content-muted hover:text-content'
          )}
        >
          <span aria-hidden="true">👏</span>
          {kudos.cheers > 0 ? kudos.cheers : 'Cheer'}
        </button>
      )}
    </article>
  )
}
