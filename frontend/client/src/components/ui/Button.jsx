import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { SPRING } from '../../lib/motion'

const VARIANTS = {
  primary:
    'bg-brand-600 text-white shadow-brand hover:bg-brand-700 disabled:shadow-none',
  secondary:
    'bg-surface-sunken text-content-muted hover:text-content hover:bg-line',
  outline:
    'border border-line bg-surface text-content-muted hover:text-content hover:border-brand-300',
  subtle:
    'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300 dark:hover:bg-brand-900',
  danger:
    'bg-red-600 text-white hover:bg-red-700',
  'danger-subtle':
    'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900',
  // Destructive but not shouting — reads as an option, not a warning
  'quiet-danger':
    'border border-line text-content-muted hover:border-red-400/50 hover:bg-red-500/[0.07] hover:text-red-600 dark:hover:text-red-400',
  ghost:
    'text-content-muted hover:bg-surface-sunken hover:text-content'
}

const SIZES = {
  xs: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  sm: 'px-4 py-2 text-xs rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-sm md:text-base rounded-xl gap-2'
}

// Created once at module scope — building these during render would remount
// the button (and drop focus) on every update.
const MotionLink = motion.create(Link)

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

/**
 * Renders a <button> by default, a router <Link> when given `to`, and an
 * anchor when given `href`.
 */
export default function Button({
  to,
  href,
  variant = 'primary',
  size = 'md',
  loading = false,
  full = false,
  className,
  children,
  disabled,
  ...rest
}) {
  const isDisabled = disabled || loading
  const Comp = to ? MotionLink : href ? motion.a : motion.button

  const linkProps = to ? { to } : href ? { href } : { disabled: isDisabled }

  return (
    <Comp
      whileHover={isDisabled ? undefined : { y: -1 }}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={SPRING}
      aria-disabled={isDisabled || undefined}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors duration-200',
        'disabled:cursor-not-allowed disabled:opacity-60',
        isDisabled && (to || href) && 'pointer-events-none opacity-60',
        VARIANTS[variant],
        SIZES[size],
        full && 'w-full',
        className
      )}
      {...linkProps}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </Comp>
  )
}
