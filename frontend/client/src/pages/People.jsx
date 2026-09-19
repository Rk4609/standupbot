import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import PageSizeSelect from '../components/ui/PageSizeSelect'
import { Input, Select } from '../components/ui/Field'
import { IconAlert, IconHourglass, IconSearch, IconUsers } from '../components/ui/icons'
import PersonRecord from '../components/PersonRecord'
import { cn } from '../lib/cn'
import { collapseVariants } from '../lib/motion'
import { asDateInput, prettyDate } from '../lib/dates'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { usePageSize } from '../lib/paging'

const TYPE_LABEL = {
  intern: 'Intern',
  probation: 'Probation',
  'full-time': 'Full time',
  contract: 'Contract'
}

const TYPE_TONE = {
  intern: 'info',
  probation: 'warning',
  'full-time': 'positive',
  contract: 'neutral'
}

/** "2 years, 3 months" from a joining date — what people actually ask. */
const served = (joinedOn) => {
  if (!joinedOn) return null
  const from = new Date(joinedOn)
  if (Number.isNaN(from.getTime())) return null

  const months = Math.max(
    0,
    (new Date().getFullYear() - from.getFullYear()) * 12 +
      (new Date().getMonth() - from.getMonth())
  )
  const years = Math.floor(months / 12)
  const rest = months % 12

  if (years === 0) return `${rest} mo here`
  return rest === 0 ? `${years} yr here` : `${years} yr ${rest} mo here`
}

const daysUntil = (value) => {
  if (!value) return null
  const end = new Date(value)
  if (Number.isNaN(end.getTime())) return null
  return Math.ceil((end - new Date()) / 86_400_000)
}

/**
 * Everybody's record: who they are, when they joined, what they do, what
 * they are paid — for whoever is allowed each part.
 *
 * A directory rather than a form per person, because the questions it answers
 * are comparative: whose internship ends this month, who has been here
 * longest, which positions a team actually has.
 */
