import { useState } from 'react'
import toast from 'react-hot-toast'
import API from '../api/axios'
import Button from './ui/Button'
import { Field, Input, Select } from './ui/Field'
import { apiErrorMessage } from '../lib/apiError'
import { asDateInput } from '../lib/dates'

const TYPES = [
  { value: 'intern', label: 'Intern' },
  { value: 'probation', label: 'On probation' },
  { value: 'full-time', label: 'Full time' },
  { value: 'contract', label: 'Contract' }
]

const formFrom = (person) => ({
  name: person.name || '',
  phone: person.phone || '',
  dob: asDateInput(person.dob),
  address: {
    line1: person.address?.line1 || '',
    city: person.address?.city || '',
    state: person.address?.state || '',
    pincode: person.address?.pincode || '',
    country: person.address?.country || ''
  },
  employment: {
    employeeId: person.employment?.employeeId || '',
    position: person.employment?.position || '',
    department: person.employment?.department || '',
    type: person.employment?.type || 'full-time',
    joinedOn: asDateInput(person.employment?.joinedOn),
    startsOn: asDateInput(person.employment?.startsOn),
    endsOn: asDateInput(person.employment?.endsOn),
    experienceYears: person.employment?.experienceYears ?? 0
  },
  salary: {
    amount: person.salary?.amount ?? '',
    currency: person.salary?.currency || 'INR',
    period: person.salary?.period || 'year',
    reviewedOn: asDateInput(person.salary?.reviewedOn)
  }
})

/**
 * One person's record, open for editing.
 *
 * Everything in one form rather than a field at a time: a record is filled in
 * when somebody joins and corrected in one sitting afterwards, and a screen
 * that saves on every keystroke turns a correction into twelve audit entries.
 *
 * Pay is a section that simply is not rendered for a reader whose role does
 * not include it — the server does not send the figure either, so there is
 * nothing here to reveal with a dev tools panel.
 */
