import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { Select } from '../components/ui/Field'
import { IconAlert, IconSparkles, IconUsers } from '../components/ui/icons'
import AiReport from '../components/AiReport'
import { AI_MODEL_LABEL } from '../lib/ai'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { addDays, shortDay } from '../lib/leave'

const longDay = (iso) =>
  new Date(`${iso}T00:00:00.000Z`).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC'
  })

/** A heading, a count, and a list that says so when it is empty. */
function FactCard({ title, count, tone = 'neutral', empty, children, link }) {
  return (
    <Card className="flex flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <CardTitle className="mb-0">{title}</CardTitle>
        {count !== undefined && <Badge tone={count ? tone : 'neutral'}>{count}</Badge>}
      </div>
      <div className="flex-1 text-sm">
        {children || <p className="text-content-subtle">{empty}</p>}
      </div>
      {link && <div className="mt-3 border-t border-line pt-2.5 text-xs">{link}</div>}
    </Card>
  )
}

const Row = ({ name, detail, tone }) => (
  <li className="flex items-start justify-between gap-3 py-1.5">
    <span className="text-content">{name}</span>
    <span className={tone === 'danger' ? 'text-right text-xs text-red-600 dark:text-red-400' : 'text-right text-xs text-content-subtle'}>
      {detail}
    </span>
  </li>
)

/**
 * The morning brief: what the records say about the team today, and a short
 * written version from the model.
 *
 * The facts are always shown, worked out fresh on every visit. The written
 * brief is kept once made — by the 11am job or the button — so the page opens
 * at once and says when it was written.
 */
