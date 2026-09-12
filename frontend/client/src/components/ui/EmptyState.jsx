import { motion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { EASE, itemVariants } from '../../lib/motion'

const TONES = {
  neutral: 'border-line bg-surface',
  positive: 'border-emerald-500/25 bg-emerald-500/[0.06]',
  warning: 'border-amber-500/25 bg-amber-500/[0.06]',
  danger: 'border-red-500/25 bg-red-500/[0.06]'
}

/** Tint for the circular icon plate. */
const ICON_TONES = {
  neutral: 'bg-surface-sunken text-content-subtle',
  positive: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
  danger: 'bg-red-500/12 text-red-600 dark:text-red-400'
}

/**
 * Shared empty / error / success-void state. Keeps the "nothing here" moments
 * looking deliberate instead of like a blank screen.
 */
export default function EmptyState({
  icon,
  title,
  description,
  tone = 'neutral',
  action,
  className
}) {
  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        'rounded-card border px-6 py-10 text-center md:py-12',
        TONES[tone],
        className
      )}
    >
      {icon && (
        <motion.div
          aria-hidden="true"
          className={cn(
            'mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full',
            ICON_TONES[tone]
          )}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.08, duration: 0.4, ease: EASE }}
        >
          {typeof icon === 'string' ? <span className="text-2xl">{icon}</span> : icon}
        </motion.div>
      )}
      <p className="text-sm font-semibold text-content md:text-base">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-content-muted">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </motion.div>
  )
}
