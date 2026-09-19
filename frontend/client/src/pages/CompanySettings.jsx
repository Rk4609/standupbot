import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { Field, Input } from '../components/ui/Field'
import { IconAlert, IconPlus, IconTrash } from '../components/ui/icons'
import { apiErrorMessage } from '../lib/apiError'
import { prettyDate } from '../lib/dates'

/** National and widely observed holidays in India for 2026, to start from. */
const INDIA_2026 = [
  { date: '2026-01-26', name: 'Republic Day' },
  { date: '2026-03-04', name: 'Holi' },
  { date: '2026-03-21', name: 'Id-ul-Fitr' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-05-01', name: 'Labour Day' },
  { date: '2026-08-15', name: 'Independence Day' },
  { date: '2026-08-28', name: 'Raksha Bandhan' },
  { date: '2026-10-02', name: 'Gandhi Jayanti' },
  { date: '2026-10-20', name: 'Dussehra' },
  { date: '2026-11-08', name: 'Diwali' },
  { date: '2026-11-24', name: 'Guru Nanak Jayanti' },
  { date: '2026-12-25', name: 'Christmas' }
]

const Num = ({ label, value, onChange, hint, step = 1, suffix }) => (
  <Field label={label} hint={hint}>
    <div className="flex items-center gap-2">
      {/* Named directly: the wrapper for the unit sits between the label and the field */}
      <Input type="number" min="0" step={step} aria-label={label} value={value} onChange={e => onChange(e.target.value)} className="py-2" />
      {suffix && <span className="shrink-0 text-xs text-content-subtle">{suffix}</span>}
    </div>
  </Field>
)

/**
 * The rules the whole company works by: office hours, leave allowances, how
 * pay is split, and the days the office is closed. Saved values apply at once
 * to attendance, leave and the next payroll run.
 */
export default function CompanySettings() {
  const [data, setData] = useState(null)
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [holiday, setHoliday] = useState({ date: '', name: '' })

  useEffect(() => {
    API.get('/settings')
      .then(res => {
        setData(res.data)
        setForm({ office: res.data.office, leave: res.data.leave, pay: res.data.pay, holidays: res.data.holidays })
      })
      .catch(err => setError(apiErrorMessage(err, 'Could not load settings')))
  }, [])

  const set = (section, field, value) => setForm(f => ({ ...f, [section]: { ...f[section], [field]: value } }))

  const numbers = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, k === 'start' ? v : Number(v)]))

  const save = async (sections) => {
    setSaving(true)
    try {
      const body = {}
      for (const s of sections) body[s] = s === 'holidays' ? form.holidays : numbers(form[s])
      await API.put('/settings', body)
      toast.success('Settings saved — they apply from now')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not save that'))
    } finally {
      setSaving(false)
    }
  }

  const addHolidays = (list) => {
    setForm(f => {
      const byDate = new Map(f.holidays.map(h => [h.date, h]))
      for (const h of list) if (!byDate.has(h.date)) byDate.set(h.date, h)
      return { ...f, holidays: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) }
    })
  }

  if (error) {
    return (
      <PageShell>
        <PageHeader title="Company settings" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (!form) {
    return (
      <PageShell>
        <Skeleton className="mb-7 h-9 w-60" />
        <div className="grid gap-5 lg:grid-cols-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-card" />)}</div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Company settings"
        subtitle={data.updatedByName ? `Last changed by ${data.updatedByName} · ${prettyDate(data.updatedAt)}` : 'The rules attendance, leave and payroll follow.'}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Office hours</CardTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Office starts">
              <Input type="time" value={form.office.start} onChange={e => set('office', 'start', e.target.value)} className="py-2" />
            </Field>
            <Num label="Grace" suffix="min" value={form.office.graceMinutes} onChange={v => set('office', 'graceMinutes', v)} />
            <Num label="Full day" suffix="hours" step={0.5} value={form.office.fullDayHours} onChange={v => set('office', 'fullDayHours', v)} />
            <Num label="Half day under" suffix="hours" step={0.5} value={form.office.halfDayHours} onChange={v => set('office', 'halfDayHours', v)} />
          </div>
          <p className="mt-3 text-xs text-content-subtle">Late means checking in after the start plus the grace.</p>
          <Button size="sm" className="mt-4" loading={saving} onClick={() => save(['office'])}>Save office hours</Button>
        </Card>

        <Card>
          <CardTitle>Leave each year</CardTitle>
          <div className="grid grid-cols-3 gap-3">
            <Num label="Casual" suffix="days" value={form.leave.casual} onChange={v => set('leave', 'casual', v)} />
            <Num label="Sick" suffix="days" value={form.leave.sick} onChange={v => set('leave', 'sick', v)} />
            <Num label="Earned" suffix="days" value={form.leave.earned} onChange={v => set('leave', 'earned', v)} />
          </div>
          <p className="mt-3 text-xs text-content-subtle">Unpaid leave has no limit. Weekends and holidays are never counted.</p>
          <Button size="sm" className="mt-4" loading={saving} onClick={() => save(['leave'])}>Save leave</Button>
        </Card>

        {form.pay && (
          <Card>
            <CardTitle>Payroll</CardTitle>
            <div className="grid grid-cols-2 gap-3">
              <Num label="Basic" suffix="% of gross" value={form.pay.basicPercent} onChange={v => set('pay', 'basicPercent', v)} />
              <Num label="HRA" suffix="% of gross" value={form.pay.hraPercent} onChange={v => set('pay', 'hraPercent', v)} />
              <Num label="Provident fund" suffix="% of basic" value={form.pay.pfRate} onChange={v => set('pay', 'pfRate', v)} />
              <Num label="PF wage ceiling" suffix="₹" value={form.pay.pfWageCeiling} onChange={v => set('pay', 'pfWageCeiling', v)} />
              <Num label="Professional tax" suffix="₹ / month" value={form.pay.professionalTax} onChange={v => set('pay', 'professionalTax', v)} />
              <Num label="…from a gross of" suffix="₹" value={form.pay.professionalTaxFrom} onChange={v => set('pay', 'professionalTaxFrom', v)} />
            </div>
            <p className="mt-3 text-xs text-content-subtle">The rest of gross is the special allowance. Applies to the next payroll run; published slips do not change.</p>
            <Button size="sm" className="mt-4" loading={saving} onClick={() => save(['pay'])}>Save payroll</Button>
          </Card>
        )}

        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="mb-0">Holidays</CardTitle>
            <Button size="xs" variant="outline" onClick={() => addHolidays(INDIA_2026)}>Add India 2026 list</Button>
          </div>

          <div className="mb-3 grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] gap-2">
            <Input type="date" aria-label="Holiday date" value={holiday.date} onChange={e => setHoliday(h => ({ ...h, date: e.target.value }))} className="py-2 text-sm" />
            <Input aria-label="Holiday name" placeholder="Diwali" value={holiday.name} maxLength={80} onChange={e => setHoliday(h => ({ ...h, name: e.target.value }))} className="py-2 text-sm" />
            <Button
              size="sm"
              variant="outline"
              aria-label="Add holiday"
              disabled={!holiday.date || holiday.name.trim().length < 2}
              onClick={() => { addHolidays([{ date: holiday.date, name: holiday.name.trim() }]); setHoliday({ date: '', name: '' }) }}
            >
              <IconPlus className="h-4 w-4" />
            </Button>
          </div>

          {form.holidays.length === 0 ? (
            <p className="text-sm text-content-subtle">No holidays yet. Until there are, only weekends are days off.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-line overflow-y-auto">
              {form.holidays.map(h => (
                <li key={h.date} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="tabular w-28 shrink-0 text-content-muted">{prettyDate(`${h.date}T00:00:00Z`)}</span>
                  <span className="min-w-0 flex-1 truncate text-content">{h.name}</span>
                  <button type="button" aria-label={`Remove ${h.name}`} onClick={() => setForm(f => ({ ...f, holidays: f.holidays.filter(x => x.date !== h.date) }))}
                    className="rounded-full p-1.5 text-content-subtle hover:bg-red-500/10 hover:text-red-600">
                    <IconTrash className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button size="sm" className="mt-4" loading={saving} onClick={() => save(['holidays'])}>
            Save holidays ({form.holidays.length})
          </Button>
        </Card>
      </div>
    </PageShell>
  )
}
