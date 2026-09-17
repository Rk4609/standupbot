import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'
import StatCard from '../components/ui/StatCard'
import EmptyState from '../components/ui/EmptyState'
import { IconAlert } from '../components/ui/icons'
import { cn } from '../lib/cn'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { STATE_CELL, STATE_LABEL, STATE_TONE, duration, minutesSince } from '../lib/attendance'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const shiftMonth = (month, by) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7)
}

const monthName = (month) =>
  new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString(undefined, {
    month: 'long', year: 'numeric', timeZone: 'UTC'
  })

const longDay = (iso) =>
  new Date(`${iso}T00:00:00.000Z`).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC'
  })

/** The clock, ticking, as it reads where this person works. */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

/** Today: the clock, where I am in the day, and the one button that matters. */
function TodayCard({ data, onChanged }) {
  const now = useNow()
  const [busy, setBusy] = useState(false)
  const record = data.todayRecord
  const leave = data.todayLeave

  const clock = new Date(now).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: data.timezone
  })
  const date = new Date(now).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: data.timezone
  })

  const act = async (path) => {
    setBusy(true)
    try {
      const { data: res } = await API.post(`/attendance/${path}`, {})
      toast.success(res.message)
      onChanged()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'That did not go through'))
    } finally {
      setBusy(false)
    }
  }

  let status
  if (record?.checkOut) {
    status = `Checked out at ${record.outAt} · ${duration(record.minutes)} today`
  } else if (record) {
    status = `In since ${record.inAt} · ${duration(minutesSince(record.checkIn, now))} so far`
  } else if (leave && !leave.halfDay) {
    status = 'You are on leave today. Enjoy it.'
  } else {
    status = `Office starts at ${data.policy.start}, with ${data.policy.graceMinutes} minutes' grace.`
  }

  const fullDayLeave = leave && !leave.halfDay

  return (
    // Not a Card: its own surface colour would sit under this one, and class
    // order — not intent — would decide which shows
    <div className="mb-5 overflow-hidden rounded-card bg-brand-600 p-5 text-white shadow-card dark:bg-surface-raised dark:text-content md:p-7">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.14em] text-white/60 dark:text-content-subtle">{date}</p>
          <p className="tabular mt-1 text-5xl font-light tracking-tight md:text-hero" aria-live="off">
            {clock}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="text-sm text-white/80 dark:text-content-muted">{status}</p>
            {record?.late && <Badge tone="warning">{record.lateBy} min late</Badge>}
            {leave?.halfDay && <Badge tone="info">Half day off</Badge>}
          </div>
          {!data.timezoneSet && (
            <p className="mt-2 text-xs text-white/60 dark:text-content-subtle">
              Times are in UTC until you{' '}
              <Link to="/profile" className="underline underline-offset-2">set your timezone</Link>.
            </p>
          )}
        </div>

        {!record?.checkOut && !fullDayLeave && (
          <button
            type="button"
            disabled={busy}
            onClick={() => act(record ? 'check-out' : 'check-in')}
            className={cn(
              'group flex h-32 w-32 shrink-0 flex-col items-center justify-center self-center rounded-full text-sm font-semibold shadow-pop transition-transform active:scale-95 disabled:opacity-60 md:h-36 md:w-36',
              record
                ? 'bg-white text-brand-700 dark:bg-brand-400 dark:text-brand-700'
                : 'bg-brand-400 text-brand-700 ring-8 ring-brand-400/25'
            )}
          >
            <span className="text-2xl leading-none">{record ? '⏏' : '●'}</span>
            <span className="mt-2">{busy ? 'One moment…' : record ? 'Check out' : 'Check in'}</span>
          </button>
        )}

        {record?.checkOut && (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center self-center rounded-full bg-white/10 text-center text-xs text-white/80 dark:bg-surface-sunken dark:text-content-muted">
            Done for<br />today
          </div>
        )}
      </div>
    </div>
  )
}

