import { cn } from '../lib/cn'
import { RATING_LABEL } from '../lib/reviews'

/** One to five, as five buttons; the label under it says what the number means. */
export default function RatingPicker({ label, value, onChange, hint }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-content">{label}</p>
        {hint && <p className="text-xs text-content-subtle">{hint}</p>}
      </div>
      <div className="flex gap-1.5" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            aria-label={`${label}: ${n}`}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className={cn(
              'h-9 w-9 rounded-full border text-sm tabular transition-colors',
              value === n
                ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-400 dark:bg-brand-400 dark:text-brand-700'
                : 'border-line text-content-muted hover:border-brand-400 hover:text-content'
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="mt-1 h-4 text-xs text-content-subtle">{value ? RATING_LABEL[value] : ''}</p>
    </div>
  )
}

/** A rating already given, read-only. */
export function RatingRow({ label, value, other, otherLabel }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-content-muted">{label}</span>
      <span className="tabular text-content">
        {value ? `${value}/5` : '—'}
        {other ? <span className="ml-2 text-xs text-content-subtle">({otherLabel} {other})</span> : null}
      </span>
    </div>
  )
}
