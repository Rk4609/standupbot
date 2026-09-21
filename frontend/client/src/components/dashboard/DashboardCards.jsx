import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { IconAlert, IconCheck, IconPencil } from '../ui/icons'
import { cn } from '../../lib/cn'
import { collapseVariants, EASE } from '../../lib/motion'
import { MOOD_EMOJI } from '../../lib/moods'
import { prettyDate } from '../../lib/dates'
import {
  dayOfMonth, hoursLabel, monthName, monthYear, weekdayShort
} from '../../lib/week'

const TYPE_LABEL = {
  intern: 'Intern',
  probation: 'On probation',
  'full-time': 'Full time',
  contract: 'Contract'
}

/** The small round arrow in a card's corner that opens the full page. */
function CornerLink({ to, label }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface-raised text-content-muted transition-colors hover:text-content"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5">
        <path d="M5 11l6-6M6 5h5v5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}

function CardHead({ title, to, label, children }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <h2 className="text-lg tracking-tight text-content">{title}</h2>
      {children}
      {to && <CornerLink to={to} label={label} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Who is signed in, the way the design leads with a person rather than a
 * number. A photo when there is one; otherwise their initial, large and quiet.
 */
export function ProfileCard({ profile, user }) {
  const who = profile || user || {}
  const job = who.employment || {}
  const initials = (who.name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join('')
  const chip = job.type && job.type !== 'full-time'
    ? TYPE_LABEL[job.type]
    : who.team?.name || TYPE_LABEL[job.type] || null

  return (
    <Card padded={false} className="relative min-h-[15.5rem] overflow-hidden">
      {who.avatar ? (
        <img src={who.avatar} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-[#ece7d9] via-[#ddd5bf] to-[#f3cf5a] dark:from-[#2c2b27] dark:via-[#24231f] dark:to-[#4a3d17]"
        >
          <span className="absolute inset-0 flex items-center justify-center pb-12 text-[5.5rem] font-light leading-none tracking-tight text-brand-700/20 dark:text-brand-300/25">
            {initials}
          </span>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 pt-20">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg tracking-tight text-white">{who.name}</p>
            <p className="truncate text-xs text-white/70">
              {job.position || (who.roleName || who.role || '').replace(/^\w/, c => c.toUpperCase())}
            </p>
          </div>
          {chip && (
            <span className="shrink-0 rounded-full border border-white/40 bg-white/15 px-3 py-1 text-xs text-white backdrop-blur-sm">
              {chip}
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

/** Hours worked per day this week, from attendance, as the design's Progress bars. */
export function WeekBars({ dates, perDay, total, today }) {
  const peak = Math.max(8, ...dates.map(d => perDay?.[d] || 0))

  return (
    <Card className="flex min-h-[15.5rem] flex-col">
      <CardHead title="Progress" to="/attendance" label="Open your attendance" />

      <div className="mt-2 flex items-end gap-2">
        <span className="tabular text-[2.5rem] font-extralight leading-none tracking-tight text-content">
          {hoursLabel(total)}
          <span className="ml-0.5 text-lg">h</span>
        </span>
        <span className="pb-1 text-[11px] leading-tight text-content-subtle">
          Worked
          <br />
          this week
        </span>
      </div>

      <div className="mt-auto flex items-end justify-between gap-1 pt-6">
        {dates.map(date => {
          const hours = perDay?.[date] || 0
          const isToday = date === today
          const height = hours ? Math.max(10, (hours / peak) * 100) : 0

          return (
            <div key={date} className="relative flex flex-1 flex-col items-center gap-2">
              <div className="relative flex h-20 w-full items-end justify-center">
                {isToday && hours > 0 && (
                  <span className="absolute -top-5 z-10 whitespace-nowrap rounded-full bg-brand-400 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                    {hoursLabel(hours)}h
                  </span>
                )}
                {hours > 0 ? (
                  <motion.span
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.6, ease: EASE }}
                    title={`${hoursLabel(hours)} hours`}
                    className={cn(
                      'block w-1.5 rounded-full',
                      isToday ? 'bg-brand-400' : 'bg-content'
                    )}
                  />
                ) : (
                  <span className="block h-1.5 w-1.5 rounded-full bg-content/20" />
                )}
              </div>
              <span
                className={cn(
                  'text-[11px]',
                  isToday ? 'font-medium text-content' : 'text-content-subtle'
                )}
              >
                {weekdayShort(date).charAt(0)}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Today's hours against a full working day, drawn as the design's
 * time-tracker ring. It is not a running clock: it is the time from today's
 * check-in to the check-out, or to when the page was loaded if still in.
 */
export function TodayRing({ hours, standup, onEdit, target = 8 }) {
  const share = Math.min((hours || 0) / target, 1)
  const radius = 52
  const circumference = 2 * Math.PI * radius

  return (
    <Card className="flex min-h-[15.5rem] flex-col">
      <CardHead title="Today" to="/standup/new" label="Open today's standup" />

      <div className="relative mx-auto mt-2 h-36 w-36">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle
            cx="64" cy="64" r={radius}
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeDasharray="1.5 5"
            className="text-content/30"
          />
          <motion.circle
            cx="64" cy="64" r={radius}
            fill="none" strokeWidth="9" strokeLinecap="round"
            stroke="currentColor"
            className="text-brand-400"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - share) }}
            transition={{ duration: 0.9, ease: EASE }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-3xl font-extralight tracking-tight text-content">
            {hoursLabel(hours)}h
          </span>
          <span className="text-[11px] text-content-subtle">of {target}h worked</span>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        {standup ? (
          <>
            <span className="flex items-center gap-2 text-xs text-content-muted">
              <span className="text-lg" aria-hidden="true">{MOOD_EMOJI[standup.mood]}</span>
              Standup in
            </span>
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit today's standup"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700 dark:bg-brand-400 dark:text-brand-700"
            >
              <IconPencil className="h-4 w-4" />
            </button>
          </>
        ) : (
          <Button to="/standup/new" size="sm" full>
            Submit today&apos;s standup
          </Button>
        )}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

/** One labelled segment of a segmented bar. */
function Segment({ share, label, value, className, children }) {
  return (
    // A floor on the width, so a segment worth nothing this week still has
    // room for its label instead of collapsing to "D…"
    <div className="min-w-0" style={{ flex: `${Math.max(share, 0.24)} 1 0%` }}>
      <p className="mb-1.5 truncate text-[11px] text-content-muted">
        {label}
        {value !== undefined && <span className="ml-1 text-content-subtle">{value}</span>}
      </p>
      <div className={cn('flex h-10 items-center rounded-xl px-3 text-xs', className)}>
        {children}
      </div>
    </div>
  )
}

/**
 * The design's Onboarding card. For somebody on an internship or probation it
 * is exactly that — how far through the window they are. For everybody else
 * it is the same shape applied to this week's standups.
 */
export function WindowCard({ employment, dates, submitted, today }) {
  const start = employment?.startsOn ? new Date(employment.startsOn) : null
  const end = employment?.endsOn ? new Date(employment.endsOn) : null
  const temporary = ['intern', 'probation'].includes(employment?.type) && start && end && end > start

  if (temporary) {
    // Measured from the page's own "today", not the clock at render time,
    // so the card says the same thing however often it re-renders
    const now = new Date(`${today}T12:00:00Z`)
    const done = Math.min(Math.max((now - start) / (end - start), 0), 1)
    const daysLeft = Math.max(0, Math.ceil((end - now) / 86_400_000))
    const pct = Math.round(done * 100)
    const finished = daysLeft === 0

    return (
      <Card className="flex min-h-[15.5rem] flex-col">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg tracking-tight text-content">
            {employment.type === 'intern' ? 'Internship' : 'Probation'}
          </h2>
          <span className="tabular text-[2.5rem] font-extralight leading-none tracking-tight text-content">
            {pct}%
          </span>
        </div>

        <div className="mt-auto flex gap-1.5 pt-6">
          {finished ? (
            <Segment share={1} label="Complete" className="bg-brand-400 text-brand-700">
              Window finished
            </Segment>
          ) : (
            <>
              <Segment share={done} label="Done" value={`${pct}%`} className="bg-brand-400 text-brand-700">
                So far
              </Segment>
              <Segment
                share={1 - done}
                label="Left"
                value={`${100 - pct}%`}
                className="bg-brand-600 text-white dark:bg-surface-sunken dark:text-content"
              >
                {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
              </Segment>
            </>
          )}
        </div>

        <p className="mt-3 text-xs text-content-subtle">
          {finished ? 'Ended' : 'Ends'} {prettyDate(employment.endsOn)}
        </p>
      </Card>
    )
  }

  // Today counts once it is filed; until then it is still due, not missed
  const before = dates.filter(d => d < today)
  const filedToday = dates.includes(today) && submitted.has(today)
  const done = before.filter(d => submitted.has(d)).length + (filedToday ? 1 : 0)
  const missed = before.filter(d => !submitted.has(d)).length
  const upcoming = dates.length - done - missed
  const counted = before.length + (filedToday ? 1 : 0)
  const pct = counted ? Math.round((done / counted) * 100) : 0

  return (
    <Card className="flex min-h-[15.5rem] flex-col">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg tracking-tight text-content">This week</h2>
        <span className="tabular text-[2.5rem] font-extralight leading-none tracking-tight text-content">
          {pct}%
        </span>
      </div>
      <p className="mt-1 text-xs text-content-subtle">Standups on the days so far</p>

      <div className="mt-auto flex gap-1.5 pt-6">
        <Segment share={done / 5} label="Done" value={done} className="bg-brand-400 text-brand-700">
          {done ? 'Filed' : ''}
        </Segment>
        <Segment
          share={missed / 5}
          label="Missed"
          value={missed}
          className="bg-brand-600 text-white dark:bg-surface-sunken dark:text-content"
        />
        <Segment
          share={upcoming / 5}
          label="Ahead"
          value={upcoming}
          className="bg-content/15"
        />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

/**
 * The dark task list from the design, as the week's standups: done, missed,
 * due today, still to come.
 */
export function WeekChecklist({ dates, byDate, today }) {
  const done = dates.filter(d => byDate.has(d)).length

  return (
    <Card className="flex flex-col !border-transparent !bg-brand-600 text-white dark:!bg-surface-raised">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg tracking-tight">Standups</h2>
        <span className="tabular text-[2.5rem] font-extralight leading-none tracking-tight">
          {done}/{dates.length}
        </span>
      </div>

      <ul className="mt-5 space-y-3">
        {dates.map(date => {
          const standup = byDate.get(date)
          const isToday = date === today
          const future = date > today

          return (
            <li key={date} className="flex items-center gap-3">
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  standup ? 'bg-white/10 text-white/60' : 'bg-white text-brand-700'
                )}
              >
                {standup?.hasBlocker ? (
                  <IconAlert className="h-4 w-4" />
                ) : (
                  <IconPencil className="h-4 w-4" />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block truncate text-sm',
                    standup ? 'text-white/50 line-through decoration-white/40' : 'text-white'
                  )}
                >
                  {weekdayShort(date)} standup
                </span>
                <span className="block truncate text-[11px] text-white/45">
                  {standup
                    ? standup.today
                    : isToday
                      ? 'Due today'
                      : future
                        ? prettyDate(`${date}T00:00:00Z`)
                        : 'Not filed'}
                </span>
              </span>

              {standup ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-400 text-brand-700">
                  <IconCheck className="h-3 w-3" />
                </span>
              ) : isToday ? (
                <span className="h-5 w-5 shrink-0 rounded-full border-2 border-brand-400" />
              ) : (
                <span
                  className={cn(
                    'h-2.5 w-2.5 shrink-0 rounded-full',
                    future ? 'bg-white/25' : 'bg-red-400/80'
                  )}
                  title={future ? 'Still to come' : 'Not filed'}
                />
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

/** The design's accordion, holding the things worth a glance but not a card. */
export function DetailsAccordion({ items }) {
  const [open, setOpen] = useState(items[0]?.id || null)

  return (
    <Card padded={false} className="px-4 py-2 md:px-5">
      <ul className="divide-y divide-dashed divide-line">
        {items.map(item => {
          const isOpen = open === item.id

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : item.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 py-3.5 text-left"
              >
                <span className="text-sm text-content">{item.title}</span>
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  className={cn('h-3.5 w-3.5 text-content-subtle transition-transform', isOpen && 'rotate-180')}
                >
                  <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    variants={collapseVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="overflow-hidden"
                  >
                    <div className="pb-4 text-sm text-content-muted">{item.body}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

/**
 * The week as the design's calendar: a column a day, with what was said that
 * day pinned into it. There are no meeting times in a standup, so the columns
 * hold the day's plan rather than pretending to a timeline.
 */
export function WeekCalendar({ dates, byDate, today }) {
  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-line bg-surface-raised px-3 py-1 text-xs text-content-muted">
          {monthName(today, -1)}
        </span>
        <h2 className="text-lg tracking-tight text-content">{monthYear(today)}</h2>
        <span className="rounded-full border border-line bg-surface-raised px-3 py-1 text-xs text-content-muted">
          {monthName(today, 1)}
        </span>
      </div>

      <div className="mt-5 grid flex-1 grid-cols-5">
        {dates.map(date => {
          const standup = byDate.get(date)
          const isToday = date === today
          const past = date < today

          return (
            <div key={date} className="flex min-w-0 flex-col border-l border-dashed border-line px-1.5 first:border-l-0 sm:px-2">
              <div className="mb-3 text-center">
                <p className={cn('text-xs', isToday ? 'text-content' : 'text-content-subtle')}>
                  {weekdayShort(date)}
                </p>
                <p
                  className={cn(
                    'tabular mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm',
                    isToday
                      ? 'bg-brand-600 text-white dark:bg-brand-400 dark:text-brand-700'
                      : 'text-content-muted'
                  )}
                >
                  {dayOfMonth(date)}
                </p>
              </div>

              <div className="flex flex-1 flex-col gap-2">
                {standup ? (
                  <div
                    className={cn(
                      'rounded-xl px-2 py-2 text-[11px] leading-snug shadow-card',
                      standup.hasBlocker
                        ? 'bg-brand-600 text-white dark:bg-surface-sunken dark:text-content'
                        : 'bg-surface-raised text-content'
                    )}
                  >
                    <p className="line-clamp-3">{standup.today}</p>
                    <p
                      className={cn(
                        'mt-1 flex items-center gap-1 text-[10px]',
                        standup.hasBlocker ? 'text-brand-300' : 'text-content-subtle'
                      )}
                    >
                      <span aria-hidden="true">{MOOD_EMOJI[standup.mood]}</span>
                      {standup.hasBlocker ? 'Blocked' : 'Filed'}
                    </p>
                  </div>
                ) : past ? (
                  <p className="text-center text-[10px] text-content-subtle">No standup</p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