/** Tap a day for what happened on it. */
function DayDetail({ day }) {
  const r = day.record
  return (
    <div className="border-t border-line px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">{longDay(day.date)}</p>
        {STATE_LABEL[day.state] && <Badge tone={STATE_TONE[day.state]}>{STATE_LABEL[day.state]}</Badge>}
      </div>

      {r ? (
        <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-content-subtle">In</dt>
            <dd className="tabular text-content">{r.inAt}{r.late && <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">+{r.lateBy}m</span>}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-subtle">Out</dt>
            <dd className="tabular text-content">{r.outAt || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-subtle">Worked</dt>
            <dd className="tabular text-content">{duration(r.minutes)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-sm text-content-subtle">
          {day.leave ? `On ${day.leave.type} leave${day.leave.halfDay ? ' for half the day' : ''}.`
            : day.state === 'absent' ? 'No check-in on a working day.'
              : day.state === 'untracked' ? 'Before attendance was kept for you.'
                : day.state === 'weekend' ? 'Weekend.'
                  : 'Nothing yet.'}
        </p>
      )}

      {r?.corrected && (
        <p className="mt-2 text-xs text-content-subtle">
          Corrected by {r.corrected.byName}: {r.corrected.reason}
        </p>
      )}
    </div>
  )
}

/**
 * My attendance: check in, check out, and how the month went.
 */
export default function Attendance() {
  const live = useLiveRefresh()
  const [month, setMonth] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState(null)

  const load = useCallback(() =>
    API.get('/attendance/me', { params: month ? { month } : {} })
      .then(res => {
        setData(res.data)
        setError('')
      })
      .catch(err => setError(apiErrorMessage(err, 'Could not load your attendance'))), [month])

  useEffect(() => {
    load()
  }, [load, live])

  if (error && !data) {
    return (
      <PageShell>
        <PageHeader title="Attendance" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell>
        <Skeleton className="mb-2 h-9 w-48" />
        <Skeleton className="mb-7 h-4 w-72" />
        <Skeleton className="mb-5 h-48 rounded-card" />
        <Skeleton className="h-96 rounded-card" />
      </PageShell>
    )
  }

  const { summary } = data
  const lead = (new Date(`${data.days[0].date}T00:00:00.000Z`).getUTCDay() + 6) % 7
  const selectedDate = picked?.startsWith(data.month)
    ? picked
    : data.today.startsWith(data.month) ? data.today : data.days[0].date
  const selected = data.days.find(d => d.date === selectedDate)

  return (
    <PageShell>
      <PageHeader
        title="Attendance"
        subtitle={`Office starts at ${data.policy.start} · ${data.policy.graceMinutes} min grace · ${data.policy.fullDayHours}h day`}
      />

      <TodayCard data={data} onChanged={load} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 md:gap-4">
        <StatCard value={summary.present} label="Days present" tone="positive" />
        <StatCard value={summary.late} label="Late" tone="warning" />
        <StatCard value={summary.absent} label="Absent" tone="danger" />
        {/* Half days make this 1.5; the counter would round it */}
        <StatCard
          value={Number.isInteger(summary.leaveDays) ? summary.leaveDays : String(summary.leaveDays)}
          label="On leave"
          tone="neutral"
        />
        <StatCard
          value={summary.averageMinutes === null ? '—' : duration(summary.averageMinutes)}
          label={summary.onTime === null ? 'Average day' : `Average day · ${summary.onTime}% on time`}
          tone="brand"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <Card padded={false}>
        <div className="flex items-center justify-between gap-3 px-4 pt-4 md:px-6 md:pt-5">
          <div>
            <CardTitle className="mb-0">{monthName(data.month)}</CardTitle>
            {summary.noCheckout > 0 && (
              <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                {summary.noCheckout} {summary.noCheckout === 1 ? 'day has' : 'days have'} no check-out — ask your manager to fix it
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth(shiftMonth(data.month, -1))}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-content-muted hover:text-content"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next month"
              disabled={data.month >= data.today.slice(0, 7)}
              onClick={() => setMonth(shiftMonth(data.month, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-content-muted hover:text-content disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>

        <div className="px-2 pb-3 pt-4 md:px-5">
          <div className="grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-content-subtle">
            {WEEKDAYS.map(d => <div key={d} className="pb-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: lead }, (_, i) => <div key={`pad${i}`} />)}
            {data.days.map(day => (
              <button
                key={day.date}
                type="button"
                onClick={() => setPicked(day.date)}
                aria-pressed={day.date === selectedDate}
                aria-label={`${longDay(day.date)}${STATE_LABEL[day.state] ? `, ${STATE_LABEL[day.state]}` : ''}`}
                className={cn(
                  'relative flex min-h-[48px] flex-col items-center justify-center rounded-xl text-xs transition-shadow md:min-h-[60px]',
                  STATE_CELL[day.state],
                  day.date === selectedDate && 'ring-2 ring-brand-600 dark:ring-brand-400'
                )}
              >
                <span className="tabular font-medium">{Number(day.date.slice(8))}</span>
                {day.record?.minutes != null && (
                  <span className="tabular mt-0.5 hidden text-[10px] opacity-80 sm:block">
                    {duration(day.record.minutes)}
                  </span>
                )}
                {day.record?.late && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                )}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-2 text-[11px] text-content-subtle">
            {['present', 'half-day', 'no-checkout', 'leave', 'absent'].map(state => (
              <span key={state} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded', STATE_CELL[state])} />
                {STATE_LABEL[state]}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Late
            </span>
          </div>
        </div>

        {selected && <DayDetail day={selected} />}
      </Card>
    </PageShell>
  )
}
