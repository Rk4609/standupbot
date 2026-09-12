import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import Skeleton, { SkeletonText } from '../components/ui/Skeleton'
import { Input, Select } from '../components/ui/Field'
import { IconAlert, IconSearch, IconUsers } from '../components/ui/icons'
import { MOOD_EMOJI } from '../lib/moods'
import { cn } from '../lib/cn'
import { DURATION, EASE, SPRING, itemVariants } from '../lib/motion'
import { apiErrorMessage } from '../lib/apiError'

const ROLE_TONE = { admin: 'danger', manager: 'positive', employee: 'brand' }
const WEEKDAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DEFAULT_PAGE_SIZES = [10, 20, 50, 100]

/** Seven squares showing which of the last 7 days this person submitted. */
function WeekStrip({ week, dates }) {
  const done = new Set(dates)
  return (
    <div className="flex gap-1">
      {week.map((date, i) => (
        <span
          key={date}
          title={`${date}${done.has(date) ? ' · submitted' : ''}`}
          className={cn(
            'h-4 w-[7px] rounded-[2px]',
            done.has(date) ? 'bg-brand-500' : 'bg-surface-sunken dark:bg-white/[0.07]'
          )}
        >
          <span className="sr-only">{WEEKDAY[i]}</span>
        </span>
      ))}
    </div>
  )
}

