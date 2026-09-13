import { motion } from 'framer-motion'
import { DURATION, EASE, listVariants, itemVariants } from '../lib/motion'
import { IconBolt, IconClock, IconShieldCheck, IconSparkles, IconUsers } from './ui/icons'

const STATS = [
  { icon: IconClock, value: '2 min', label: 'Per standup' },
  { icon: IconBolt, value: 'Real-time', label: 'Blocker alerts' },
  { icon: IconSparkles, value: 'Weekly', label: 'AI retros' }
]

/** Small product preview — shows what the app does before you are inside it. */
function PreviewCard() {
  return (
    <motion.div
      variants={itemVariants}
      className="rounded-2xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-sm"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-white/90">
          <IconUsers className="h-4 w-4 text-white/60" />
          Platform team · Today
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          LIVE
        </span>
      </div>

      <p className="text-xs text-white/55">Submitted today</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="tabular text-3xl font-bold tracking-tight text-white">
          6<span className="text-xl font-semibold text-white/50"> / 8</span>
        </p>
        <span className="pb-1 text-xs font-medium text-emerald-300">↑ 2 since 9:00</span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3.5">
        <div className="flex items-center">
          {['A', 'R', 'S', 'K'].map((initial, i) => (
            <span
              key={initial}
              style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 4 - i }}
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#1b0e38] bg-brand-500 text-[10px] font-semibold text-white"
            >
              {initial}
            </span>
          ))}
          <span className="ml-2 text-xs text-white/55">2 pending</span>
        </div>
        <span className="text-xs text-red-300">1 blocker</span>
      </div>
    </motion.div>
  )
}

/**
 * Split frame for login / register / password reset: a branded panel that
 * explains the product, and the form itself on a clean surface.
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DURATION.base, ease: EASE }}
      // theme-light: the panel beside this is dark in every theme, so the
      // form half stays light and the split keeps its contrast
      className="theme-light grid min-h-screen bg-surface lg:grid-cols-2"
    >
      {/* Brand panel — hidden on small screens, where it would just push the
          form below the fold */}
      <section className="relative hidden overflow-hidden bg-[#150a2e] p-10 lg:flex lg:flex-col xl:p-14">
        {/* Deep ground first, then a soft brand wash — a single saturated
            gradient reads flat and leaves no room for the texture to show */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-700/45 via-brand-900/25 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px),' +
              'linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px'
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-20 h-[26rem] w-[26rem] rounded-full bg-brand-500/25 blur-[100px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-indigo-500/15 blur-[100px]"
        />

        <motion.div
          variants={listVariants}
          initial="initial"
          animate="animate"
          className="relative flex h-full flex-col"
        >
          {/* Lockup */}
          <motion.div variants={itemVariants} className="flex items-center gap-3">
            <img
              src="/pwa-192x192.png"
              alt=""
              aria-hidden="true"
              className="h-11 w-11 rounded-xl shadow-lg"
            />
            <div>
              <p className="text-lg font-bold tracking-tight text-white">StandupBot</p>
              <p className="text-xs text-white/55">Async daily standups</p>
            </div>
          </motion.div>

          {/* Pitch */}
          <div className="my-auto max-w-lg py-12">
            <motion.h2
              variants={itemVariants}
              className="text-[2.35rem] font-bold leading-[1.12] tracking-[-0.025em] text-white"
            >
              Your team&apos;s standup,
              <br />
              without the meeting.
            </motion.h2>
            <motion.p
              variants={itemVariants}
              className="mt-5 text-[15px] leading-relaxed text-white/65"
            >
              Everyone posts in two minutes. Blockers surface the moment they appear,
              and an AI retrospective lands every Friday.
            </motion.p>

            <div className="mt-9">
              <PreviewCard />
            </div>

            {/* Stats */}
            <motion.div variants={itemVariants} className="mt-5 grid grid-cols-3 gap-3">
              {STATS.map(({ icon: Icon, value, label }) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5"
                >
                  <Icon className="mb-2.5 h-4 w-4 text-white/45" />
                  <p className="text-base font-semibold text-white">{value}</p>
                  <p className="mt-0.5 text-[11px] text-white/50">{label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.p variants={itemVariants} className="text-xs text-white/40">
            © {new Date().getFullYear()} StandupBot. All rights reserved.
          </motion.p>
        </motion.div>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <motion.div
          variants={listVariants}
          initial="initial"
          animate="animate"
          className="w-full max-w-[26rem]"
        >
          {/* Compact lockup for small screens, where the brand panel is hidden */}
          <motion.div variants={itemVariants} className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img
              src="/pwa-192x192.png"
              alt=""
              aria-hidden="true"
              className="h-9 w-9 rounded-lg"
            />
            <p className="font-bold tracking-tight text-content">StandupBot</p>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-title font-bold text-content"
          >
            {title}
          </motion.h1>
          {subtitle && (
            <motion.p variants={itemVariants} className="mt-2 text-sm text-content-muted">
              {subtitle}
            </motion.p>
          )}

          <motion.div variants={itemVariants} className="mt-8">
            {children}
          </motion.div>

          <motion.p
            variants={itemVariants}
            className="mt-7 flex items-center justify-center gap-1.5 text-xs text-content-subtle"
          >
            <IconShieldCheck className="h-3.5 w-3.5" />
            Sessions are encrypted and expire after 7 days
          </motion.p>

          {footer && (
            <motion.div
              variants={itemVariants}
              className="mt-6 border-t border-line pt-6 text-center text-sm text-content-muted"
            >
              {footer}
            </motion.div>
          )}
        </motion.div>
      </section>
    </motion.main>
  )
}
