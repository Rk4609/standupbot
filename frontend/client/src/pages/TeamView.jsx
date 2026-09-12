import { useEffect, useState, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import API from '../api/axios'
import StandupCard from '../components/StandupCard'
import AiReport from '../components/AiReport'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Skeleton, { SkeletonCard } from '../components/ui/Skeleton'
import { Input } from '../components/ui/Field'
import { DURATION, EASE, itemVariants } from '../lib/motion'
import { streamAi } from '../lib/streamAi'
import { AI_MODEL_LABEL } from '../lib/ai'

const todayStr = () => new Date().toISOString().split('T')[0]

export default function TeamView() {
  const [standups, setStandups] = useState([])
  const [stats, setStats] = useState([])
  const [date, setDate] = useState(todayStr())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [aiResult, setAiResult] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [showAi, setShowAi] = useState(false)
  const abortRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    const fetchAll = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const [s, st] = await Promise.all([
          API.get(`/standups/team?date=${date}`),
          API.get('/standups/stats')
        ])
        if (cancelled) return
        setStandups(s.data)
        setStats(st.data)
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setLoadError(err.response?.data?.message || 'Could not load team data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    return () => {
      cancelled = true
    }
  }, [date])

  // Cancel an in-flight stream if the page unmounts
  useEffect(() => () => abortRef.current?.abort(), [])

  const analyzeTeam = async () => {
    if (standups.length === 0) {
      setAiError('No standups found for this date. Ask your team to submit first.')
      setShowAi(true)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setAiLoading(true)
    setAiResult('')
    setAiError('')
    setShowAi(true)

    try {
      await streamAi('/ai/analyze-team', { date }, {
        signal: controller.signal,
        onText: (chunk) => setAiResult(prev => prev + chunk),
        onError: (message) => setAiError(message)
      })
    } catch (err) {
      if (err.name !== 'AbortError') setAiError(err.message || 'Something went wrong')
    } finally {
      setAiLoading(false)
    }
  }

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(aiResult)
      toast.success('Report copied to clipboard 📋')
    } catch {
      toast.error('Copy failed — please select the text manually')
    }
  }

  const maxCount = Math.max(...stats.map(s => s.count), 0)

  return (
    <PageShell width="lg">
      <PageHeader
        title="Team dashboard 📊"
        subtitle="Daily submissions, participation and blockers at a glance"
        actions={
          <Button onClick={analyzeTeam} loading={aiLoading} disabled={aiLoading}>
            {aiLoading ? 'Analyzing…' : '🧠 Analyze with AI'}
          </Button>
        }
      />

      <AnimatePresence>
        {showAi && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.base, ease: EASE }}
            className="mb-5 overflow-hidden"
          >
            <AiReport
              title="AI team health analysis"
              text={aiResult}
              loading={aiLoading}
              error={aiError}
              footnote={AI_MODEL_LABEL}
              onClose={() => {
                abortRef.current?.abort()
                setShowAi(false)
                setAiResult('')
                setAiError('')
              }}
              onRegenerate={analyzeTeam}
              onCopy={copyReport}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Weekly participation */}
      <Card className="mb-5">
        <CardTitle>Weekly participation</CardTitle>
        {loading ? (
          <Skeleton className="h-[180px] w-full rounded-lg" />
        ) : maxCount === 0 ? (
          // With an all-zero series recharts draws an empty frame with no axis,
          // which reads as a broken chart rather than "no data"
          <div className="flex h-[180px] flex-col items-center justify-center text-center">
            <span aria-hidden="true" className="mb-2 text-2xl">
              📉
            </span>
            <p className="text-sm font-medium text-content">No submissions this week</p>
            <p className="mt-1 text-xs text-content-subtle">
              Participation shows up here once your team starts submitting.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats} margin={{ top: 4, right: 0, left: -22, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'rgb(var(--content-subtle))' }}
                tickFormatter={val => val.slice(5)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: 'rgb(var(--content-subtle))' }}
                width={30}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgb(var(--surface-sunken))' }}
                contentStyle={{
                  backgroundColor: 'rgb(var(--surface))',
                  border: '1px solid rgb(var(--line))',
                  borderRadius: '10px',
                  color: 'rgb(var(--content))',
                  fontSize: '12px',
                  boxShadow: '0 12px 32px -8px rgb(0 0 0 / 0.18)'
                }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} animationDuration={700}>
                {stats.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.count === maxCount && maxCount > 0 ? '#7c3aed' : '#c4b5fd'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Date filter */}
      <motion.div variants={itemVariants} className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-content-muted">Filter by date</label>
        <Input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-auto flex-1 py-2 sm:flex-none"
        />
        <span className="tabular text-sm text-content-muted">
          {standups.length} {standups.length === 1 ? 'submission' : 'submissions'}
        </span>
      </motion.div>

      {/* Standups */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1].map(i => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : loadError ? (
        <EmptyState icon="⚠️" tone="danger" title={loadError} />
      ) : standups.length === 0 ? (
        <EmptyState
          icon="🗓️"
          title="No standups for this date"
          description="Pick another date, or nudge your team to submit."
        />
      ) : (
        <motion.div layout className="space-y-3">
          <AnimatePresence mode="popLayout">
            {standups.map(s => (
              <motion.div
                key={s._id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: DURATION.base, ease: EASE }}
              >
                <StandupCard standup={s} showUser />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </PageShell>
  )
}
