import { motion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { EASE, itemVariants } from '../../lib/motion'

const TONES = {
  neutral: 'border-line bg-surface',
  positive:
    'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/50',
  warning:
    'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50',
  danger: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50'
}

/**
 * Shared empty / error / success-void state. Keeps the "nothing here" moments
 * looking deliberate instead of like a blank screen.
 */
export default function EmptyState({
  icon = '📭',
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
      <motion.p
        aria-hidden="true"
        className="mb-3 text-4xl"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.08, duration: 0.4, ease: EASE }}
      >
        {icon}
      </motion.p>
      <p className="text-sm font-semibold text-content md:text-base">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-content-muted">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </motion.div>
  )
}
