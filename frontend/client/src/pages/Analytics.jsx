import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import EmptyState from '../components/ui/EmptyState'
import Skeleton from '../components/ui/Skeleton'
import { Select } from '../components/ui/Field'
import { IconAlert, IconChart } from '../components/ui/icons'
import { MOOD_EMOJI } from '../lib/moods'
import { cn } from '../lib/cn'
import { itemVariants, listVariants } from '../lib/motion'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'

const RANGES = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' }
]

const MOOD_LABEL = { 5: 'Great', 4: 'Good', 3: 'Okay', 2: 'Bad', 1: 'Stressed' }
/** Score to mood name, so the emoji lookup does not depend on key order. */
const MOOD_BY_SCORE = { 5: 'great', 4: 'good', 3: 'okay', 2: 'bad', 1: 'stressed' }
const MOOD_COLOR = {
  great: '#10b981',
  good: '#38bdf8',
  okay: '#f59e0b',
  bad: '#fb923c',
  stressed: '#ef4444'
}

/** Charts read their colours from the theme tokens so both modes work. */
const axisTick = { fontSize: 10, fill: 'rgb(var(--content-subtle))' }
const tooltipStyle = {
  backgroundColor: 'rgb(var(--surface-raised))',
  border: '1px solid rgb(var(--line))',
  borderRadius: '10px',
  color: 'rgb(var(--content))',
  fontSize: '12px',
  boxShadow: '0 12px 32px -8px rgb(0 0 0 / 0.18)'
}

const shortDate = (iso) => iso.slice(5)

function ChartCard({ title, subtitle, action, children, empty }) {
  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <CardTitle className="mb-0">{title}</CardTitle>
          {subtitle && <p className="mt-1 text-xs text-content-subtle">{subtitle}</p>}
        </div>
        {action}
      </div>
      {empty ? (
        <div className="flex h-[200px] flex-col items-center justify-center text-center">
          <IconChart className="mb-2.5 h-6 w-6 text-content-subtle" />
          <p className="text-sm text-content-muted">Not enough data for this range yet</p>
        </div>
      ) : (
        children
      )}
    </Card>
  )
}

