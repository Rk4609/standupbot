import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import ExportButton from '../components/ExportButton'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Skeleton from '../components/ui/Skeleton'
import StatCard from '../components/ui/StatCard'
import EmptyState from '../components/ui/EmptyState'
import PageSizeSelect from '../components/ui/PageSizeSelect'
import ListPager from '../components/ui/ListPager'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import { IconAlert, IconPencil, IconSearch, IconUsers } from '../components/ui/icons'
import { cn } from '../lib/cn'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { STATE_LABEL, STATE_TONE, duration, initials, minutesSince } from '../lib/attendance'
import { addDays, shortDay } from '../lib/leave'
import { usePaged } from '../lib/paging'

const longDay = (iso) =>
  new Date(`${iso}T00:00:00.000Z`).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  })

const FILTERS = [
  { id: 'all', label: 'Everybody', test: () => true },
  { id: 'late', label: 'Late', test: p => p.record?.late },
  { id: 'missing', label: 'Not in', test: p => ['absent', 'not-in'].includes(p.state) },
  { id: 'leave', label: 'On leave', test: p => p.state === 'leave' },
  { id: 'fix', label: 'No check-out', test: p => p.state === 'no-checkout' }
]

/** Fix one person's day: a forgotten check-out, or a day at a client site. */
function CorrectForm({ person, date, onClose, onSaved }) {
  const [form, setForm] = useState({
    checkIn: person.record?.inAt || '10:00',
    checkOut: person.record?.outAt || '',
    reason: ''
  })
  const [saving, setSaving] = useState(false)
  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const wrongWay = form.checkOut && form.checkOut <= form.checkIn
  const ready = form.checkIn && !wrongWay && form.reason.trim().length >= 3

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await API.post('/attendance/correct', {
        user: person.user._id,
        date,
        checkIn: form.checkIn,
        checkOut: form.checkOut || null,
        reason: form.reason.trim()
      })
      toast.success(data.message)
      onSaved()
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not save that'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Correct ${person.user.name}`} subtitle={longDay(date)} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Checked in">
            <Input type="time" value={form.checkIn} onChange={e => set('checkIn', e.target.value)} />
          </Field>
          <Field label="Checked out" error={wrongWay ? 'Before the check-in' : undefined}>
            <Input type="time" value={form.checkOut} onChange={e => set('checkOut', e.target.value)} />
          </Field>
        </div>
        <Field label="Reason" hint="Saved with the day and in the activity log.">
          <Textarea
            rows={2}
            maxLength={300}
            value={form.reason}
            onChange={e => set('reason', e.target.value)}
            placeholder="Forgot to check out"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Not now</Button>
          <Button type="submit" loading={saving} disabled={!ready}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Who is in, who is late and who is off — one day across the team.
 */
export default function TeamAttendance() {
  const live = useLiveRefresh()
  const [date, setDate] = useState(null)
  const [team, setTeam] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [fixing, setFixing] = useState(null)

  // Page the people the filter and search leave; the counts use everybody
  const query = search.trim().toLowerCase()
  const shown = (data?.people || [])
    .filter(FILTERS.find(f => f.id === filter).test)
    .filter(p => !query || p.user.name.toLowerCase().includes(query) || p.user.position.toLowerCase().includes(query))
  const paged = usePaged(shown, 'team-attendance')

  // Another day or team starts the list from the top
  const pickDate = (day) => {
    setDate(day)
    paged.setPage(1)
  }

  const load = useCallback(() => {
    const params = {}
    if (date) params.date = date
    if (team) params.team = team
    return API.get('/attendance/team', { params })
      .then(res => {
        setData(res.data)
        setError('')
      })
      .catch(err => setError(apiErrorMessage(err, 'Could not load attendance')))
  }, [date, team])

  useEffect(() => {
    load()
  }, [load, live])

  if (error && !data) {
    return (
      <PageShell>
        <PageHeader title="Team attendance" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell>
        <Skeleton className="mb-2 h-9 w-56" />
        <Skeleton className="mb-7 h-4 w-72" />
        <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-5">
          {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-card" />)}
        </div>
        <Skeleton className="h-96 rounded-card" />
      </PageShell>
    )
  }

  const isToday = data.date === data.today
  const { counts } = data

  return (
    <PageShell>
      <PageHeader
        title="Team attendance"
        subtitle={`${longDay(data.date)} · office starts ${data.policy.start}`}
        actions={
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1">
              <ExportButton path="/exports/attendance" params={{ month: data.date.slice(0, 7) }} label="Export month" fallbackName="attendance.csv" />
            </span>
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => pickDate(addDays(data.date, -1))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-content-muted hover:text-content"
            >
              ‹
            </button>
            <Input
              type="date"
              aria-label="Day"
              value={data.date}
              max={data.today}
              onChange={e => e.target.value && pickDate(e.target.value)}
              className="w-40 py-2 text-sm"
            />
            <button
              type="button"
              aria-label="Next day"
              disabled={isToday}
              onClick={() => pickDate(addDays(data.date, 1))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-content-muted hover:text-content disabled:opacity-40"
            >
              ›
            </button>
            {!isToday && (
              <Button size="sm" variant="outline" onClick={() => pickDate(data.today)}>Today</Button>
            )}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 md:gap-4">
        <StatCard value={isToday ? counts.in : counts.in + counts.done} label={isToday ? 'In now' : 'Came in'} tone="positive" />
        <StatCard value={counts.late} label="Late" tone="warning" />
        <StatCard value={counts.leave} label="On leave" tone="neutral" />
        <StatCard value={counts.missing} label={isToday ? 'Not in yet' : 'Absent'} tone="danger" />
        <StatCard
          value={`${counts.total ? Math.round(((counts.in + counts.done) / Math.max(1, counts.total - counts.leave)) * 100) : 0}%`}
          label={`Attendance · ${counts.total} people`}
          tone="brand"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <Card padded={false}>
        <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="scroll-slim -mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Show">
            {FILTERS.map(f => {
              const n = data.people.filter(f.test).length
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => { setFilter(f.id); paged.setPage(1) }}
                  className={cn(
                    'shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-colors',
                    filter === f.id
                      ? 'bg-brand-600 font-medium text-white dark:bg-brand-400 dark:text-brand-700'
                      : 'bg-surface-sunken text-content-muted hover:text-content'
                  )}
                >
                  {f.label} <span className="tabular opacity-70">{n}</span>
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 md:flex">
            {paged.total > 10 && <PageSizeSelect value={paged.size} onChange={paged.setSize} />}
            {data.teams.length > 1 && (
              <Select
                value={team}
                onChange={e => { setTeam(e.target.value); paged.setPage(1) }}
                aria-label="Team"
                className="py-2 text-sm md:w-40"
              >
                <option value="">All teams</option>
                {data.teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
              </Select>
            )}
            <Input
              icon={IconSearch}
              value={search}
              onChange={e => { setSearch(e.target.value); paged.setPage(1) }}
              placeholder="Search people"
              aria-label="Search people"
              className="py-2 text-sm md:w-52"
            />
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="px-4 pb-6 md:px-6">
            <EmptyState
              icon={<IconUsers className="h-6 w-6" />}
              title={data.people.length === 0 ? 'Nobody on your teams yet' : 'Nobody here'}
              description={data.people.length === 0 ? 'People on the teams you lead show up here.' : 'Try another filter.'}
            />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-line border-t border-line">
              {paged.rows.map(person => {
                const r = person.record
                const worked = r ? (r.minutes ?? (person.state === 'working' ? minutesSince(r.checkIn) : null)) : null

                return (
                  <li key={person.user._id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 md:grid-cols-[auto_minmax(0,1.4fr)_repeat(3,minmax(0,0.6fr))_auto] md:px-6">
                    <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-surface-sunken text-[11px] font-semibold text-content-muted">
                      {person.user.avatar
                        ? <img src={person.user.avatar} alt="" className="h-full w-full object-cover" />
                        : initials(person.user.name)}
                    </span>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate text-sm font-medium text-content">{person.user.name}</span>
                        {STATE_LABEL[person.state] && (
                          <Badge tone={STATE_TONE[person.state]}>{STATE_LABEL[person.state]}</Badge>
                        )}
                        {r?.late && <Badge tone="warning">Late {r.lateBy}m</Badge>}
                      </div>
                      <p className="truncate text-xs text-content-subtle">
                        {[person.user.position, person.user.team].filter(Boolean).join(' · ')}
                      </p>
                      {/* On a phone the times sit under the name */}
                      <p className="tabular mt-0.5 text-xs text-content-muted md:hidden">
                        {r
                          ? `${r.inAt} – ${r.outAt || '…'} · ${duration(worked)}`
                          : person.leave
                            ? `${person.leave.type} leave · back after ${shortDay(person.leave.to)}`
                            : ''}
                      </p>
                      <p className="mt-0.5 text-[11px] text-content-subtle">
                        This month: {person.month.present} present · {person.month.late} late · {person.month.absent} absent
                      </p>
                    </div>

                    <div className="hidden text-sm md:block">
                      <p className="text-[11px] text-content-subtle">In</p>
                      <p className="tabular text-content">{r?.inAt || '—'}</p>
                    </div>
                    <div className="hidden text-sm md:block">
                      <p className="text-[11px] text-content-subtle">Out</p>
                      <p className="tabular text-content">{r?.outAt || '—'}</p>
                    </div>
                    <div className="hidden text-sm md:block">
                      <p className="text-[11px] text-content-subtle">{person.leave && !r ? 'Back after' : 'Worked'}</p>
                      <p className="tabular text-content">
                        {person.leave && !r ? shortDay(person.leave.to) : duration(worked)}
                      </p>
                    </div>

                    {person.state !== 'leave' && person.state !== 'weekend' ? (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => setFixing(person)}
                        aria-label={`Correct ${person.user.name}`}
                      >
                        <IconPencil className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Correct</span>
                      </Button>
                    ) : <span />}
                  </li>
                )
              })}
            </ul>
            <ListPager paged={paged} />
          </>
        )}
      </Card>

      <AnimatePresence>
        {fixing && (
          <CorrectForm
            person={fixing}
            date={data.date}
            onClose={() => setFixing(null)}
            onSaved={load}
          />
        )}
      </AnimatePresence>
    </PageShell>
  )
}
