import { motion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { itemVariants } from '../../lib/motion'

/** Consistent title block across every page. */
export default function PageHeader({ title, subtitle, actions, className }) {
  return (
    <motion.header
      variants={itemVariants}
      className={cn(
        'mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between md:mb-6',
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-content md:text-2xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-content-muted">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  )
}
