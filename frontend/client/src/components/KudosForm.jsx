import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import API from '../api/axios'
import Button from './ui/Button'
import Modal from './ui/Modal'
import { Field, Select, Textarea } from './ui/Field'
import { cn } from '../lib/cn'
import { apiErrorMessage } from '../lib/apiError'
import { VALUES } from '../lib/kudos'

const LIMIT = 280

/** Thank somebody: who, what for, and a sentence about it. */
export default function KudosForm({ onClose, onSent, to: preset = '' }) {
  const [people, setPeople] = useState(null)
  const [form, setForm] = useState({ to: preset, value: 'teamwork', message: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    API.get('/kudos/people')
      .then(res => setPeople(res.data.people))
      .catch(() => setPeople([]))
  }, [])

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))
  const ready = form.to && form.message.trim().length >= 3

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await API.post('/kudos', { ...form, message: form.message.trim() })
      toast.success(`Kudos sent to ${data.kudos.to.name}`)
      onSent?.(data.kudos)
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not send that'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Give kudos" subtitle="Say thank you where the team can see it." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Who">
          <Select value={form.to} onChange={e => set('to', e.target.value)} disabled={!people}>
            <option value="">{people ? 'Choose a teammate' : 'Loading your team…'}</option>
            {(people || []).map(p => (
              <option key={p._id} value={p._id}>{p.name}{p.position ? ` · ${p.position}` : ''}</option>
            ))}
          </Select>
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-content">For</legend>
          <div className="flex flex-wrap gap-2">
            {VALUES.map(v => (
              <button
                key={v.key}
                type="button"
                aria-pressed={form.value === v.key}
                onClick={() => set('value', v.key)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm transition-colors',
                  form.value === v.key
                    ? 'border-transparent bg-brand-600 text-white dark:bg-brand-400 dark:text-brand-700'
                    : 'border-line text-content-muted hover:text-content'
                )}
              >
                <span aria-hidden="true">{v.emoji}</span> {v.label}
              </button>
            ))}
          </div>
        </fieldset>

        <Field label="Message" hint={`${form.message.length}/${LIMIT}`}>
          <Textarea
            rows={3}
            maxLength={LIMIT}
            value={form.message}
            onChange={e => set('message', e.target.value)}
            placeholder="Thanks for staying late to get the release out"
          />
        </Field>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Not now</Button>
          <Button type="submit" loading={saving} disabled={!ready}>Send kudos</Button>
        </div>
      </form>
    </Modal>
  )
}
