import { Children, cloneElement, isValidElement, useId } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { DURATION, EASE } from '../../lib/motion'

const base =
  'w-full rounded-2xl border bg-surface px-4 py-2.5 text-sm text-content transition-colors duration-200 placeholder:text-content-subtle disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-content-subtle'

const tone = (invalid) =>
  invalid
    ? 'border-red-300 dark:border-red-800'
    : 'border-line hover:border-content-subtle/40 focus:border-brand-400'

/**
 * Label + control + animated error message.
 *
 * The label is tied to the control by id. It used to be a bare `<label>` with
 * nothing pointing at the input beside it, which reads to a screen reader as
 * an unlabelled box — clicking the label did nothing either. The id is handed
 * to the child unless it brought its own.
 */
export function Field({ label, hint, error, children, className }) {
  const generatedId = useId()

  const only = Children.only(children)
  const controlId = only?.props?.id || generatedId
  const describedBy = error || hint ? `${controlId}-note` : undefined

  const control = isValidElement(only)
    ? cloneElement(only, {
        id: controlId,
        'aria-describedby': only.props['aria-describedby'] || describedBy,
        'aria-invalid': only.props['aria-invalid'] ?? (error ? true : undefined)
      })
    : only

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={controlId}
          className="mb-1.5 block text-sm font-medium text-content-muted"
        >
          {label}
        </label>
      )}
      {control}
      <AnimatePresence mode="wait">
        {error && (
          <motion.p
            key={error}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: DURATION.fast, ease: EASE }}
            id={`${controlId}-note`}
            className="mt-1.5 text-xs text-red-500"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      {hint && !error && (
        <p id={`${controlId}-note`} className="mt-1.5 text-xs text-content-subtle">
          {hint}
        </p>
      )}
    </div>
  )
}

/**
 * `icon` renders a leading glyph inside the control; `trailing` is a slot for
 * an affordance such as a password reveal toggle.
 */
export function Input({ invalid, icon: Icon, trailing, className, ...rest }) {
  const control = (
    <input
      className={cn(
        base,
        tone(invalid),
        Icon && 'pl-10',
        trailing && 'pr-10',
        className
      )}
      {...rest}
    />
  )

  if (!Icon && !trailing) return control

  return (
    <div className="relative">
      {Icon && (
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" />
      )}
      {control}
      {trailing && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>
      )}
    </div>
  )
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

/** Checkbox with a label, styled to match the inputs. */
export function Checkbox({ label, className, ...rest }) {
  return (
    <label className={cn('flex cursor-pointer select-none items-center gap-2', className)}>
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer rounded border-line bg-surface text-brand-600 accent-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500/60"
        {...rest}
      />
      <span className="text-sm text-content-muted">{label}</span>
    </label>
  )
}