export default function Brief() {
  const live = useLiveRefresh()
  const [date, setDate] = useState(null)
  const [team, setTeam] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [writing, setWriting] = useState(false)
  const [writeError, setWriteError] = useState('')

  const load = useCallback(() => {
    const params = {}
    if (date) params.date = date
    if (team) params.team = team
    return API.get('/brief', { params })
      .then(res => {
        setData(res.data)
        setError('')
      })
      .catch(err => setError(apiErrorMessage(err, 'Could not load the brief')))
  }, [date, team])

  useEffect(() => {
    load()
  }, [load, live])

  const write = async () => {
    setWriting(true)
    setWriteError('')
    try {
      const { data: res } = await API.post('/brief', {
        ...(data?.date ? { date: data.date } : {}),
        ...(team ? { team } : {})
      })
      setData(d => ({ ...d, brief: res.brief, facts: res.facts }))
    } catch (err) {
      setWriteError(apiErrorMessage(err, 'The brief could not be written'))
    } finally {
      setWriting(false)
    }
  }

  if (error && !data) {
    return (
      <PageShell>
        <PageHeader title="Daily brief" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (data?.noTeam) {
    return (
      <PageShell>
        <PageHeader title="Daily brief" />
        <EmptyState icon={<IconUsers className="h-6 w-6" />} title={data.message} description="A brief covers a team you lead." />
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell>
        <Skeleton className="mb-2 h-9 w-48" />
        <Skeleton className="mb-7 h-4 w-72" />
        <Skeleton className="mb-5 h-56 rounded-card" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-44 rounded-card" />)}
        </div>
      </PageShell>
    )
  }

  const { facts, brief } = data
  const isToday = data.date === data.today
  const attention = [
    ...facts.stuck.map(s => ({ key: `s${s.name}`, name: s.name, detail: `Blocked ${s.days} standups: ${s.blocker}` })),
    ...facts.lowMood.map(p => ({ key: `m${p.name}`, name: p.name, detail: `Mood: ${p.moods.join(', ')}` })),
    ...facts.missingOften.map(p => ({ key: `o${p.name}`, name: p.name, detail: `Missed ${p.missed} of ${p.of} standups` })),
    ...facts.attendance.lateOften.map(p => ({ key: `l${p.name}`, name: p.name, detail: `Late ${p.days} days in two weeks` }))
  ]

  const copy = () => {
    navigator.clipboard?.writeText(brief.summary)
      .then(() => toast.success('Brief copied'))
      .catch(() => toast.error('Could not copy'))
  }

  return (
    <PageShell>
      <PageHeader
        title="Daily brief"
        subtitle={`${data.title} · ${longDay(data.date)}`}
        actions={
          <div className="flex flex-wrap items-center gap-1">
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
              aria-label="Previous day"
              onClick={() => setDate(addDays(data.date, -1))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-content-muted hover:text-content"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next day"
              disabled={isToday}
              onClick={() => setDate(addDays(data.date, 1))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-content-muted hover:text-content disabled:opacity-40"
            >
              ›
            </button>
            {!isToday && <Button size="sm" variant="outline" onClick={() => setDate(data.today)}>Today</Button>}
          </div>
        }
      />

      {brief || writing ? (
        <AiReport
          className="mb-5"
          title={isToday ? "Today's brief" : `Brief for ${shortDay(data.date)}`}
          text={brief?.summary || ''}
          loading={writing}
          error={writeError}
          scroll={false}
          footnote={
            brief
              ? `Written ${new Date(brief.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${brief.generatedByName ? ` by request of ${brief.generatedByName}` : ' by the morning job'} · ${AI_MODEL_LABEL}`
              : AI_MODEL_LABEL
          }
          onRegenerate={data.aiAvailable ? write : undefined}
          onCopy={copy}
        />
      ) : (
        <div className="mb-5 flex flex-col gap-4 rounded-card bg-brand-600 p-5 text-white shadow-card dark:bg-surface-raised dark:text-content md:flex-row md:items-center md:p-6">
          <IconSparkles className="h-8 w-8 shrink-0 text-brand-400" />
          <div className="min-w-0 flex-1">
            <p className="text-lg tracking-tight">
              {facts.attention > 0
                ? `${facts.attention} ${facts.attention === 1 ? 'thing needs' : 'things need'} your attention`
                : 'Nothing is on fire'}
            </p>
            <p className="mt-0.5 text-sm text-white/70 dark:text-content-muted">
              {data.aiAvailable
                ? 'The brief is written at 11am on working days. Write it now to read it as a few lines.'
                : 'The AI brief is switched off on this server. The facts below are still up to date.'}
            </p>
            {writeError && <p className="mt-2 text-sm text-red-300 dark:text-red-400">{writeError}</p>}
          </div>
          {data.aiAvailable && (
            <Button variant="subtle" onClick={write}>
              <IconSparkles className="h-4 w-4" />
              Write the brief
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <FactCard
          title="Needs attention"
          count={attention.length}
          tone="danger"
          empty="Nobody is stuck, low or falling behind."
        >
          {attention.length > 0 && (
            <ul className="divide-y divide-line/70">
              {attention.map(item => <Row key={item.key} name={item.name} detail={item.detail} tone="danger" />)}
            </ul>
          )}
        </FactCard>

        <FactCard
          title="Standups"
          count={facts.standups.expected ? `${facts.standups.submitted}/${facts.standups.expected}` : undefined}
          tone={facts.standups.submitted === facts.standups.expected ? 'positive' : 'warning'}
          empty={facts.workday ? 'Everybody expected has filed.' : 'A weekend — no standups expected.'}
          link={facts.blockers.length > 0 && (
            <Link to="/blockers" className="text-content-muted underline underline-offset-2 hover:text-content">
              {facts.blockers.length} {facts.blockers.length === 1 ? 'blocker' : 'blockers'} today
            </Link>
          )}
        >
          {facts.standups.missing.length > 0 && (
            <>
              <p className="mb-1.5 text-xs text-content-subtle">Not filed {isToday ? 'yet' : ''}</p>
              <div className="flex flex-wrap gap-1.5">
                {facts.standups.missing.map(name => (
                  <span key={name} className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs text-content-muted">{name}</span>
                ))}
              </div>
            </>
          )}
        </FactCard>

        <FactCard
          title="Attendance"
          count={facts.attendance.late.length}
          tone="warning"
          empty={facts.attendance.in ? `${facts.attendance.in} in, nobody late.` : 'Nobody has checked in.'}
          link={
            <Link to="/team-attendance" className="text-content-muted underline underline-offset-2 hover:text-content">
              {facts.attendance.in} in{facts.attendance.notIn.length ? ` · ${facts.attendance.notIn.length} not in` : ''}
            </Link>
          }
        >
          {(facts.attendance.late.length > 0 || facts.attendance.noCheckout.length > 0) && (
            <ul className="divide-y divide-line/70">
              {facts.attendance.late.map(p => <Row key={p.name} name={p.name} detail={`in ${p.inAt} · ${p.lateBy}m late`} />)}
              {facts.attendance.noCheckout.map(name => <Row key={`n${name}`} name={name} detail="no check-out last working day" />)}
            </ul>
          )}
        </FactCard>

        <FactCard
          title="Leave"
          count={facts.leave.today.length}
          empty="Nobody is off today, and nothing is coming up this week."
          link={facts.leave.pending > 0 && (
            <Link to="/leaves" className="text-content-muted underline underline-offset-2 hover:text-content">
              {facts.leave.pending} {facts.leave.pending === 1 ? 'request' : 'requests'} waiting on a decision
            </Link>
          )}
        >
          {(facts.leave.today.length > 0 || facts.leave.upcoming.length > 0) && (
            <ul className="divide-y divide-line/70">
              {facts.leave.today.map(p => <Row key={p.name} name={p.name} detail={`${p.type} · back after ${shortDay(p.until)}`} />)}
              {facts.leave.upcoming.map(p => <Row key={`u${p.name}`} name={p.name} detail={`${p.type} from ${shortDay(p.from)}`} />)}
            </ul>
          )}
        </FactCard>
      </div>

      {facts.goodNews.length > 0 && (
        <Card className="mt-4">
          <CardTitle>Good news</CardTitle>
          <ul className="space-y-1 text-sm text-content">
            {facts.goodNews.map(line => <li key={line}>· {line}</li>)}
          </ul>
        </Card>
      )}
    </PageShell>
  )
}
