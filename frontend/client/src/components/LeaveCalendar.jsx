import { useEffect, useState } from 'react'
import API from '../api/axios'
import Card, { CardTitle } from './ui/Card'
import Badge from './ui/Badge'
import Skeleton from './ui/Skeleton'
import { cn } from '../lib/cn'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { STATUS_LABEL, TYPE_DOT, TYPE_LABEL, addDays, isWeekend } from '../lib/leave'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** The first of the month either side of this one. */
const shiftMonth = (month, by) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return d.toISOString().slice(0, 7)
}

const monthName = (month) =>
  new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString(undefined, {
    month: 'long', year: 'numeric', timeZone: 'UTC'
  })

const longDay = (iso) =>
  new Date(`${iso}T00:00:00.000Z`).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC'
  })

/** Every day on the grid: the month, padded out to whole Monday-first weeks. */
const gridFor = (first, last) => {
  const lead = (new Date(`${first}T00:00:00.000Z`).getUTCDay() + 6) % 7
  const start = addDays(first, -lead)
  const days = []
  for (let day = start; day <= last || days.length % 7 !== 0; day = addDays(day, 1)) {
    days.push(day)
  }
  return days
}

const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')

/**
 * Who is away, a month at a time.
 *
 * Tapping a day lists the people off on it. A waiting request is drawn
 * hollow, so somebody deciding can see it would clash before saying yes.
 */
export default function LeaveCalendar({ title = 'Who is away', refreshKey = 0 }) {
  const live = useLiveRefresh()
  const [month, setMonth] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState(null)

  useEffect(() => {
    let current = true
    API.get('/leave/calendar', { params: month ? { month } : {} })
      .then(res => {
        if (!current) return
        setData(res.data)
        setError('')
      })
      .catch(err => current && setError(apiErrorMessage(err, 'Could not load the calendar')))
    return () => { current = false }
  }, [month, live, refreshKey])

  if (error && !data) {
    return (
      <Card>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </Card>
    )
  }

  if (!data) return <Skeleton className="h-96 rounded-card" />

  const shown = data.month
  const days = gridFor(data.first, data.last)
  const onDay = (day) => data.entries.filter(e => e.from <= day && e.to >= day && !isWeekend(day))

  const selected = picked && picked.startsWith(shown)
    ? picked
    : data.today.startsWith(shown) ? data.today : data.first
  const away = onDay(selected)

  return (
    <Card padded={false}>
      <div className="flex items-center justify-between gap-3 px-4 pt-4 md:px-6 md:pt-5">
        <div>
          <CardTitle className="mb-0">{title}</CardTitle>
          <p className="mt-0.5 text-xs text-content-subtle">{monthName(shown)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(shown, -1))}
            aria-label="Previous month"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-content-muted transition-colors hover:text-content"
          >
            ‹
          </button>
          {!data.today.startsWith(shown) && (
            <button
              type="button"
              onClick={() => { setMonth(data.today.slice(0, 7)); setPicked(data.today) }}
              className="rounded-full border border-line px-3 py-1.5 text-xs text-content-muted transition-colors hover:text-content"
            >
              Today
            </button>
          )}
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(shown, 1))}
            aria-label="Next month"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-content-muted transition-colors hover:text-content"
          >
            ›
          </button>
        </div>
      </div>

      <div className="px-2 pt-4 md:px-5">
        <div className="grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-content-subtle">
          {WEEKDAYS.map(d => <div key={d} className="pb-2">{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const inMonth = day.startsWith(shown)
            const people = inMonth ? onDay(day) : []
            const isToday = day === data.today
            const isPicked = day === selected

            return (
              <button
                key={day}
                type="button"
                disabled={!inMonth}
                onClick={() => setPicked(day)}
                aria-pressed={isPicked}
                aria-label={`${longDay(day)}${people.length ? `, ${people.length} away` : ''}`}
                className={cn(
                  'flex min-h-[52px] flex-col items-center gap-1 rounded-xl px-0.5 py-1.5 text-xs transition-colors md:min-h-[64px]',
                  !inMonth && 'invisible',
                  isWeekend(day) && 'text-content-subtle',
                  isPicked
                    ? 'bg-brand-600 text-white dark:bg-brand-400 dark:text-brand-700'
                    : 'hover:bg-surface-sunken'
                )}
              >
                <span
                  className={cn(
                    'tabular flex h-6 w-6 items-center justify-center rounded-full',
                    isToday && !isPicked && 'bg-brand-100 font-semibold text-brand-700 dark:bg-brand-400/20 dark:text-brand-300'
                  )}
                >
                  {Number(day.slice(8))}
                </span>

                {people.length > 0 && (
                  <span className="flex flex-wrap items-center justify-center gap-0.5">
                    {people.slice(0, 3).map(p => (
                      <span
                        key={p._id}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          p.status === 'pending'
                            ? 'border border-current bg-transparent'
                            : isPicked ? 'bg-white dark:bg-brand-700' : TYPE_DOT[p.type]
                        )}
                      />
                    ))}
                    {people.length > 3 && (
                      <span className="text-[9px] leading-none">+{people.length - 3}</span>
                    )}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-3 border-t border-line px-4 py-4 md:px-6">
        <p className="eyebrow">{longDay(selected)}</p>

        {isWeekend(selected) ? (
          <p className="mt-2 text-sm text-content-subtle">Weekend.</p>
        ) : away.length === 0 ? (
          <p className="mt-2 text-sm text-content-subtle">Everybody is in.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {away.map(p => (
              <li key={p._id} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[11px] font-semibold text-content-muted">
                  {initials(p.userName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-content">
                    {p.userName}{p.mine && <span className="text-content-subtle"> (you)</span>}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-content-subtle">
                    <span className={cn('h-1.5 w-1.5 rounded-full', TYPE_DOT[p.type])} />
                    {TYPE_LABEL[p.type]}{p.halfDay ? ' · half day' : ''}
                  </p>
                </div>
                {p.status === 'pending' && <Badge tone="warning">{STATUS_LABEL.pending}</Badge>}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-content-subtle">
          {Object.entries(TYPE_LABEL).map(([type, label]) => (
            <span key={type} className="flex items-center gap-1.5">
              <span className={cn('h-1.5 w-1.5 rounded-full', TYPE_DOT[type])} />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full border border-current" />
            Waiting
          </span>
        </div>
      </div>
    </Card>
  )
}
