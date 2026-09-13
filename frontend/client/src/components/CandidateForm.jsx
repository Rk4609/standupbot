import { useState } from 'react'
import toast from 'react-hot-toast'
import API from '../api/axios'
import Button from './ui/Button'
import Modal from './ui/Modal'
import { Field, Input, Select, Textarea } from './ui/Field'
import { apiErrorMessage } from '../lib/apiError'

const blank = {
  name: '',
  email: '',
  phone: '',
  dob: '',
  address: { line1: '', city: '', state: '', pincode: '', country: 'India' },
  position: '',
  department: '',
  team: '',
  type: 'full-time',
  joiningOn: '',
  startsOn: '',
  endsOn: '',
  experienceYears: '',
  expectedSalary: { amount: '', currency: 'INR', period: 'year' },
  cv: { url: '', name: '' },
  notes: ''
}

/**
 * Everything an admin needs to say yes, asked once.
 *
 * The fields are the ones a record holds, so approving copies rather than
 * retypes — the alternative is a two-line "please hire Kabir" followed by
 * somebody filling in a joining date from memory a week later.
 */
export default function CandidateForm({ teams, maySeePay, onClose, onSubmitted }) {
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))
  const setIn = (section, field, value) =>
    setForm(f => ({ ...f, [section]: { ...f[section], [field]: value } }))

  const temporary = ['intern', 'probation'].includes(form.type)
  const ready = form.name.trim().length > 1 &&
    /\S+@\S+\.\S+/.test(form.email) &&
    form.position.trim().length > 1

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await API.post('/hiring', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        dob: form.dob || null,
        address: form.address,
        position: form.position.trim(),
        department: form.department.trim(),
        team: form.team || null,
        type: form.type,
        joiningOn: form.joiningOn || null,
        startsOn: temporary ? form.startsOn || null : null,
        endsOn: temporary ? form.endsOn || null : null,
        experienceYears: Number(form.experienceYears) || 0,
        ...(maySeePay && form.expectedSalary.amount
          ? {
              expectedSalary: {
                ...form.expectedSalary,
                amount: Number(form.expectedSalary.amount)
              }
            }
          : {}),
        // Both optional: a CV is often a link in a message, and a hire should
        // not wait on a file
        cv: form.cv.url ? form.cv : undefined,
        notes: form.notes.trim()
      })

      toast.success(`${data.name} sent for approval`)
      onSubmitted?.(data)
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not send that'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="New joining"
      subtitle="An admin approves this, and the account is made from what you fill in."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        <section>
          <p className="eyebrow mb-2.5">Who they are</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name">
              <Input
                required
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Kabir Sen"
                maxLength={120}
                className="py-2 text-sm"
              />
            </Field>
            <Field label="Email" hint="This becomes their sign-in.">
              <Input
                required
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="kabir@company.com"
                maxLength={160}
                className="py-2 text-sm"
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+91 98765 43210"
                maxLength={30}
                className="py-2 text-sm"
              />
            </Field>
            <Field label="Date of birth">
              <Input
                type="date"
                value={form.dob}
                onChange={e => set('dob', e.target.value)}
                className="py-2 text-sm"
              />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Input
                value={form.address.line1}
                onChange={e => setIn('address', 'line1', e.target.value)}
                placeholder="Flat, street"
                maxLength={200}
                className="py-2 text-sm"
              />
            </Field>
            <Field label="City">
              <Input
                value={form.address.city}
                onChange={e => setIn('address', 'city', e.target.value)}
                maxLength={80}
                className="py-2 text-sm"
              />
            </Field>
            <Field label="Pincode">
              <Input
                value={form.address.pincode}
                onChange={e => setIn('address', 'pincode', e.target.value)}
                inputMode="numeric"
                maxLength={12}
                className="py-2 text-sm"
              />
            </Field>
          </div>
        </section>

        <section>
          <p className="eyebrow mb-2.5">What they would do</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Position">
              <Input
                required
                value={form.position}
                onChange={e => set('position', e.target.value)}
                placeholder="Frontend intern"
                maxLength={80}
                className="py-2 text-sm"
              />
            </Field>
            <Field label="Department">
              <Input
                value={form.department}
                onChange={e => set('department', e.target.value)}
                placeholder="Engineering"
                maxLength={80}
                className="py-2 text-sm"
              />
            </Field>

            {teams.length > 0 && (
              <Field label="Team">
                <Select
                  value={form.team}
                  onChange={e => set('team', e.target.value)}
                  className="py-2 text-sm"
                >
                  <option value="">No team yet</option>
                  {teams.map(t => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </Select>
              </Field>
            )}

            <Field label="Kind of hire">
              <Select
                value={form.type}
                onChange={e => set('type', e.target.value)}
                className="py-2 text-sm"
              >
                <option value="intern">Intern</option>
                <option value="probation">On probation</option>
                <option value="full-time">Full time</option>
                <option value="contract">Contract</option>
              </Select>
            </Field>

            <Field label="Joining on">
              <Input
                type="date"
                value={form.joiningOn}
                onChange={e => set('joiningOn', e.target.value)}
                className="py-2 text-sm"
              />
            </Field>
            <Field label="Experience so far" hint="Years elsewhere.">
              <Input
                type="number"
                min="0"
                max="60"
                step="0.5"
                value={form.experienceYears}
                onChange={e => set('experienceYears', e.target.value)}
                placeholder="0"
                className="py-2 text-sm"
              />
            </Field>

            {temporary && (
              <>
                <Field label={form.type === 'intern' ? 'Internship starts' : 'Probation starts'}>
                  <Input
                    type="date"
                    value={form.startsOn}
                    onChange={e => set('startsOn', e.target.value)}
                    className="py-2 text-sm"
                  />
                </Field>
                <Field
                  label={form.type === 'intern' ? 'Internship ends' : 'Probation ends'}
                  hint="The date somebody has to be told about."
                >
                  <Input
                    type="date"
                    value={form.endsOn}
                    onChange={e => set('endsOn', e.target.value)}
                    className="py-2 text-sm"
                  />
                </Field>
              </>
            )}

            {maySeePay && (
              <>
                <Field label="Agreed pay" hint="Optional. Copied onto their record.">
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={form.expectedSalary.amount}
                    onChange={e => setIn('expectedSalary', 'amount', e.target.value)}
                    placeholder="Leave empty to decide later"
                    className="py-2 text-sm"
                  />
                </Field>
                <Field label="Per">
                  <Select
                    value={form.expectedSalary.period}
                    onChange={e => setIn('expectedSalary', 'period', e.target.value)}
                    className="py-2 text-sm"
                  >
                    <option value="year">Year</option>
                    <option value="month">Month</option>
                  </Select>
                </Field>
              </>
            )}
          </div>
        </section>

        <section>
          <p className="eyebrow mb-2.5">Anything else</p>
          <div className="space-y-3">
            <Field label="CV" hint="A link to it. Optional — say so in the notes if there is none.">
              <Input
                type="url"
                value={form.cv.url}
                onChange={e => setIn('cv', 'url', e.target.value)}
                placeholder="https://drive.google.com/…"
                maxLength={500}
                className="py-2 text-sm"
              />
            </Field>
            <Field label="Notes for the admin">
              <Textarea
                rows={3}
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Interviewed on Tuesday. Strong on React, starts after his exams."
                maxLength={2000}
                className="text-sm"
              />
            </Field>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button type="submit" loading={saving} disabled={!ready}>
            Send for approval
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  )
}