export default function PersonRecord({ person, maySeePay, onSaved }) {
  const [form, setForm] = useState(() => formFrom(person))
  const [saving, setSaving] = useState(false)

  const patch = (section, field, value) =>
    setForm(f => (section ? { ...f, [section]: { ...f[section], [field]: value } } : { ...f, [field]: value }))

  const temporary = ['intern', 'probation'].includes(form.employment.type)

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        dob: form.dob || null,
        address: form.address,
        employment: {
          ...form.employment,
          experienceYears: Number(form.employment.experienceYears) || 0,
          joinedOn: form.employment.joinedOn || null,
          // A window only means something while it is one
          startsOn: temporary ? form.employment.startsOn || null : null,
          endsOn: temporary ? form.employment.endsOn || null : null
        },
        ...(maySeePay
          ? {
              salary: {
                ...form.salary,
                amount: form.salary.amount === '' ? null : Number(form.salary.amount),
                reviewedOn: form.salary.reviewedOn || null
              }
            }
          : {})
      }

      const { data } = await API.patch(`/people/${person._id}`, body)
      toast.success(data.message)
      onSaved?.(data.person)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not save that'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <section>
        <p className="eyebrow mb-2.5">Who they are</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name">
            <Input
              value={form.name}
              onChange={e => patch(null, 'name', e.target.value)}
              maxLength={120}
              className="py-2 text-sm"
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={e => patch(null, 'phone', e.target.value)}
              placeholder="+91 98765 43210"
              maxLength={30}
              className="py-2 text-sm"
            />
          </Field>
          <Field label="Date of birth">
            <Input
              type="date"
              value={form.dob}
              onChange={e => patch(null, 'dob', e.target.value)}
              className="py-2 text-sm"
            />
          </Field>
          <Field label="Email" hint="Their sign-in. Changed from the account, not here.">
            <Input value={person.email} disabled className="py-2 text-sm" />
          </Field>
        </div>
      </section>

      <section>
        <p className="eyebrow mb-2.5">Where they are</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Address" className="sm:col-span-2">
            <Input
              value={form.address.line1}
              onChange={e => patch('address', 'line1', e.target.value)}
              placeholder="Flat, street"
              maxLength={200}
              className="py-2 text-sm"
            />
          </Field>
          <Field label="City">
            <Input
              value={form.address.city}
              onChange={e => patch('address', 'city', e.target.value)}
              maxLength={80}
              className="py-2 text-sm"
            />
          </Field>
          <Field label="State">
            <Input
              value={form.address.state}
              onChange={e => patch('address', 'state', e.target.value)}
              maxLength={80}
              className="py-2 text-sm"
            />
          </Field>
          <Field label="Pincode">
            <Input
              value={form.address.pincode}
              onChange={e => patch('address', 'pincode', e.target.value)}
              inputMode="numeric"
              maxLength={12}
              className="py-2 text-sm"
            />
          </Field>
          <Field label="Country">
            <Input
              value={form.address.country}
              onChange={e => patch('address', 'country', e.target.value)}
              maxLength={80}
              className="py-2 text-sm"
            />
          </Field>
        </div>
      </section>

      <section>
        <p className="eyebrow mb-2.5">What they do here</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Position">
            <Input
              value={form.employment.position}
              onChange={e => patch('employment', 'position', e.target.value)}
              placeholder="Frontend engineer"
              maxLength={80}
              className="py-2 text-sm"
            />
          </Field>
          <Field label="Department">
            <Input
              value={form.employment.department}
              onChange={e => patch('employment', 'department', e.target.value)}
              placeholder="Engineering"
              maxLength={80}
              className="py-2 text-sm"
            />
          </Field>
          <Field label="Employee ID">
            <Input
              value={form.employment.employeeId}
              onChange={e => patch('employment', 'employeeId', e.target.value)}
              placeholder="EMP-014"
              maxLength={24}
              className="py-2 text-sm"
            />
          </Field>
          <Field label="Kind of hire">
            <Select
              value={form.employment.type}
              onChange={e => patch('employment', 'type', e.target.value)}
              className="py-2 text-sm"
            >
              {TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Joined on">
            <Input
              type="date"
              value={form.employment.joinedOn}
              onChange={e => patch('employment', 'joinedOn', e.target.value)}
              className="py-2 text-sm"
            />
          </Field>
          <Field
            label="Experience before this"
            hint="Years brought in from elsewhere."
          >
            <Input
              type="number"
              min="0"
              max="60"
              step="0.5"
              value={form.employment.experienceYears}
              onChange={e => patch('employment', 'experienceYears', e.target.value)}
              className="py-2 text-sm"
            />
          </Field>

          {temporary && (
            <>
              <Field label={form.employment.type === 'intern' ? 'Internship starts' : 'Probation starts'}>
                <Input
                  type="date"
                  value={form.employment.startsOn}
                  onChange={e => patch('employment', 'startsOn', e.target.value)}
                  className="py-2 text-sm"
                />
              </Field>
              <Field
                label={form.employment.type === 'intern' ? 'Internship ends' : 'Probation ends'}
                hint="The date somebody has to be told about."
              >
                <Input
                  type="date"
                  value={form.employment.endsOn}
                  onChange={e => patch('employment', 'endsOn', e.target.value)}
                  className="py-2 text-sm"
                />
              </Field>
            </>
          )}
        </div>
      </section>

      {maySeePay && (
        <section>
          <p className="eyebrow mb-2.5">What they are paid</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount">
              <Input
                type="number"
                min="0"
                step="1000"
                value={form.salary.amount}
                onChange={e => patch('salary', 'amount', e.target.value)}
                placeholder="Leave empty if not set"
                className="py-2 text-sm"
              />
            </Field>
            <Field label="Per">
              <Select
                value={form.salary.period}
                onChange={e => patch('salary', 'period', e.target.value)}
                className="py-2 text-sm"
              >
                <option value="year">Year</option>
                <option value="month">Month</option>
              </Select>
            </Field>
            <Field label="Currency">
              <Input
                value={form.salary.currency}
                onChange={e => patch('salary', 'currency', e.target.value)}
                maxLength={8}
                className="py-2 text-sm"
              />
            </Field>
            <Field label="Last reviewed">
              <Input
                type="date"
                value={form.salary.reviewedOn}
                onChange={e => patch('salary', 'reviewedOn', e.target.value)}
                className="py-2 text-sm"
              />
            </Field>
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={saving}>Save record</Button>
        <p className="text-xs text-content-subtle">
          Every change is written to the activity log with who made it.
        </p>
      </div>
    </form>
  )
}
