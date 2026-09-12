import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import AiReport from '../components/AiReport'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import EmptyState from '../components/ui/EmptyState'
import Skeleton from '../components/ui/Skeleton'
import { cn } from '../lib/cn'
import { DURATION, EASE, SPRING, itemVariants } from '../lib/motion'
import { streamAi } from '../lib/streamAi'
import { AI_MODEL_LABEL } from '../lib/ai'
import { IconAlert, IconCalendar, IconPrinter, IconRefresh, IconSparkles } from '../components/ui/icons'

const loadCurrent = () => API.get('/retro/current').then(r => r.data)
const loadHistory = () => API.get('/retro').then(r => r.data)

/** Compare week deltas against the previous saved retro. */
function Delta({ current, previous, suffix = '' }) {
  if (previous == null || current == null || current === previous) return null
  const diff = current - previous
  const up = diff > 0

  return (
    <span
      className={cn(
        'ml-1 text-xs font-semibold',
        up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
      )}
    >
      {up ? '↑' : '↓'}
      {Math.abs(diff)}
      {suffix}
    </span>
  )
}

export default function Retro() {
  const [week, setWeek] = useState(null)
  const [saved, setSaved] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [text, setText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [viewing, setViewing] = useState(null) // a past retro, or null for current

  const abortRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([loadCurrent(), loadHistory()])
      .then(([current, past]) => {
        if (cancelled) return
        setWeek(current.week)
        setSaved(current.retro)
        setText(current.retro?.content || '')
        setHistory(past)
      })
      .catch(err => {
        console.error(err)
        if (!cancelled) setLoadError(err.response?.data?.message || 'Could not load retros')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => () => abortRef.current?.abort(), [])

  const generate = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setViewing(null)
    setStreaming(true)
    setText('')
    setError('')

    try {
      await streamAi('/retro/generate', { weekStart: week?.weekStart }, {
        signal: controller.signal,
        onText: chunk => setText(prev => prev + chunk),
        onError: message => setError(message)
      })

      // The server persists on completion — pull the saved copy back for stats
      const current = await loadCurrent()
      setSaved(current.retro)
      setHistory(await loadHistory())
      toast.success('Retro generated')
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || 'Retro generation failed')
    } finally {
      setStreaming(false)
    }
  }

  const active = viewing || saved
  const shownText = viewing ? viewing.content : text
  const stats = active?.stats

  // The retro saved immediately before the one on screen (history is newest-first)
  const previousStats = (() => {
    const idx = history.findIndex(r => r._id === active?._id)
    return idx >= 0 && history[idx + 1] ? history[idx + 1].stats : null
  })()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shownText)
      toast.success('Retro copied to clipboard')
    } catch {
      toast.error('Copy failed — please select the text manually')
    }
  }

  if (loading) {
    return (
      <PageShell width="lg">
        <Skeleton className="mb-6 h-8 w-64" />
        <div className="mb-5 grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-20 rounded-card" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-card" />
      </PageShell>
    )
  }

  if (loadError) {
    return (
      <PageShell width="lg">
        <PageHeader title="Weekly retro" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={loadError} />
      </PageShell>
    )
  }

  return (
    <PageShell width="lg">
      <PageHeader
        title="Weekly retro"
        subtitle={
          viewing
            ? `Viewing ${viewing.weekLabel}`
            : `${week?.weekLabel} · generated automatically every Friday evening`
        }
        actions={
          <div className="no-print flex flex-wrap gap-2">
            {shownText && (
              <Button variant="outline" onClick={() => window.print()}>
                <IconPrinter className="h-3.5 w-3.5" />
                Save as PDF
              </Button>
            )}
            <Button onClick={generate} loading={streaming} disabled={streaming}>
              {streaming ? (
                'Generating…'
              ) : (
                <>
                  {saved || viewing ? (
                    <IconRefresh className="h-4 w-4" />
                  ) : (
                    <IconSparkles className="h-4 w-4" />
                  )}
                  {saved || viewing ? 'Regenerate' : 'Generate retro'}
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* Week stats */}
      {stats && (
        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="relative">
            <StatCard value={stats.submissions} label="Submissions" tone="brand" />
            <span className="absolute right-3 top-3">
              <Delta current={stats.submissions} previous={previousStats?.submissions} />
            </span>
          </div>
          <div className="relative">
            <StatCard
              value={stats.participationRate}
              suffix="%"
              label="Participation"
              tone="positive"
            />
            <span className="absolute right-3 top-3">
              <Delta
                current={stats.participationRate}
                previous={previousStats?.participationRate}
                suffix="%"
              />
            </span>
          </div>
          <StatCard value={stats.blockerCount} label="Blockers raised" tone="danger" />
        </div>
      )}

      {/* Viewing a past week */}
      <AnimatePresence>
        {viewing && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="no-print mb-4 flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-900 dark:bg-brand-950/50"
          >
            <p className="text-sm text-brand-800 dark:text-brand-300">
              Viewing an archived retro from <strong>{viewing.weekLabel}</strong>
            </p>
            <Button size="xs" variant="subtle" onClick={() => setViewing(null)}>
              Back to this week
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report */}
      {shownText || streaming || error ? (
        <motion.div variants={itemVariants} className="mb-5">
          <AiReport
            title={viewing ? viewing.weekLabel : week?.weekLabel || 'This week'}
            text={shownText}
            loading={streaming}
            error={error}
            scroll={false}
            className="print-plain"
            footnote={
              active?.createdAt
                ? `Generated ${new Date(active.createdAt).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })} · ${AI_MODEL_LABEL}`
                : AI_MODEL_LABEL
            }
            onCopy={copy}
            onRegenerate={viewing ? undefined : generate}
          />
        </motion.div>
      ) : (
        <EmptyState
          icon={<IconCalendar className="h-6 w-6" />}
          title="No retro for this week yet"
          description="It generates automatically on Friday evening — or create it now from the standups submitted so far."
          action={
            <Button onClick={generate} loading={streaming}>
              <IconSparkles className="h-4 w-4" />
              Generate retro
            </Button>
          }
          className="mb-5"
        />
      )}

      {/* Archive */}
      {history.length > 0 && (
        <Card className="no-print">
          <CardTitle>Past weeks</CardTitle>
          <div className="space-y-2">
            {history.map((r, i) => {
              const isActive = active?._id === r._id
              return (
                <motion.button
                  key={r._id}
                  onClick={() => {
                    setViewing(r.weekStart === week?.weekStart ? null : r)
                    setError('')
                  }}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.04, duration: DURATION.base, ease: EASE }}
                  whileTap={{ scale: 0.99 }}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                    isActive
                      ? 'border-brand-300 bg-brand-50 dark:border-brand-800 dark:bg-brand-950/50'
                      : 'border-line bg-surface-sunken hover:border-brand-200 dark:hover:border-brand-900'
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-content">{r.weekLabel}</p>
                    <p className="mt-0.5 text-xs text-content-subtle">
                      {r.stats?.submissions ?? 0} submissions · {r.stats?.participationRate ?? 0}%
                      participation
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.stats?.blockerCount > 0 && (
                      <Badge tone="danger">{r.stats.blockerCount} blockers</Badge>
                    )}
                    {r.weekStart === week?.weekStart && <Badge tone="brand">This week</Badge>}
                    <motion.span
                      aria-hidden="true"
                      className="text-content-subtle"
                      animate={{ x: isActive ? 2 : 0 }}
                      transition={SPRING}
                    >
                      →
                    </motion.span>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </Card>
      )}
    </PageShell>
  )
}
