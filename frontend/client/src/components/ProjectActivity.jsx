import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import API from '../api/axios'
import Card, { CardTitle } from './ui/Card'
import Badge from './ui/Badge'
import Skeleton from './ui/Skeleton'
import EmptyState from './ui/EmptyState'
import StatCard from './ui/StatCard'
import { IconAlert, IconBriefcase, IconCheck } from './ui/icons'
import { cn } from '../lib/cn'
import { itemVariants, listVariants } from '../lib/motion'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'

/**
 * What each person is on today, and whether they report it every day.
 *
 * The two questions a lead actually asks about a project, answered per person
 * rather than per project — because the thing you want to know is whether
 * somebody is stuck, not how many hours a project accumulated.
 */
export default function ProjectActivity() {
  // Reload in place when something new may have happened — see liveRefresh
  const live = useLiveRefresh()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    API.get('/projects/activity')
      .then(res => {
        if (!cancelled) setData(res.data)
      })
      .catch(err => {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load activity'))
      })

    return () => {
      cancelled = true
    }
  }, [live])

  if (error) {
    return <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 rounded-card" />
        <Skeleton className="h-80 rounded-card" />
      </div>
    )
  }

  if (data.people.length === 0) {
    return (
      <EmptyState
        icon={<IconBriefcase className="h-6 w-6" />}
        title="Nobody on this team yet"
      />
    )
  }

  const reported = data.people.filter(p => p.submittedToday).length
  const blocked = data.people.filter(p => p.blocker).length
  const unassigned = data.people.filter(p => p.assigned.length === 0).length

  return (
    <motion.div variants={listVariants} initial="initial" animate="animate">
      <motion.div
        variants={itemVariants}
        className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        <StatCard value={reported} label={`of ${data.people.length} reported today`} tone="brand" />
        <StatCard value={blocked} label="blocked right now" tone="warning" />
        <StatCard value={data.projects.length} label="open projects" tone="neutral" />
        <StatCard value={unassigned} label="on no project" tone="neutral" />
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card padded={false}>
          <div className="px-4 py-4 md:px-6">
            <CardTitle className="mb-0">Today · {data.today}</CardTitle>
            <p className="mt-1 text-xs text-content-subtle">
              What each person said they are on, and how many of the last seven days
              they reported.
            </p>
          </div>

          <ul className="divide-y divide-line border-t border-line">
            {data.people.map(person => (
              <li
                key={person._id}
                className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3.5 md:px-6"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-content">
                      {person.name}
                    </span>
                    {person.assigned.length === 0 ? (
                      <Badge tone="neutral">No project</Badge>
                    ) : (
                      person.assigned.slice(0, 3).map(a => (
                        <Badge key={a._id} tone="brand">{a.code || a.name}</Badge>
                      ))
                    )}
                  </span>

                  {person.submittedToday ? (
                    <>
                      <span className="mt-1 block truncate text-xs text-content-muted">
                        {person.plan || 'No plan written'}
                      </span>
                      {person.workedOn.length > 0 && (
                        <span className="mt-1 block text-xs text-content-subtle">
                          {person.workedOn
                            .map(w => `${w.code || w.project} · ${w.hours}h`)
                            .join('  ·  ')}
                        </span>
                      )}
                      {person.blocker && (
                        <span className="mt-1 flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                          <IconAlert className="mt-0.5 h-3 w-3 shrink-0" />
                          <span className="min-w-0">{person.blocker}</span>
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="mt-1 block text-xs text-content-subtle">
                      Nothing reported today
                    </span>
                  )}
                </span>

                <span className="flex shrink-0 items-center gap-3">
                  <span
                    className={cn(
                      'tabular text-xs',
                      person.daysThisWeek >= 4
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : person.daysThisWeek >= 2
                          ? 'text-content-muted'
                          : 'text-amber-600 dark:text-amber-400'
                    )}
                    title="Days reported in the last seven"
                  >
                    {person.daysThisWeek}/7
                  </span>

                  {person.submittedToday ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600/12 text-brand-700 dark:text-brand-300">
                      <IconCheck className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="h-6 w-6 rounded-full border border-line"
                    />
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </motion.div>
    </motion.div>
  )
}
