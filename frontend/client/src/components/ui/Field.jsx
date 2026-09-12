import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { DURATION, EASE } from '../../lib/motion'

const base =
  'w-full rounded-xl border bg-surface px-4 py-2.5 text-sm text-content transition-colors duration-200 placeholder:text-content-subtle disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-content-subtle'

const tone = (invalid) =>
  invalid
    ? 'border-red-300 dark:border-red-800'
    : 'border-line hover:border-content-subtle/40'

/** Label + control + animated error message. */
export function Field({ label, hint, error, children, className }) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-content-muted">
          {label}
        </label>
      )}
      {children}
      <AnimatePresence mode="wait">
        {error && (
          <motion.p
            key={error}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: DURATION.fast, ease: EASE }}
            className="mt-1.5 text-xs text-red-500"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      {hint && !error && (
        <p className="mt-1.5 text-xs text-content-subtle">{hint}</p>
      )}
    </div>
  )
}

export function Input({ invalid, className, ...rest }) {
  return <input className={cn(base, tone(invalid), className)} {...rest} />
}

export function Textarea({ invalid, className, ...rest }) {
  return (
    <textarea
      className={cn(base, tone(invalid), 'resize-none leading-relaxed', className)}
      {...rest}
    />
  )
}

export function Select({ invalid, className, children, ...rest }) {
  return (
    <select className={cn(base, tone(invalid), 'cursor-pointer', className)} {...rest}>
      {children}
    </select>
  )
}
