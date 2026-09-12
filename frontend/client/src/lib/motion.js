/**
 * Shared motion vocabulary.
 *
 * Every animation in the app pulls from here so timing and easing stay
 * consistent — the quickest way to make motion feel amateurish is for each
 * screen to invent its own durations.
 */

// Standard easing: fast out, settle in. Matches Material's "emphasised decelerate".
export const EASE = [0.22, 1, 0.36, 1]

export const DURATION = {
  fast: 0.18,
  base: 0.28,
  slow: 0.45
}

/** Route-level transition. Subtle — page transitions that move a lot feel slow. */
export const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE }
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: DURATION.fast, ease: 'easeIn' }
  }
}

/** Parent of a list — children animate in sequence rather than all at once. */
export const listVariants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.05, delayChildren: 0.04 }
  }
}

/** Child of `listVariants`, and the default entrance for standalone blocks. */
export const itemVariants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE }
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.98,
    transition: { duration: DURATION.fast, ease: 'easeIn' }
  }
}

/** Dropdowns, popovers, inline panels. Grows from the edge it is anchored to. */
export const popVariants = {
  initial: { opacity: 0, scale: 0.96, y: -6 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: DURATION.fast, ease: EASE }
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: -4,
    transition: { duration: 0.12, ease: 'easeIn' }
  }
}

/** Collapsible regions — filter panels, inline edit forms, mobile menu. */
export const collapseVariants = {
  initial: { opacity: 0, height: 0 },
  animate: {
    opacity: 1,
    height: 'auto',
    transition: { height: { duration: DURATION.base, ease: EASE }, opacity: { duration: 0.2 } }
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { height: { duration: DURATION.fast, ease: 'easeIn' }, opacity: { duration: 0.12 } }
  }
}

/** Spring used for anything the user directly manipulates (taps, toggles). */
export const SPRING = { type: 'spring', stiffness: 420, damping: 30, mass: 0.7 }

/** Reusable press/hover feedback for buttons and tappable cards. */
export const tap = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.97 },
  transition: SPRING
}
