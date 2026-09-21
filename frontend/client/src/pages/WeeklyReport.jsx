import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
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
import { weekdayShort } from '../lib/week'

/** The change since last week, green when it is good news and red when not. */
function SinceLastWeek({ now, before, unit = '', fewerIsBetter = false }) {
  if (before == null || now === before) return null
  const diff = now - before
  const good = fewerIsBetter ? diff < 0 : diff > 0

  return (
    <span
      title="Compared with last week"
      className={good ? 'ml-1 font-semibold text-emerald-600 dark:text-emerald-400' : 'ml-1 font-semibold text-red-600 dark:text-red-400'}
    >
      {diff > 0 ? '↑' : '↓'}
      {Math.abs(diff)}
      {unit}
      <span className="sr-only"> on last week</span>
    </span>
  )
}

/**
 * The week's work as the team's standups tell it, and a written status
 * report to send on.
 *
 * Made to be forwarded: "Download PDF" prints just the report and what the
 * team worked on. Moods and attendance are never on it — those stay in the
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

  const { facts, report, lastWeek } = data
  const reporting = facts.team.filter(p => p.standups > 0).length

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
        <StatCard value={facts.standups.submitted} label={`Standups filed · of ${facts.standups.expected}`} tone="brand" />
        <StatCard value={reporting} label={`People reporting · of ${facts.people}`} tone="positive" />
        <StatCard value={facts.blockersRaised} label="Blockers raised" tone="neutral" />
        <StatCard
          value={facts.openBlockers.length}
          label={<>Open blockers<SinceLastWeek now={facts.openBlockers.length} before={lastWeek?.openBlockers} fewerIsBetter /></>}
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
              {facts.standups.submitted
                ? `${facts.standups.submitted} ${facts.standups.submitted === 1 ? 'standup' : 'standups'} from ${reporting} ${reporting === 1 ? 'person' : 'people'} this week`
                : 'No standups filed yet this week'}
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

      {/* minmax(0, …) on a phone too: a long plan set the column's width */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card padded={false} className="print-plain">
          <div className="px-4 pt-4 md:px-6 md:pt-5">
            <CardTitle className="mb-0">What the team worked on</CardTitle>
          </div>
          {reporting === 0 ? (
            <p className="px-4 pb-5 pt-3 text-sm text-content-subtle md:px-6">
              Nobody filed a standup this week.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {facts.team.filter(p => p.updates.length > 0).map(person => (
                <li key={person.name} className="px-4 py-3.5 md:px-6">
                  <p className="truncate text-sm font-medium text-content">{person.name}</p>
                  <ul className="mt-1.5 space-y-1">
                    {person.updates.map(u => (
                      <li key={u.date} className="flex gap-3 text-sm text-content-muted">
                        <span className="w-9 shrink-0 text-xs leading-5 text-content-subtle">{weekdayShort(u.date)}</span>
                        <span className="min-w-0">{u.text}</span>
                      </li>
                    ))}
                  </ul>
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
                <SinceLastWeek now={facts.standups.rate} before={lastWeek?.standupRate} unit="%" />
              </span>
            </div>
            <ul className="divide-y divide-line/70 text-sm">
              {facts.team.map(p => (
                <li key={p.name} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-content">{p.name}</span>
                  <span className="tabular shrink-0 text-xs text-content-muted">
                    {p.standups} {p.standups === 1 ? 'standup' : 'standups'}
                    {p.blocked > 0 && ` · blocked ${p.blocked}`}
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
