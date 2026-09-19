import { motion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { listVariants, pageVariants } from '../../lib/motion'
import { GUTTER } from '../../lib/pageWidth'

/**
 * Page wrapper inside AppShell.
 *
 * Every page gets the same frame. It used to take a width, and pages picked
 * anything from 2xl to 6xl — so each one started at a different distance from
 * the sidebar and the whole app looked like it had been assembled from
 * unrelated screens. A page that wants a narrower measure constrains its own
 * content instead, which keeps the left edge where the reader expects it.
 *
 * It also handles the route transition and acts as the stagger parent, so any
 * <Card> or motion child below animates in sequence.
 */
export default function PageShell({ className, children }) {
  return (
    <motion.main
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn(GUTTER, 'py-6 md:py-8')}
    >
      <motion.div
        variants={listVariants}
        initial="initial"
        animate="animate"
        className={className}
      >
        {children}
      </motion.div>
    </motion.main>
  )
}
