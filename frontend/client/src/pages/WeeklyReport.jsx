import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import StatCard from '../components/ui/StatCard'
import EmptyState from '../components/ui/EmptyState'
import { Select } from '../components/ui/Field'
import { IconAlert, IconPrinter, IconSparkles, IconUsers } from '../components/ui/icons'
import AiReport from '../components/AiReport'
import { AI_MODEL_LABEL } from '../lib/ai'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { addDays } from '../lib/leave'

const hours = (n) => `${Number.isInteger(n) ? n : n.toFixed(1)}h`

/**
 * The week's work by project, and a written status report to send on.
 *
 * Made to be forwarded: "Download PDF" prints just the report and the
 * project table. Moods and attendance are never on it — those stay in the
 * lead's daily brief.
 */
export default function WeeklyReport() {
  const live = useLiveRefresh()
  const [week, setWeek] = useState(null)
  const [team, setTeam] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [writing, setWriting] = useState(false)
  const [writeError, setWriteError] = useState('')

  const load = useCallback(() => {
    const params = {}
    if (week) params.week = week
    if (team) params.team = team
    return API.get('/reports/weekly', { params })
      .then(res => {
        setData(res.data)
        setError('')
      })
      .catch(err => setError(apiErrorMessage(err, 'Could not load the report')))
  }, [week, team])

  useEffect(() => {
    load()
  }, [load, live])

  const write = async () => {
    setWriting(true)
    setWriteError('')
    try {
      const { data: res } = await API.post('/reports/weekly', {
        week: data.facts.week.start,
        ...(team ? { team } : {})
      })
      setData(d => ({ ...d, report: res.report, facts: res.facts }))
    } catch (err) {
      setWriteError(apiErrorMessage(err, 'The report could not be written'))
    } finally {
      setWriting(false)
    }
  }

  if (error && !data) {
    return (
      <PageShell>
        <PageHeader title="Weekly report" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (data?.noTeam) {
    return (
      <PageShell>
        <PageHeader title="Weekly report" />
        <EmptyState icon={<IconUsers className="h-6 w-6" />} title={data.message} description="A report covers a team you lead." />
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell>
        <Skeleton className="mb-2 h-9 w-52" />
        <Skeleton className="mb-7 h-4 w-72" />
        <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-card" />)}
        </div>
        <Skeleton className="h-96 rounded-card" />
      </PageShell>
    )
  }

  const { facts, report } = data
  const top = facts.projects[0]?.hours || 1

  const copy = () => {
    navigator.clipboard?.writeText(report.content)
      .then(() => toast.success('Report copied'))
      .catch(() => toast.error('Could not copy'))
  }

  return (
    <PageShell>
      <PageHeader
        title="Weekly report"
        subtitle={`${data.title} · ${facts.week.label}`}
        actions={
          <div className="no-print flex flex-wrap items-center gap-1">
            {(data.canSeeAll || data.teams.length > 1) && (
              // Wrapped: the select's own full width would win over a width
              // passed in, and push the arrows onto a second line
              <div className="mr-1 w-40">
                <Select
                  value={team || data.team?._id || ''}
                  onChange={e => setTeam(e.target.value)}
                  aria-label="Team"
                  className="py-2 text-sm"
                >
                  {data.canSeeAll && <option value="">Everybody</option>}
                  {data.teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                </Select>
              </div>
            )}
            <button
              type="button"
              aria-label="Previous week"
              onClick={() => setWeek(addDays(facts.week.start, -7))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-content-muted hover:text-content"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next week"
              disabled={data.isCurrentWeek}
              onClick={() => setWeek(addDays(facts.week.start, 7))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-content-muted hover:text-content disabled:opacity-40"
            >
              ›
            </button>
            {report && (
              <Button size="sm" onClick={() => window.print()} className="ml-1">
                <IconPrinter className="h-4 w-4" />
                Download PDF
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard value={hours(facts.hours.total)} label="Hours logged" tone="brand" />
        <StatCard value={`${facts.hours.billablePercent}%`} label={`Billable · ${hours(facts.hours.billable)}`} tone="positive" />
        <StatCard value={facts.projects.length} label="Projects worked on" tone="neutral" />
        <StatCard
          value={facts.openBlockers.length}
          label="Open blockers"
          tone={facts.openBlockers.length ? 'danger' : 'neutral'}
        />
      </div>

      {report || writing ? (
        <AiReport
          className="print-plain mb-5"
          title={`Status report · ${facts.week.label}`}
          text={report?.content || ''}
          loading={writing}
          error={writeError}
          scroll={false}
          footnote={
            report
              ? `Written ${new Date(report.generatedAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}${report.generatedByName ? ` for ${report.generatedByName}` : ' on Friday afternoon'} · ${AI_MODEL_LABEL}`
              : AI_MODEL_LABEL
          }
          onRegenerate={data.aiAvailable ? write : undefined}
          onCopy={copy}
        />
      ) : (
        <div className="no-print mb-5 flex flex-col gap-4 rounded-card bg-brand-600 p-5 text-white shadow-card dark:bg-surface-raised dark:text-content md:flex-row md:items-center md:p-6">
          <IconSparkles className="h-8 w-8 shrink-0 text-brand-400" />
          <div className="min-w-0 flex-1">
            <p className="text-lg tracking-tight">
              {facts.hours.total
                ? `${hours(facts.hours.total)} across ${facts.projects.length} ${facts.projects.length === 1 ? 'project' : 'projects'} this week`
                : 'No hours logged against projects yet'}
            </p>
            <p className="mt-0.5 text-sm text-white/70 dark:text-content-muted">
              {data.aiAvailable
                ? 'The report is written on Friday at 5pm. Write it now to send an update today.'
                : 'Writing is switched off on this server. The numbers below are still up to date.'}
            </p>
            {writeError && <p className="mt-2 text-sm text-red-300 dark:text-red-400">{writeError}</p>}
          </div>
          {data.aiAvailable && (
            <Button variant="subtle" onClick={write}>
              <IconSparkles className="h-4 w-4" />
              Write the report
            </Button>
          )}
        </div>
      )}

      {/* minmax(0, …) on a phone too: a long project name set the column's width */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card padded={false} className="print-plain">
          <div className="px-4 pt-4 md:px-6 md:pt-5">
            <CardTitle className="mb-0">Hours by project</CardTitle>
          </div>
          {facts.projects.length === 0 ? (
            <p className="px-4 pb-5 pt-3 text-sm text-content-subtle md:px-6">
              Nobody logged hours against a project this week.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {facts.projects.map(project => (
                <li key={project.name} className="px-4 py-3.5 md:px-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium text-content">
                      {project.name}
                      {project.client && <span className="font-normal text-content-subtle"> · {project.client}</span>}
                    </p>
                    <p className="tabular shrink-0 text-sm text-content">
                      {hours(project.hours)} <span className="text-xs text-content-subtle">{project.share}%</span>
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
                    <div
                      className={project.billable ? 'h-full rounded-full bg-brand-600 dark:bg-brand-400' : 'h-full rounded-full bg-content-subtle'}
                      style={{ width: `${Math.max(3, (project.hours / top) * 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-subtle">
                    {!project.billable && <Badge>Non-billable</Badge>}
                    <span>
                      {project.contributors.slice(0, 5).map(c => `${c.name} ${hours(c.hours)}`).join(' · ')}
                      {project.contributors.length > 5 && ` · +${project.contributors.length - 5} more`}
                    </span>
                    {project.blockers.length > 0 && (
                      <span className="text-red-600 dark:text-red-400">
                        {project.blockers.length} {project.blockers.length === 1 ? 'blocker' : 'blockers'} raised
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="no-print space-y-5">
          <Card>
            <CardTitle>Open blockers</CardTitle>
            {facts.openBlockers.length === 0 ? (
              <p className="text-sm text-content-subtle">Nobody ended the week blocked.</p>
            ) : (
              <ul className="space-y-2.5 text-sm">
                {facts.openBlockers.map(b => (
                  <li key={b.name}>
                    <p className="text-content">{b.name}</p>
                    <p className="text-xs text-content-muted">{b.blocker}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <CardTitle className="mb-0">People</CardTitle>
              <span className="text-xs text-content-subtle">
                {facts.standups.rate}% of standups filed
              </span>
            </div>
            <ul className="divide-y divide-line/70 text-sm">
              {facts.team.map(p => (
                <li key={p.name} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-content">{p.name}</span>
                  <span className="tabular shrink-0 text-xs text-content-muted">
                    {hours(p.hours)} · {p.standups} {p.standups === 1 ? 'standup' : 'standups'}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}
