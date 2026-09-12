import { motion } from 'framer-motion'
import { DURATION, EASE, listVariants, itemVariants } from '../lib/motion'

/**
 * Shared frame for login / register / password-reset. Keeps the four auth
 * screens visually identical — previously each one repeated its own markup and
 * only some of them supported dark mode.
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DURATION.base, ease: EASE }}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-muted p-4"
    >
      {/* Ambient brand glow — purely decorative */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: EASE }}
          className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.15, ease: EASE }}
          className="absolute -bottom-40 -left-28 h-96 w-96 rounded-full bg-brand-700/15 blur-3xl"
        />
      </div>

      <motion.div
        variants={listVariants}
        initial="initial"
        animate="animate"
        className="relative w-full max-w-md"
      >
        {/* Brand lockup */}
        <motion.div variants={itemVariants} className="mb-6 flex items-center gap-3">
          <motion.img
            src="/pwa-192x192.png"
            alt=""
            aria-hidden="true"
            className="h-11 w-11 rounded-xl shadow-brand"
            initial={{ rotate: -8, scale: 0.85 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          />
          <div>
            <p className="text-lg font-bold tracking-tight text-content">StandupBot</p>
            <p className="text-xs text-content-subtle">Async daily standups</p>
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="rounded-2xl border border-line bg-surface p-6 shadow-pop md:p-8"
        >
          <h1 className="text-xl font-bold tracking-tight text-content">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-content-muted">{subtitle}</p>}

          <div className="mt-6">{children}</div>
        </motion.div>

        {footer && (
          <motion.div
            variants={itemVariants}
            className="mt-5 text-center text-sm text-content-muted"
          >
            {footer}
          </motion.div>
        )}
      </motion.div>
    </motion.main>
  )
}
