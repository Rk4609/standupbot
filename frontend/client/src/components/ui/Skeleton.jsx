import { cn } from '../../lib/cn'

/**
 * Shimmering placeholder. Skeletons that mirror the real layout read far more
 * like a finished product than a centred "Loading..." string.
 */
export default function Skeleton({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden rounded-md bg-surface-sunken',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer',
        'after:bg-gradient-to-r after:from-transparent after:via-white/25 after:to-transparent',
        'dark:after:via-white/[0.06]',
        className
      )}
    />
  )
}

/** A few stacked lines of text, last one short like a real paragraph. */
export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

/** Card-shaped placeholder used by list pages while their data loads. */
export function SkeletonCard({ className }) {
  return (
    <div className={cn('rounded-card border border-line bg-surface p-4 md:p-6', className)}>
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <SkeletonText lines={3} />
    </div>
  )
}
