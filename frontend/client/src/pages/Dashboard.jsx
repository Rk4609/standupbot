import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'
import StreakHeatmap from '../components/StreakHeatmap'
import EditStandupDialog from '../components/EditStandupDialog'
import {
  DetailsAccordion,
  ProfileCard,
  TodayRing,
  WeekBars,
  WeekCalendar,
  WeekChecklist,
  WindowCard
} from '../components/dashboard/DashboardCards'
import {
  IconBriefcase, IconCheck, IconFlame, IconTarget, IconTimer, IconUsers
} from '../components/ui/icons'
import { itemVariants } from '../lib/motion'
import { cn } from '../lib/cn'
import { can } from '../lib/permissions'
import { todayForUser } from '../lib/timezone'
import { prettyDate } from '../lib/dates'
import { hoursLabel, workWeek } from '../lib/week'
import { useLiveRefresh } from '../lib/liveRefresh'

const STATUS_LABEL = {
  draft: 'Not submitted yet',
  submitted: 'Submitted, waiting for review',
  approved: 'Approved',
  rejected: 'Sent back'
}

/** One labelled pill in the row under the greeting. */
function StatPill({ label, children, className, style }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 truncate text-xs text-content-muted">{label}</p>
      <div
        style={style}
        className={cn('flex h-10 items-center rounded-full px-4 text-xs', className)}
      >
        {children}
      </div>
    </div>
  )
}

/** The big, thin numbers on the right of the greeting. */
function Figure({ icon: Icon, value, label }) {
  return (
    <div className="min-w-0">
      <p className="tabular text-hero font-extralight text-content">{value}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-content-muted">
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-line">
          <Icon className="h-3 w-3" />
        </span>
        {label}
      </p>
    </div>
  )
}

/**
 * Home: who you are, how the week is going, and what today still needs.
 *
 * Laid out after the HR dashboard this app's look follows — a greeting with
 * the week's headline figures, then a grid of panels. Every panel is fed by
 * something the app already records; where the design shows a thing this app
 * does not track (a live timer, meeting times) the panel shows the nearest
 * true thing instead of an invented number.
 */
