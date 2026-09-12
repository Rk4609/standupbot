import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Skeleton, { SkeletonText } from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import StreakHeatmap from '../components/StreakHeatmap'
import { MOOD_EMOJI } from '../lib/moods'
import { itemVariants } from '../lib/motion'
import { cn } from '../lib/cn'

const isoToday = () => new Date().toISOString().split('T')[0]

const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/** Compact figure used in the metric column. */
function Metric({ label, value, hint, tone = 'default' }) {
  return (
    <motion.div variants={itemVariants} className="min-w-0">
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          'tabular mt-1.5 text-metric font-semibold',
          tone === 'brand' ? 'text-brand-600 dark:text-brand-400' : 'text-content'
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-content-subtle">{hint}</p>}
    </motion.div>
  )
}

export default function Dashboard({ user }) {
  const [standups, setStandups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    API.get('/standups/my')
      .then(({ data }) => {
        if (!cancelled) setStandups(data)
      })
      .catch(err => console.error(err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const today = standups.find(s => s.date === isoToday()) || null
  const recent = standups.slice(0, 6)
  const blockerCount = standups.filter(s => s.hasBlocker).length
  const submittedDates = standups.map(s => s.date)

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })

  if (loading) {
    return (
      <PageShell>
        <Skeleton className="mb-2 h-9 w-72" />
        <Skeleton className="mb-7 h-4 w-40" />
        <Skeleton className="mb-6 h-40 rounded-card" />
        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-44 rounded-card lg:col-span-2" />
          <Skeleton className="h-44 rounded-card" />
        </div>
        <Card>
          <Skeleton className="mb-4 h-4 w-32" />
          <SkeletonText lines={5} />
        </Card>
      </PageShell>
    )
  }

  return (
    <PageShell>
      {/* Greeting */}
      <motion.header variants={itemVariants} className="mb-7">
        <h1 className="text-display font-bold text-content">
          {greeting()}, {user?.name?.split(' ')[0]}
        </h1>
        <p className="mt-1.5 text-sm text-content-muted">{dateLabel}</p>
      </motion.header>

      {/* Primary action — the one thing this page exists for */}
      <motion.section
        variants={itemVariants}
        className={cn(
          'relative mb-6 overflow-hidden rounded-card border p-6 md:p-7',
          today
            ? 'border-line bg-surface shadow-card'
            : 'border-brand-700/40 bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-brand'
        )}
      >
        {!today ? (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-white/10 blur-2xl"
            />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">
                  Today
                </p>
                <h2 className="mt-2 text-title font-semibold">Your standup is pending</h2>
                <p className="mt-1.5 max-w-md text-sm text-white/80">
                  Two minutes now saves your team a meeting later.
                </p>
              </div>
              <Button
                to="/standup/new"
                size="lg"
                className="shrink-0 !bg-white !text-brand-700 !shadow-none hover:!bg-white/90"
              >
                Submit standup →
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] text-white">
                  ✓
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-600 dark:text-emerald-400">
                  Submitted today
                </p>
              </div>
              <h2 className="mt-2.5 text-heading font-semibold text-content">{today.today}</h2>
              {today.hasBlocker && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  <span className="font-medium">Blocker:</span> {today.blockers}
                </p>
              )}
            </div>
            <span className="shrink-0 text-3xl" aria-hidden="true">
              {MOOD_EMOJI[today.mood]}
            </span>
          </div>
        )}
      </motion.section>

      {/* Activity + metrics.
          items-start so each card takes its natural height rather than the
          heatmap card stretching to match the metric column. */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3 lg:items-start">
        <Card className="lg:col-span-2">
          <div className="mb-5 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-content">Submission activity</h2>
            <Link
              to="/history"
              className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              View history
            </Link>
          </div>
          <StreakHeatmap dates={submittedDates} />
        </Card>

        <Card className="grid grid-cols-3 gap-4 lg:grid-cols-1 lg:content-start lg:gap-6">
          <Metric
            label="Streak"
            value={user?.streak || 0}
            hint={user?.streak === 1 ? 'day' : 'days'}
            tone="brand"
          />
          <Metric label="Total" value={standups.length} hint="standups" />
          <Metric label="Blockers" value={blockerCount} hint="raised" />
        </Card>
      </div>

      {/* Recent activity */}
      <Card padded={false}>
        <div className="flex items-baseline justify-between gap-3 px-4 py-4 md:px-6">
          <h2 className="text-sm font-semibold text-content">Recent standups</h2>
          {recent.length > 0 && (
            <Link
              to="/history"
              className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              See all {standups.length}
            </Link>
          )}
        </div>

        {recent.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="No standups yet"
            description="Submit your first one and start a streak."
            action={
              <Button to="/standup/new" size="sm">
                Submit your first standup
              </Button>
            }
            className="border-0 bg-transparent"
          />
        ) : (
          <div className="divide-y divide-line border-t border-line">
            {recent.map((s, i) => (
              <motion.div
                key={s._id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 + i * 0.045 }}
                className="flex items-start gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-sunken/60 md:px-6"
              >
                <span aria-hidden="true" className="mt-0.5 shrink-0 text-lg">
                  {MOOD_EMOJI[s.mood]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-content">{s.today}</p>
                  <p className="tabular mt-0.5 text-xs text-content-subtle">{s.date}</p>
                </div>
                {s.hasBlocker && <Badge tone="danger">Blocker</Badge>}
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </PageShell>
  )
}