export default function People({ user }) {
  // Reload in place when something new may have happened — see liveRefresh
  const live = useLiveRefresh()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)

  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [team, setTeam] = useState('')
  const [page, setPage] = useState(1)
  const [size, setSize] = usePageSize('people')

  // The typed value is separate from the committed one so a keystroke does
  // not become a request
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(typed)
      setPage(1)
    }, 300)
    return () => clearTimeout(id)
  }, [typed])

  const load = useCallback(() => {
    const query = new URLSearchParams({ page: String(page), limit: String(size) })
    if (search) query.set('search', search)
    if (type) query.set('type', type)
    if (team) query.set('team', team)

    return API.get(`/people?${query}`)
      .then(res => setData(res.data))
      .catch(err => setError(apiErrorMessage(err, 'Could not load the records')))
  }, [page, size, search, type, team])

  useEffect(() => {
    load()
  }, [load, live])

  if (error) {
    return (
      <PageShell>
        <PageHeader title="People records" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell>
        <Skeleton className="mb-2 h-9 w-56" />
        <Skeleton className="mb-7 h-4 w-80" />
        <Skeleton className="h-96 rounded-card" />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="People records"
        subtitle={
          user?.role === 'admin'
            ? 'Everybody in the workspace: joining dates, positions and contact details.'
            : 'Your team: joining dates, positions and contact details.'
        }
      />

      {data.ending.length > 0 && (
        <Card className="mb-4 border-amber-500/30 bg-amber-500/[0.06]">
          <div className="flex flex-wrap items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <IconHourglass className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-content">Ending in the next month</p>
              <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                {data.ending.map(p => {
                  const left = daysUntil(p.employment?.endsOn)
                  return (
                    <li key={p._id} className="text-xs text-content-muted">
                      <span className="font-medium text-content">{p.name}</span>
                      {' · '}
                      {TYPE_LABEL[p.employment?.type] || 'Ends'}
                      {' · '}
                      {left <= 0 ? 'already past' : `${left} ${left === 1 ? 'day' : 'days'} left`}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div>
            <CardTitle className="mb-0">Records</CardTitle>
            <p className="mt-1 text-xs text-content-subtle">
              {data.total} {data.total === 1 ? 'person' : 'people'}
              {data.maySeePay ? ' · you can see pay details' : ' · pay details are not part of your role'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 border-t border-line px-4 py-3 md:px-6 lg:flex-row lg:items-center">
          <Input
            type="search"
            icon={IconSearch}
            value={typed}
            onChange={e => setTyped(e.target.value)}
            placeholder="Search by name, email or position…"
            aria-label="Search records"
            className="py-2 text-sm lg:flex-1"
          />
          <div className="flex flex-wrap gap-2.5">
            <div className="w-40">
              <Select
                value={type}
                onChange={e => {
                  setType(e.target.value)
                  setPage(1)
                }}
                aria-label="Filter by kind of hire"
                className="py-2 text-sm"
              >
                <option value="">Everybody</option>
                <option value="intern">Interns</option>
                <option value="probation">On probation</option>
                <option value="full-time">Full time</option>
                <option value="contract">Contract</option>
              </Select>
            </div>
            {data.teams.length > 0 && (
              <div className="w-40">
                <Select
                  value={team}
                  onChange={e => {
                    setTeam(e.target.value)
                    setPage(1)
                  }}
                  aria-label="Filter by team"
                  className="py-2 text-sm"
                >
                  <option value="">All teams</option>
                  {data.teams.map(t => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </Select>
              </div>
            )}
            {data.total > 10 && (
              <PageSizeSelect
                value={size}
                onChange={n => {
                  setSize(n)
                  setPage(1)
                }}
              />
            )}
          </div>
        </div>

        {data.people.length === 0 ? (
          <div className="px-4 pb-6 md:px-6">
            <EmptyState
              icon={<IconUsers className="h-6 w-6" />}
              title="Nobody matches that"
              description="Try a different search or filter."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {data.people.map(person => {
              const open = openId === person._id
              const job = person.employment || {}
              const left = daysUntil(job.endsOn)

              return (
                <li key={person._id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : person._id)}
                    aria-expanded={open}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-left md:px-6"
                  >
                    {person.avatar ? (
                      <img src={person.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                        {person.name.charAt(0).toUpperCase()}
                      </span>
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-content">
                          {person.name}
                        </span>
                        <Badge tone={TYPE_TONE[job.type] || 'neutral'}>
                          {TYPE_LABEL[job.type] || 'Full time'}
                        </Badge>
                        {left !== null && left <= 30 && (
                          <Badge tone="warning">
                            {left <= 0 ? 'past' : `${left}d left`}
                          </Badge>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-content-subtle">
                        {job.position || 'No position set'}
                        {person.team?.name ? ` · ${person.team.name}` : ''}
                        {job.employeeId ? ` · ${job.employeeId}` : ''}
                      </span>
                    </span>

                    <span className="hidden shrink-0 text-right sm:block">
                      <span className="block text-xs text-content-muted">
                        {prettyDate(job.joinedOn) || 'No joining date'}
                      </span>
                      <span className="block text-xs text-content-subtle">
                        {served(job.joinedOn) || ''}
                        {job.experienceYears
                          ? `${served(job.joinedOn) ? ' · ' : ''}${job.experienceYears} yr before`
                          : ''}
                      </span>
                    </span>

                    {data.maySeePay && (
                      <span
                        className={cn(
                          'tabular hidden w-36 shrink-0 whitespace-nowrap text-right text-sm md:block',
                          person.salary?.amount ? 'text-content' : 'text-content-subtle'
                        )}
                      >
                        {person.salary?.amount
                          ? `${person.salary.currency || ''} ${Number(person.salary.amount).toLocaleString()}/${person.salary.period === 'month' ? 'mo' : 'yr'}`
                          : '—'}
                      </span>
                    )}
                  </button>

                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        variants={collapseVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="overflow-hidden"
                      >
                        <div className="border-t border-line bg-surface-sunken/40 px-4 py-4 md:px-6">
                          <PersonRecord
                            person={person}
                            maySeePay={data.maySeePay}
                            onSaved={() => load()}
                          />

                          {person.dob && (
                            <p className="mt-3 text-xs text-content-subtle">
                              Born {prettyDate(person.dob)} ({asDateInput(person.dob)})
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              )
            })}
          </ul>
        )}

        {data.totalPages > 1 && (
          <div className="border-t border-line px-4 py-3 md:px-6">
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              limit={data.limit || size}
              onPage={setPage}
            />
          </div>
        )}
      </Card>
    </PageShell>
  )
}
