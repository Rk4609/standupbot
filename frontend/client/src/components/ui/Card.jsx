import { motion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { itemVariants } from '../../lib/motion'

/**
 * Surface container. Inherits its entrance animation from the nearest motion
 * parent (usually <PageShell>), so cards stagger in automatically.
 *
 * That inheritance is by variant *label*. A parent that animates to plain
 * objects instead gives this nothing to resolve `variants` against, and the
 * card is left at its own initial state — fully transparent. It shows up as a
 * card-shaped hole in the page, and only for cards that mount on demand,
 * since one that mounts with its list skips the initial state anyway.
 *
 * So: to animate a card yourself, put the motion props on the Card — they
 * pass through — rather than wrapping it in another motion element.
 */
export default function Card({
  className,
  interactive = false,
  padded = true,
  children,
  ...rest
}) {
  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        'rounded-card border border-line bg-surface shadow-card',
        padded && 'p-4 md:p-6',
        interactive && 'transition-shadow duration-200 hover:shadow-lift',
        className
      )}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

/** Section heading inside a card. */
export function CardTitle({ className, children }) {
  return (
    <h2 className={cn('mb-4 text-sm font-semibold text-content md:text-base', className)}>
      {children}
    </h2>
  )
}
