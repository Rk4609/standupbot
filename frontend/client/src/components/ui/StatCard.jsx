import { useEffect, useState } from 'react'
import { animate, motion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { DURATION, EASE, itemVariants } from '../../lib/motion'

const TONES = {
  brand: 'text-brand-600 dark:text-brand-400',
  positive: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
  neutral: 'text-content'
}

/** Numbers tick up from zero on mount — cheap, and makes dashboards feel alive. */
function useCountUp(target) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (typeof target !== 'number' || !Number.isFinite(target)) return
    const controls = animate(0, target, {
      duration: Math.min(0.4 + target * 0.02, 1.1),
      ease: EASE,
      onUpdate: (v) => setValue(Math.round(v))
    })
    return () => controls.stop()
  }, [target])

  return value
}

export default function StatCard({ value, label, tone = 'brand', suffix, className }) {
  const isNumeric = typeof value === 'number' && Number.isFinite(value)
  const counted = useCountUp(isNumeric ? value : null)

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -2 }}
      transition={{ duration: DURATION.fast, ease: EASE }}
      className={cn(
        'rounded-card border border-line bg-surface p-3 text-center shadow-card md:p-4',
        className
      )}
    >
      <div className={cn('tabular text-xl font-bold md:text-2xl', TONES[tone])}>
        {isNumeric ? counted : value}
        {suffix && <span className="text-base font-semibold">{suffix}</span>}
      </div>
      <div className="mt-1 text-xs leading-tight text-content-muted">{label}</div>
    </motion.div>
  )
}
