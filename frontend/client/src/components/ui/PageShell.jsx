import { motion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { listVariants, pageVariants } from '../../lib/motion'

const WIDTHS = {
  sm: 'max-w-2xl',
  md: 'max-w-3xl',
  lg: 'max-w-4xl',
  xl: 'max-w-5xl'
}

/**
 * Page wrapper. Handles the route transition and acts as the stagger parent,
 * so any <Card> or motion child below animates in sequence without each page
 * wiring that up itself.
 */
export default function PageShell({ width = 'md', className, children }) {
  return (
    <motion.main
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen bg-surface-muted px-4 py-6 md:py-8"
    >
      <motion.div
        variants={listVariants}
        initial="initial"
        animate="animate"
        className={cn('mx-auto', WIDTHS[width], className)}
      >
        {children}
      </motion.div>
    </motion.main>
  )
}