export default function Analytics() {
  // Reload in place when something new may have happened — see liveRefresh
  const live = useLiveRefresh()
  const [days, setDays] = useState(30)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  // Held with the range that produced it, so "a newer range is loading" is
  // derived rather than tracked in a second piece of state
  const [loaded, setLoaded] = useState(null)

  useEffect(() => {
    let cancelled = false

    API.get('/analytics/overview', { params: { days } })
      .then(res => {
        if (cancelled) return
        setLoaded({ data: res.data, days })
        setError('')
      })
      .catch(err => {
        if (cancelled) return
        setError(apiErrorMessage(err, 'Could not load analytics'))
        setLoaded(prev => prev ?? { data: null, days })
      })

    return () => {
      cancelled = true
    }
  }, [days, live])

  const data = loaded?.data
  const loading = loaded === null || loaded.days !== days

  /**
   * The CSV needs the Authorization header, so it cannot be a plain link.
   * Fetch it as a blob and hand it to a temporary anchor instead.
   */
  const exportCsv = async () => {
    setExporting(true)
    try {
      const res = await API.get('/analytics/export', {
        params: { days },
        responseType: 'blob'
      })

      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `standups-last-${days}-days.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      toast.success('Export downloaded')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Export failed'))
    } finally {
      setExporting(false)
    }
  }

  const participation = useMemo(
    () =>
      (data?.daily || [])
        .filter(d => !d.weekend)
        .map(d => ({
          date: d.date,
          rate: d.expected ? Math.round((d.submissions / d.expected) * 100) : 0,
          submissions: d.submissions
        })),
    [data]
  )

  const moodTrend = useMemo(
    () => (data?.daily || []).filter(d => d.avgMood !== null).map(d => ({
      date: d.date,
      mood: d.avgMood
    })),
    [data]
  )

  const blockerTrend = useMemo(
    () => (data?.daily || []).filter(d => !d.weekend).map(d => ({
      date: d.date,
      blockers: d.blockers
    })),
    [data]
  )

  const moodSplit = useMemo(() => {
    const totals = data?.moodTotals || {}
    const sum = Object.values(totals).reduce((a, n) => a + n, 0)
    return Object.entries(totals).map(([mood, n]) => ({
      mood,
      n,
      pct: sum ? Math.round((n / sum) * 100) : 0
    }))
  }, [data])

  const rangeSelect = (
    <Select
      value={days}
      onChange={e => setDays(Number(e.target.value))}
      aria-label="Date range"
      className="py-2 text-sm"
    >
      {RANGES.map(r => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </Select>
  )

  if (loading && !data) {
    return (
      <PageShell>
        <Skeleton className="mb-2 h-9 w-52" />
        <Skeleton className="mb-7 h-4 w-72" />
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 rounded-card" />
          ))}
        </div>
        <Skeleton className="mb-4 h-72 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell>
        <PageHeader title="Analytics" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  const { headline, range, people, atRisk } = data

  return (
    <PageShell>
      <PageHeader
        title="Analytics"
        subtitle={`${range.from} to ${range.to} · ${range.workingDays} working days`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-40">{rangeSelect}</div>
            <Button variant="outline" onClick={exportCsv} loading={exporting}>
              Export CSV
            </Button>
          </div>
        }
      />

      <motion.div
        variants={listVariants}
        initial="initial"
        animate="animate"
        className={cn('transition-opacity', loading && 'opacity-60')}
      >
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            value={headline.participationRate}
            suffix="%"
            label="Participation"
            tone="brand"
          />
          <StatCard value={headline.submissions} label="Standups" tone="positive" />
          <StatCard value={headline.blockersRaised} label="Blockers raised" tone="warning" />
          <StatCard
            value={headline.avgMood?.toFixed(1) ?? '—'}
            label={headline.avgMood ? `Avg mood · ${MOOD_LABEL[Math.round(headline.avgMood)]}` : 'Avg mood'}
            tone="neutral"
          />
        </div>

        {/* Participation */}
        <motion.div variants={itemVariants} className="mb-4">
          <ChartCard
            title="Participation"
            subtitle="Share of the team submitting each working day. Weekends are excluded."
            empty={participation.length === 0}
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={participation} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="participationFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e9b20c" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#e9b20c" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  domain={[0, 100]}
                  unit="%"
                  tick={axisTick}
                  width={44}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) =>
                    name === 'rate' ? [`${value}%`, 'Participation'] : [value, 'Standups']
                  }
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#e9b20c"
                  strokeWidth={2}
                  fill="url(#participationFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </motion.div>

        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          {/* Mood trend */}
          <motion.div variants={itemVariants}>
            <ChartCard
              title="Mood"
              subtitle="Daily average, 1 stressed to 5 great. Days with no standups are skipped."
              empty={moodTrend.length === 0}
            >
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={moodTrend} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={axisTick}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    domain={[1, 5]}
                    ticks={[1, 2, 3, 4, 5]}
                    tickFormatter={v => MOOD_LABEL[v]}
                    tick={axisTick}
                    width={62}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={v => [`${v} · ${MOOD_LABEL[Math.round(v)]}`, 'Avg mood']}
                  />
                  <Line
                    type="monotone"
                    dataKey="mood"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </motion.div>

          {/* Blockers */}
          <motion.div variants={itemVariants}>
            <ChartCard
              title="Blockers raised"
              subtitle="Per working day across the range."
              empty={blockerTrend.length === 0}
            >
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={blockerTrend} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={axisTick}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis allowDecimals={false} tick={axisTick} width={30} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgb(var(--surface-sunken))' }}
                    contentStyle={tooltipStyle}
                    formatter={v => [v, 'Blockers']}
                  />
                  <Bar dataKey="blockers" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </motion.div>
        </div>

        {/* Mood split */}
        <motion.div variants={itemVariants} className="mb-4">
          <Card>
            <CardTitle>Mood distribution</CardTitle>
            {headline.submissions === 0 ? (
              <p className="py-6 text-center text-sm text-content-subtle">
                No standups in this range.
              </p>
            ) : (
              <>
                {/* One bar, split by proportion — easier to read than five bars */}
                <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-surface-sunken">
                  {moodSplit.map(m => (
                    m.n > 0 && (
                      <div
                        key={m.mood}
                        title={`${m.mood}: ${m.n} (${m.pct}%)`}
                        style={{ width: `${m.pct}%`, backgroundColor: MOOD_COLOR[m.mood] }}
                      />
                    )
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {moodSplit.map(m => (
                    <span key={m.mood} className="flex items-center gap-1.5 text-xs">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: MOOD_COLOR[m.mood] }}
                      />
                      <span aria-hidden="true">{MOOD_EMOJI[m.mood]}</span>
                      <span className="capitalize text-content-muted">{m.mood}</span>
                      <span className="tabular font-medium text-content">{m.pct}%</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </Card>
        </motion.div>

        {/* Needs attention */}
        <motion.div variants={itemVariants} className="mb-4">
          <Card>
            <CardTitle>Needs attention</CardTitle>
            {atRisk.length === 0 ? (
              <p className="py-4 text-sm text-content-muted">
                Nobody is flagged for this range.
              </p>
            ) : (
              <div className="space-y-2.5">
                {atRisk.slice(0, 8).map(p => (
                  <div
                    key={p._id}
                    className="flex flex-col gap-2 rounded-xl border-l-2 border-amber-500/70 bg-amber-500/[0.055] py-2.5 pl-3.5 pr-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-content">{p.name}</p>
                      <p className="mt-0.5 text-xs text-content-muted">
                        {p.risks.join(' · ')}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {p.avgMood !== null && (
                        <Badge tone="neutral">
                          {MOOD_EMOJI[MOOD_BY_SCORE[Math.round(p.avgMood)] || 'okay']}{' '}
                          {p.avgMood}
                        </Badge>
                      )}
                      <Badge tone="warning">{p.rate}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Per person */}
        <Card padded={false}>
          <div className="px-4 py-4 md:px-6">
            <CardTitle className="mb-0">By person</CardTitle>
          </div>

          <div className="hidden border-y border-line px-4 py-2.5 md:flex md:px-6">
            <span className="eyebrow flex-1">Name</span>
            <span className="eyebrow w-28">Team</span>
            <span className="eyebrow w-24 text-right">Standups</span>
            <span className="eyebrow w-20 text-right">Rate</span>
            <span className="eyebrow w-24 text-right">Avg mood</span>
            <span className="eyebrow w-20 text-right">Blockers</span>
          </div>

          <div className="divide-y divide-line border-t border-line md:border-t-0">
            {people.map(p => (
              <div
                key={p._id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 md:flex-nowrap md:px-6"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-content">{p.name}</span>
                  <span className="block truncate text-xs text-content-subtle md:hidden">
                    {p.team || 'Unassigned'}
                  </span>
                </span>
                <span className="w-28 shrink-0 truncate text-sm text-content-muted max-md:hidden">
                  {p.team || '—'}
                </span>
                <span className="tabular w-24 shrink-0 text-right text-sm text-content">
                  {p.submissions}
                </span>
                <span
                  className={cn(
                    'tabular w-20 shrink-0 text-right text-sm',
                    p.rate >= 80
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : p.rate >= 50
                        ? 'text-content-muted'
                        : 'text-amber-600 dark:text-amber-400'
                  )}
                >
                  {p.rate}%
                </span>
                <span className="tabular w-24 shrink-0 text-right text-sm text-content-muted">
                  {p.avgMood ?? '—'}
                </span>
                <span className="w-20 shrink-0 text-right">
                  {p.blockers > 0 ? (
                    <Badge tone="danger">{p.blockers}</Badge>
                  ) : (
                    <span className="text-sm text-content-subtle">—</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </PageShell>
  )
}
