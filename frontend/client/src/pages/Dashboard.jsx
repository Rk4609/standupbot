import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import StatCard from '../components/ui/StatCard'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Skeleton, { SkeletonText } from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { MOOD_EMOJI } from '../lib/moods'
import { itemVariants } from '../lib/motion'

const today = () => new Date().toISOString().split('T')[0]

export default function Dashboard({ user }) {
  const [todayStandup, setTodayStandup] = useState(null)
  const [recentStandups, setRecentStandups] = useState([])
  const [totalStandups, setTotalStandups] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await API.get('/standups/my')
        setTodayStandup(data.find(s => s.date === today()) || null)
        setRecentStandups(data.slice(0, 5))
        setTotalStandups(data.length)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  if (loading) {
    return (
      <PageShell>
        <div className="mb-6 space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="mb-5 grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-[76px] rounded-card md:h-[88px]" />
          ))}
        </div>
        <Skeleton className="mb-5 h-28 rounded-card" />
        <Card>
          <Skeleton className="mb-4 h-4 w-36" />
          <SkeletonText lines={5} />
        </Card>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader title={`Welcome back, ${user?.name?.split(' ')[0]}! 👋`} subtitle={dateLabel} />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard value={user?.streak || 0} label="Day streak 🔥" tone="brand" />
        <StatCard value={totalStandups} label="Standups" tone="positive" />
        <StatCard
          value={todayStandup ? MOOD_EMOJI[todayStandup.mood] : '—'}
          label="Today's mood"
          tone="neutral"
        />
      </div>

      {/* Today's status */}
      {!todayStandup ? (
        <motion.div
          variants={itemVariants}
          className="mb-5 overflow-hidden rounded-card border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/60 p-5 dark:border-amber-900 dark:from-amber-950/60 dark:to-amber-900/30 md:p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <motion.span
                aria-hidden="true"
                className="text-2xl"
                animate={{ rotate: [0, -12, 12, -8, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 3 }}
              >
                ⏰
              </motion.span>
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Today&apos;s standup is pending
                </p>
                <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">
                  It takes about two minutes
                </p>
              </div>
            </div>
            <Button to="/standup/new" className="shrink-0">
              Submit now →
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          variants={itemVariants}
          className="mb-5 rounded-card border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/50 md:p-6"
        >
          <div className="mb-2 flex items-center gap-2">
            <motion.span
              aria-hidden="true"
              className="text-lg"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 14 }}
            >
              ✅
            </motion.span>
            <p className="font-semibold text-emerald-900 dark:text-emerald-200">
              Today&apos;s standup is submitted
            </p>
          </div>
          <p className="text-sm text-emerald-800 dark:text-emerald-300">
            <span className="font-medium">Today&apos;s plan:</span> {todayStandup.today}
          </p>
          {todayStandup.hasBlocker && (
            <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
              <span className="font-medium">🚨 Blocker:</span> {todayStandup.blockers}
            </p>
          )}
        </motion.div>
      )}

      {/* Recent standups */}
      <Card>
        <CardTitle>Recent standups</CardTitle>

        {recentStandups.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="No standups yet"
            description="Submit your first one and start a streak."
            action={
              <Button to="/standup/new" size="sm">
                Submit your first standup
              </Button>
            }
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <>
            <div className="divide-y divide-line">
              {recentStandups.map((s, i) => (
                <motion.div
                  key={s._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span aria-hidden="true" className="shrink-0 text-xl">
                    {MOOD_EMOJI[s.mood]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="tabular text-xs text-content-subtle">{s.date}</span>
                      {s.hasBlocker && <Badge tone="danger">Blocker</Badge>}
                    </div>
                    <p className="truncate text-sm text-content-muted">{s.today}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <Link
              to="/history"
              className="mt-4 block text-center text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              View full history →
            </Link>
          </>
        )}
      </Card>
    </PageShell>
  )
}
