import { cn } from '../../lib/cn'

const TONES = {
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
  neutral: 'bg-surface-sunken text-content-muted',
  positive: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  danger: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
  info: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
}

export default function Badge({ tone = 'neutral', className, children, ...rest }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium',
        TONES[tone],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  )
}
