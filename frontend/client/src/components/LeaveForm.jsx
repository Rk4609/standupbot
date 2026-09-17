import { useState } from 'react'
import toast from 'react-hot-toast'
import API from '../api/axios'
import Button from './ui/Button'
import Modal from './ui/Modal'
import { Checkbox, Field, Input, Select, Textarea } from './ui/Field'
import { apiErrorMessage } from '../lib/apiError'
import { TYPE_LABEL, addDays, dayWord, workingDays } from '../lib/leave'

/** A sick day is often written up afterwards; the server allows a month back. */
const BACKDATE_DAYS = 30

/**
 * Asking for time off.
 *
 * The cost in working days is worked out as the dates are picked, and set
 * against what is left of that kind — somebody should find out they are two
 * days short here, not from a rejection a day later.
 */
export default function LeaveForm({ balance, today, onClose, onSaved }) {
  const [form, setForm] = useState({ type: 'casual', from: '', to: '', halfDay: false, reason: '' })
  const [saving, setSaving] = useState(false)

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const days = workingDays(form.from, form.halfDay ? form.from : form.to, form.halfDay)
  const left = balance.find(b => b.type === form.type)?.remaining ?? null
  const short = left !== null && days > left

  const ready = form.from && (form.halfDay || form.to) && days > 0 && !short &&
    form.reason.trim().length >= 3

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await API.post('/leave', {
        type: form.type,
        from: form.from,
        ...(form.halfDay ? { halfDay: true } : { to: form.to }),
        reason: form.reason.trim()
      })
      toast.success('Leave requested')
      onSaved?.()
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not send that'))
    } finally {
      setSaving(false)
    }
  }

  const hint = () => {
    if (!form.from) return 'Weekends are not counted.'
    if (!form.halfDay && form.to && form.to < form.from) return 'The last day is before the first.'
    if (days === 0 && (form.halfDay || form.to)) return 'Those days are all a weekend.'
    if (short) return `Only ${dayWord(left)} of ${TYPE_LABEL[form.type].toLowerCase()} leave left.`
    if (days > 0) return `Costs ${dayWord(days)}${left !== null ? ` · ${dayWord(left - days)} left after` : ''}.`
    return 'Weekends are not counted.'
  }

  return (
    <Modal title="Ask for leave" subtitle="Your manager is told straight away." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Kind of leave">
          <Select value={form.type} onChange={e => set('type', e.target.value)}>
            {balance.map(b => (
              <option key={b.type} value={b.type}>
                {TYPE_LABEL[b.type]}{b.remaining === null ? '' : ` · ${dayWord(b.remaining)} left`}
              </option>
            ))}
          </Select>
        </Field>

        <Checkbox
          label="Half a day"
          checked={form.halfDay}
          onChange={e => set('halfDay', e.target.checked)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field label={form.halfDay ? 'Day' : 'First day'}>
            <Input
              type="date"
              value={form.from}
              min={today ? addDays(today, -BACKDATE_DAYS) : undefined}
              onChange={e => {
                const from = e.target.value
                setForm(f => ({ ...f, from, to: !f.to || f.to < from ? from : f.to }))
              }}
            />
          </Field>
          {!form.halfDay && (
            <Field label="Last day">
              <Input
                type="date"
                value={form.to}
                min={form.from || undefined}
                onChange={e => set('to', e.target.value)}
              />
            </Field>
          )}
        </div>

        <p
          className={
            short || (days === 0 && form.from && (form.halfDay || form.to))
              ? 'text-xs font-medium text-red-600 dark:text-red-400'
              : 'text-xs text-content-subtle'
          }
          aria-live="polite"
        >
          {hint()}
        </p>

        <Field label="Reason">
          <Textarea
            rows={3}
            maxLength={500}
            value={form.reason}
            onChange={e => set('reason', e.target.value)}
            placeholder="A few words for your manager"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Not now</Button>
          <Button type="submit" loading={saving} disabled={!ready}>Send request</Button>
        </div>
      </form>
    </Modal>
  )
}
