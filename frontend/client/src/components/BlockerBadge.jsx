import { motion } from 'framer-motion'
import Badge from './ui/Badge'
import { IconAlert } from './ui/icons'
import { DURATION, EASE } from '../lib/motion'

export default function BlockerBadge({ text, compact = false }) {
  if (compact) {
    return (
      <Badge tone="danger">
        <IconAlert className="h-3 w-3" />
        Blocker
      </Badge>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE }}
      // A thin rule and a 4%-opacity wash rather than a filled red panel:
      // saturated red blocks read as an error state, and red-on-red text is
      // hard to read against a dark surface.
      className="rounded-lg border-l-2 border-red-500/70 bg-red-500/[0.055] py-2.5 pl-3.5 pr-4"
    >
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-red-600 dark:text-red-400">
        <IconAlert className="h-3.5 w-3.5" />
        Blocker
      </p>
      <p className="text-sm leading-relaxed text-content">{text}</p>
    </motion.div>
  )
}