function Avatar({ user }) {
  if (user.avatar) {
    return <img src={user.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600/12 text-xs font-semibold text-brand-700 dark:text-brand-300">
      {user.name?.charAt(0).toUpperCase()}
    </div>
  )
}

/** Detail body — fetched only when a row is opened. */
function EmployeeDetail({ id }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    API.get(`/employees/${id}`)
      .then(res => {
        if (!cancelled) setData(res.data)
      })
      .catch(err => {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load details'))
      })

    return () => {
      cancelled = true
    }
  }, [id])

  if (error) {
    return <p className="px-4 py-5 text-sm text-red-600 dark:text-red-400 md:px-6">{error}</p>
  }

  if (!data) {
    return (
      <div className="space-y-3 px-4 py-5 md:px-6">
        <Skeleton className="h-3 w-40" />
        <SkeletonText lines={3} />
      </div>
    )
  }

  const { user, standups, moodBreakdown } = data
  const moods = Object.entries(moodBreakdown).sort((a, b) => b[1] - a[1])

  return (
    <div className="grid gap-6 px-4 py-5 md:grid-cols-3 md:px-6">
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="eyebrow">Email</dt>
          <dd className="mt-0.5 truncate text-content">{user.email}</dd>
        </div>
        <div>
          <dt className="eyebrow">Team</dt>
          <dd className="mt-0.5 text-content">{user.team?.name || 'Unassigned'}</dd>
        </div>
        <div>
          <dt className="eyebrow">Joined</dt>
          <dd className="mt-0.5 text-content">
            {new Date(user.createdAt).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
          </dd>
        </div>
        {moods.length > 0 && (
          <div>
            <dt className="eyebrow">Mood spread</dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {moods.map(([mood, n]) => (
                <span
                  key={mood}
                  title={`${mood}: ${n}`}
                  className="flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-content-muted"
                >
                  {MOOD_EMOJI[mood]} {n}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>

      <div className="md:col-span-2">
        <p className="eyebrow mb-2.5">Recent standups</p>
        {standups.length === 0 ? (
          <p className="text-sm text-content-subtle">No standups submitted yet.</p>
        ) : (
          <div className="space-y-2.5">
            {standups.slice(0, 5).map(s => (
              <div key={s._id} className="rounded-lg bg-surface-sunken/60 px-3.5 py-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <span aria-hidden="true">{MOOD_EMOJI[s.mood]}</span>
                  <span className="tabular text-xs text-content-subtle">{s.date}</span>
                  {s.hasBlocker && (
                    <Badge tone="danger">
                      <IconAlert className="h-3 w-3" />
                      Blocker
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-content">{s.today}</p>
                {s.hasBlocker && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{s.blockers}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Employees() {
  // Data is stored with the query that produced it, so "a newer query is in
  // flight" is derived rather than tracked in its own state.
  const [loaded, setLoaded] = useState(null)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  // The typed value is separate from the committed query so typing does not
  // fire a request per keystroke.
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null)

  // One object, so every filter change can reset the page in the same update
  // rather than through a follow-up effect.
  const [query, setQuery] = useState({
    page: 1,
    limit: 20,
    search: '',
    role: 'all',
    team: 'all'
  })

  const patch = (changes) => setQuery(q => ({ ...q, page: 1, ...changes }))

  // Headline counts describe the whole roster, so they are fetched once
  useEffect(() => {
    let cancelled = false
    API.get('/employees/summary')
      .then(res => {
        if (!cancelled) setSummary(res.data)
      })
      .catch(() => {
        /* the table's own error state already covers a failure here */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    // setState from a timeout is async, so it does not cascade the render
    const t = setTimeout(
      () => setQuery(q => (q.search === search ? q : { ...q, search, page: 1 })),
      350
    )
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let cancelled = false

    API.get('/employees', {
      params: {
        page: query.page,
        limit: query.limit,
        search: query.search || undefined,
        role: query.role !== 'all' ? query.role : undefined,
        team: query.team !== 'all' ? query.team : undefined
      }
    })
      .then(res => {
        if (cancelled) return
        setLoaded({ data: res.data, query })
        setError('')
        // A row open on the previous page should not stay open on the next
        setOpenId(null)
      })
      .catch(err => {
        if (cancelled) return
        setError(apiErrorMessage(err, 'Could not load employees'))
        setLoaded(prev => prev ?? { data: null, query })
      })

    return () => {
      cancelled = true
    }
  }, [query])

  const data = loaded?.data
  const loading = loaded === null
  // A newer query than the one that produced the data on screen
  const fetching = loaded !== null && loaded.query !== query

  const week = data?.week || []
  const employees = data?.employees || []
  const teams = data?.teams || []
  const pageSizes = data?.pageSizes || DEFAULT_PAGE_SIZES

  if (loading) {
    return (
      <PageShell width="xl">
        <Skeleton className="mb-2 h-9 w-64" />
        <Skeleton className="mb-7 h-4 w-48" />
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 rounded-card" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-card" />
      </PageShell>
    )
  }

  return (
    <PageShell width="xl">
      <PageHeader
        title="Employees"
        subtitle="Everyone on the roster, with their standup activity. Open a row for detail."
      />

      {error ? (
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard value={summary?.rosterTotal ?? 0} label="On the roster" tone="brand" />
            <StatCard
              value={summary?.submittedToday ?? 0}
              label="Submitted today"
              tone="positive"
            />
            <StatCard
              value={summary?.withBlockers ?? 0}
              label="Have raised blockers"
              tone="warning"
            />
            <StatCard value={summary?.teamCount ?? 0} label="Teams" tone="neutral" />
          </div>

          {/* Filters */}
          <motion.div
            variants={itemVariants}
            className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:items-center"
          >
            <Input
              type="search"
              icon={IconSearch}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="lg:flex-1"
            />
            <Select
              value={query.role}
              onChange={e => patch({ role: e.target.value })}
              className="lg:w-40"
            >
              <option value="all">All roles</option>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </Select>
            <Select
              value={query.team}
              onChange={e => patch({ team: e.target.value })}
              className="lg:w-40"
            >
              <option value="all">All teams</option>
              {teams.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Select
              value={query.limit}
              onChange={e => patch({ limit: Number(e.target.value) })}
              aria-label="Rows per page"
              className="lg:w-36"
            >
              {pageSizes.map(n => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </Select>
          </motion.div>

          <Card padded={false} className="relative overflow-hidden">
            {/* Keep the current page visible while the next one loads, rather
                than collapsing the table back to a skeleton */}
            <AnimatePresence>
              {fetching && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-brand-500/20"
                >
                  <motion.div
                    className="h-full w-1/3 bg-brand-500"
                    animate={{ x: ['-100%', '300%'] }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="hidden border-b border-line px-4 py-2.5 md:flex md:px-6">
              <span className="eyebrow flex-1">Employee</span>
              <span className="eyebrow w-32">Team</span>
              <span className="eyebrow w-28">Last 7 days</span>
              <span className="eyebrow w-16 text-right">Streak</span>
              <span className="eyebrow w-16 text-right">Total</span>
              <span className="eyebrow w-20 text-right">Blockers</span>
              <span className="w-6" />
            </div>

            {employees.length === 0 ? (
              <EmptyState
                icon={<IconUsers className="h-6 w-6" />}
                title="No one matches those filters"
                description="Try a different search, role or team."
                className="border-0 bg-transparent"
              />
            ) : (
              <div className={cn('divide-y divide-line transition-opacity', fetching && 'opacity-60')}>
                {employees.map(e => {
                  const open = openId === e._id
                  return (
                    <div key={e._id}>
                      <button
                        onClick={() => setOpenId(open ? null : e._id)}
                        aria-expanded={open}
                        className={cn(
                          'flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-left transition-colors md:flex-nowrap md:px-6',
                          open ? 'bg-surface-sunken/70' : 'hover:bg-surface-sunken/50'
                        )}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-3">
                          <Avatar user={e} />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-content">
                                {e.name}
                              </span>
                              {e.role !== 'employee' && (
                                <Badge tone={ROLE_TONE[e.role]} className="capitalize">
                                  {e.role}
                                </Badge>
                              )}
                            </span>
                            <span className="block truncate text-xs text-content-subtle">
                              {e.email}
                            </span>
                          </span>
                        </span>

                        <span className="w-32 shrink-0 truncate text-sm text-content-muted max-md:hidden">
                          {e.team?.name || '—'}
                        </span>

                        <span className="w-28 shrink-0 max-md:order-last max-md:w-full">
                          <WeekStrip week={week} dates={e.weekDates} />
                        </span>

                        <span className="tabular w-16 shrink-0 text-right text-sm text-content max-md:hidden">
                          {e.streak || 0}
                        </span>
                        <span className="tabular w-16 shrink-0 text-right text-sm text-content-muted max-md:hidden">
                          {e.totalStandups}
                        </span>
                        <span className="w-20 shrink-0 text-right max-md:hidden">
                          {e.blockerCount > 0 ? (
                            <Badge tone="danger">{e.blockerCount}</Badge>
                          ) : (
                            <span className="text-sm text-content-subtle">—</span>
                          )}
                        </span>

                        <motion.span
                          aria-hidden="true"
                          animate={{ rotate: open ? 90 : 0 }}
                          transition={SPRING}
                          className="w-6 shrink-0 text-center text-content-subtle"
                        >
                          ›
                        </motion.span>
                      </button>

                      <AnimatePresence initial={false}>
                        {open && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                              height: { duration: DURATION.base, ease: EASE },
                              opacity: { duration: 0.18 }
                            }}
                            className="overflow-hidden border-t border-line bg-surface-sunken/30"
                          >
                            <EmployeeDetail id={e._id} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Pagination
            className="mt-4"
            page={data?.page || 1}
            totalPages={data?.totalPages || 1}
            total={data?.total || 0}
            limit={data?.limit || query.limit}
            onPage={p => setQuery(q => ({ ...q, page: p }))}
          />
        </>
      )}
    </PageShell>
  )
}