export default function Dashboard({ user }) {
  // Reload in place when something new may have happened — see liveRefresh
  const live = useLiveRefresh()
  const [standups, setStandups] = useState([])
  const [profile, setProfile] = useState(null)
  const [week, setWeek] = useState(null)
  const [lead, setLead] = useState({})
  const [onboarding, setOnboarding] = useState(null)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    // Settled rather than all: a role without timesheets or projects should
    // still get its dashboard, just without that panel's numbers
    Promise.allSettled([
      API.get('/standups/my'),
      API.get('/users/profile'),
      can(user, 'timesheet') ? API.get('/timesheets/me') : Promise.resolve(null),
      can(user, 'employees') ? API.get('/employees/summary') : Promise.resolve(null),
      can(user, 'hiring') ? API.get('/hiring?status=pending&limit=10') : Promise.resolve(null),
      can(user, 'projects') ? API.get('/projects/all') : Promise.resolve(null),
      API.get('/onboarding/mine')
    ]).then(([mine, me, sheet, roster, hiring, projects, firstWeeks]) => {
      if (cancelled) return

      const value = (r) => (r.status === 'fulfilled' ? r.value?.data : null)

      setStandups(value(mine) || [])
      setProfile(value(me))
      setWeek(value(sheet))
      setOnboarding(value(firstWeeks)?.onboarding || null)
      setLead({
        roster: value(roster)?.rosterTotal ?? null,
        pending: value(hiring)?.pendingCount ?? null,
        projects: value(projects)?.projects
          ? value(projects).projects.filter(p => p.active).length
          : null
      })
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [user, live])

  const today = todayForUser()
  const dates = week?.dates?.length ? week.dates : workWeek(today)

  const byDate = useMemo(() => new Map(standups.map(s => [s.date, s])), [standups])
  const submitted = useMemo(() => new Set(standups.map(s => s.date)), [standups])

  const todayStandup = byDate.get(today) || null
  const perDay = week?.perDayTotals || {}
  const hoursToday = perDay[today] ??
    (todayStandup?.work || []).reduce((sum, w) => sum + (Number(w.hours) || 0), 0)
  const weekHours = week?.totalHours ?? 0

  const filedThisWeek = dates.filter(d => byDate.has(d)).length
  const blockedThisWeek = dates.filter(d => byDate.get(d)?.hasBlocker).length
  const daysLeft = dates.filter(d => d > today).length
  const latestBlocker = standups.find(s => s.hasBlocker)

  const firstName = (profile?.name || user?.name || '').split(' ')[0]
  const job = profile?.employment || {}

  // Up to three headline figures: the team's when you run one, your own
  // otherwise, topped up from your own when the team has fewer to show
  const figures = [
    lead.roster !== null && lead.roster !== undefined &&
      { icon: IconUsers, value: lead.roster, label: 'Employees' },
    lead.pending !== null && lead.pending !== undefined &&
      { icon: IconBriefcase, value: lead.pending, label: 'Pending hires' },
    lead.projects !== null && lead.projects !== undefined &&
      { icon: IconTarget, value: lead.projects, label: 'Projects' },
    { icon: IconFlame, value: profile?.streak ?? user?.streak ?? 0, label: 'Day streak' },
    { icon: IconCheck, value: standups.length, label: 'Standups' },
    { icon: IconTimer, value: `${hoursLabel(weekHours)}h`, label: 'This week' }
  ].filter(Boolean).slice(0, 3)

  const accordion = [
    {
      id: 'plan',
      title: "Today's plan",
      body: todayStandup ? (
        <>
          <p className="text-content">{todayStandup.today}</p>
          {todayStandup.hasBlocker && (
            <p className="mt-1.5 text-red-600 dark:text-red-400">Blocked: {todayStandup.blockers}</p>
          )}
        </>
      ) : (
        <p>
          Not filed yet.{' '}
          <Link to="/standup/new" className="text-content underline underline-offset-2">
            Write it now
          </Link>
        </p>
      )
    },
    {
      id: 'blockers',
      title: 'Blockers',
      body: latestBlocker ? (
        <>
          <p className="text-content">{latestBlocker.blockers}</p>
          <p className="mt-1 text-xs text-content-subtle">
            Last raised {prettyDate(`${latestBlocker.date}T00:00:00Z`)} ·{' '}
            {standups.filter(s => s.hasBlocker).length} in total
          </p>
        </>
      ) : (
        <p>Nothing has blocked you yet.</p>
      )
    },
    ...(week
      ? [{
          id: 'timesheet',
          title: 'Timesheet',
          body: (
            <p>
              <span className="text-content">{hoursLabel(weekHours)} hours</span> this week ·{' '}
              {STATUS_LABEL[week.status] || week.status}.{' '}
              <Link to="/timesheet" className="text-content underline underline-offset-2">
                Open it
              </Link>
            </p>
          )
        }]
      : []),
    {
      id: 'record',
      title: 'My record',
      body: (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <dt className="text-content-subtle">Position</dt>
          <dd className="text-right text-content">{job.position || '—'}</dd>
          <dt className="text-content-subtle">Team</dt>
          <dd className="text-right text-content">{profile?.team?.name || '—'}</dd>
          <dt className="text-content-subtle">Joined</dt>
          <dd className="text-right text-content">{prettyDate(job.joinedOn) || '—'}</dd>
          <dt className="col-span-2 pt-1">
            <Link to="/profile" className="text-content underline underline-offset-2">
              Everything on your record
            </Link>
          </dt>
        </dl>
      )
    }
  ]

  if (loading) {
    return (
      <PageShell>
        <Skeleton className="mb-6 h-12 w-80 rounded-full" />
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-10 rounded-full" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-60 rounded-card" />
          ))}
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      {/* Greeting and the week's headline figures */}
      <motion.section
        variants={itemVariants}
        className="mb-8 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"
      >
        <div className="min-w-0 flex-1">
          <h1 className="text-hero font-extralight text-content">
            Welcome in, {firstName}
          </h1>

          <div className="mt-7 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_2.2fr_1fr]">
            {/* Ink in light, paper in dark — so it never matches the yellow
                pill beside it */}
            <StatPill
              label="Standups"
              className="bg-brand-600 text-white dark:bg-content dark:text-surface"
            >
              {Math.round((filedThisWeek / dates.length) * 100)}%
            </StatPill>
            <StatPill label="Hours" className="bg-brand-400 text-brand-700">
              {Math.min(100, Math.round((weekHours / 40) * 100))}%
            </StatPill>
            <StatPill
              label="Week left"
              className="border border-line text-content-muted"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(-45deg, rgb(var(--content) / 0.10) 0 1px, transparent 1px 7px)'
              }}
            >
              {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
            </StatPill>
            <StatPill label="Blocked" className="border border-content/25 text-content">
              {blockedThisWeek}
            </StatPill>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 sm:gap-10">
          {figures.map(f => (
            <Figure key={f.label} {...f} />
          ))}
        </div>
      </motion.section>

      {/* A new joiner's checklist, until it is done */}
      {onboarding?.status === 'active' && (
        <motion.div variants={itemVariants} className="mb-4">
          <Link
            to={`/onboarding/${onboarding._id}`}
            className="flex flex-col gap-4 rounded-card bg-brand-600 p-5 text-white shadow-card transition-shadow hover:shadow-lift dark:bg-surface-raised dark:text-content sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.14em] text-white/60 dark:text-content-subtle">
                Your first weeks
              </p>
              <p className="mt-1 text-lg tracking-tight">
                Onboarding · {onboarding.progress.done} of {onboarding.progress.total} done
              </p>
              {(() => {
                const next = onboarding.tasks
                  .filter(t => !t.done && t.canTick)
                  .sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0]
                return next ? (
                  <p className="mt-0.5 truncate text-sm text-white/75 dark:text-content-muted">
                    Next for you: {next.title}
                  </p>
                ) : null
              })()}
            </div>
            <div className="flex items-center gap-3 sm:w-64">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15 dark:bg-surface-sunken">
                <div
                  className="h-full rounded-full bg-brand-400"
                  style={{ width: `${onboarding.progress.percent}%` }}
                />
              </div>
              <span className="tabular text-sm">{onboarding.progress.percent}%</span>
            </div>
          </Link>
        </motion.div>
      )}

      {/* The panels */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ProfileCard profile={profile} user={user} />
        <WeekBars dates={dates} perDay={perDay} total={weekHours} today={today} />
        <TodayRing
          hours={hoursToday}
          standup={todayStandup}
          onEdit={() => setEditing(todayStandup)}
        />
        <WindowCard employment={job} dates={dates} submitted={submitted} today={today} />

        <DetailsAccordion items={accordion} />
        <div className="md:col-span-2">
          <WeekCalendar dates={dates} byDate={byDate} today={today} />
        </div>
        <WeekChecklist dates={dates} byDate={byDate} today={today} />
      </div>

      {/* The long view, kept from before: a streak is built across months */}
      <Card className="mt-4">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg tracking-tight text-content">Submission activity</h2>
          <Link
            to="/history"
            className="rounded-full border border-line bg-surface-raised px-3 py-1 text-xs text-content-muted transition-colors hover:text-content"
          >
            View history
          </Link>
        </div>
        <StreakHeatmap dates={standups.map(s => s.date)} />
      </Card>

      {editing && (
        <EditStandupDialog
          standup={editing}
          onClose={() => setEditing(null)}
          onSaved={updated =>
            setStandups(list => list.map(s => (s._id === updated._id ? updated : s)))
          }
        />
      )}
    </PageShell>
  )
}
