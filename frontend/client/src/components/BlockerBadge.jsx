import { motion } from 'framer-motion'
import Badge from './ui/Badge'
import { DURATION, EASE } from '../lib/motion'

export default function BlockerBadge({ text, compact = false }) {
  if (compact) {
    return <Badge tone="danger">🚨 Blocker</Badge>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE }}
      className="rounded-xl border-l-[3px] border-l-red-500 bg-red-50 px-4 py-3 dark:bg-red-950/50"
    >
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-500 dark:text-red-400">
        Blocker
      </p>
      <p className="text-sm leading-relaxed text-red-700 dark:text-red-300">{text}</p>
    </motion.div>
  )
}
