import { useId } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { SPRING } from '../../lib/motion'

/**
 * A row of pills for a page's own views, in the Workspace tabs' tray.
 *
 * Each pill is a link, so the view it opens is in the address — shareable,
 * and the back button returns to the last one. `items` are
 * `{ key, label, icon, to }`; the pill whose key is `active` is filled.
 */
export default function TabPills({ items, active, label, className }) {
  // Its own highlight per row, so two rows on one screen never trade theirs
  const layoutId = useId()

  return (
    <nav
      aria-label={label}
      className={cn(
        'flex flex-wrap gap-1 md:w-fit md:max-w-full md:rounded-[1.75rem] md:border md:border-line/70 md:bg-surface/70 md:p-1 md:backdrop-blur-sm',
        className
      )}
    >
      {items.map(item => {
        const isActive = item.key === active

        return (
          <Link
            key={item.key}
            to={item.to}
            aria-current={isActive ? 'page' : undefined}
            className="relative shrink-0"
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                transition={SPRING}
                className="absolute inset-0 rounded-full bg-brand-600 dark:bg-brand-400"
              />
            )}

            <span
              className={cn(
                'relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] transition-colors',
                isActive
                  ? 'font-medium text-white dark:text-brand-700'
                  : 'text-content-muted hover:text-content'
              )}
            >
              {item.icon && <item.icon className="h-4 w-4" />}
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
