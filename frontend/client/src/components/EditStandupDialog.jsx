import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import Button from './ui/Button'
import { Field, Textarea } from './ui/Field'
import { IconClose } from './ui/icons'
import { cn } from '../lib/cn'
import { DURATION, EASE, SPRING } from '../lib/motion'
import { MOOD_OPTIONS } from '../lib/moods'
import { apiErrorMessage } from '../lib/apiError'

const CORE_FIELDS = ['yesterday', 'today', 'blockers', 'mood']

/**
 * Edit one standup.
 *
 * Only the fields that actually changed are sent: the server records an audit
 * entry per field, and submitting the whole form would log four changes for a
 * one-word fix.
 */
export default function EditStandupDialog({
  standup,
  onClose,
  onSaved,
  questionLabels = {}
}) {
  // A team's own answers are as correctable as the core three
  const answerKeys = Object.keys(standup.answers || {})

  // questionLabels carries exactly the questions the team asks today
  const asksYesterday = Object.keys(questionLabels).length === 0 ||
    'yesterday' in questionLabels

  const original = {
    yesterday: standup.yesterday || '',
    today: standup.today || '',
    blockers: standup.hasBlocker ? standup.blockers || '' : '',
    mood: standup.mood || 'good',
    ...Object.fromEntries(answerKeys.map(k => [k, standup.answers[k] || '']))
  }

  const [form, setForm] = useState(original)
  const [saving, setSaving] = useState(false)
  const firstField = useRef(null)

  useEffect(() => {
    firstField.current?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const changed = [...CORE_FIELDS, ...answerKeys].filter(
    f => form[f].trim() !== original[f].trim()
  )
  // Only the plan is structurally required; a template may make the rest optional
  const emptied = form.today.trim() === ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (changed.length === 0 || emptied) return

    setSaving(true)
    try {
      const patch = Object.fromEntries(
        changed
          .filter(f => CORE_FIELDS.includes(f))
          .map(f => [f, f === 'mood' ? form[f] : form[f].trim()])
      )
      // An emptied blockers box means "there is no blocker any more"
      if (patch.blockers === '') patch.blockers = 'None'

      const changedAnswers = changed.filter(f => answerKeys.includes(f))
      if (changedAnswers.length > 0) {
        patch.answers = Object.fromEntries(
          changedAnswers.map(k => [k, form[k].trim()])
        )
      }

      const { data } = await API.put(`/standups/${standup._id}`, patch)
      onSaved(data.standup)
      toast.success('Standup updated')
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not save your changes'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: DURATION.fast }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        onMouseDown={e => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit standup for ${standup.date}`}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: DURATION.base, ease: EASE }}
          className="scroll-slim max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-card border border-line bg-surface shadow-xl sm:rounded-card"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-4">
            <div>
              <h2 className="text-heading font-semibold text-content">Edit standup</h2>
              <p className="mt-0.5 text-xs text-content-subtle">
                {standup.date} · every change is recorded
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-content-subtle transition-colors hover:bg-surface-sunken hover:text-content"
            >
              <IconClose className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
            {/* Only shown when the team asks it, or when this standup already
                has an answer from back when they did */}
            {(asksYesterday || original.yesterday) && (
              <Field label={questionLabels.yesterday || 'Accomplished yesterday'}>
                <Textarea
                  ref={firstField}
                  rows={3}
                  value={form.yesterday}
                  onChange={e => setForm(f => ({ ...f, yesterday: e.target.value }))}
                />
              </Field>
            )}

            <Field
              label={questionLabels.today || "Today's plan"}
              error={form.today.trim() === '' ? 'Cannot be emptied' : ''}
            >
              <Textarea
                rows={3}
                value={form.today}
                onChange={e => setForm(f => ({ ...f, today: e.target.value }))}
              />
            </Field>

            <Field
              label={questionLabels.blockers || 'Blockers'}
              hint="Leave empty if nothing is in the way."
            >
              <Textarea
                rows={2}
                value={form.blockers}
                onChange={e => setForm(f => ({ ...f, blockers: e.target.value }))}
              />
            </Field>

            {answerKeys.map(key => (
              <Field key={key} label={questionLabels[key] || key.replace(/_/g, ' ')}>
                <Textarea
                  rows={2}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                />
              </Field>
            ))}

            <div>
              <p className="mb-2 text-sm font-medium text-content-muted">Mood</p>
              <div className="grid grid-cols-5 gap-2">
                {MOOD_OPTIONS.map(m => {
                  const active = form.mood === m.value
                  return (
                    <motion.button
                      type="button"
                      key={m.value}
                      onClick={() => setForm(f => ({ ...f, mood: m.value }))}
                      whileTap={{ scale: 0.94 }}
                      transition={SPRING}
                      aria-pressed={active}
                      title={m.label}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-xl border-2 px-1.5 py-2 transition-colors',
                        active
                          ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-950'
                          : 'border-line hover:border-content-subtle/40'
                      )}
                    >
                      <span className="text-lg" aria-hidden="true">{m.emoji}</span>
                      <span className="text-[10px] capitalize text-content-muted">
                        {m.value}
                      </span>
                    </motion.button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
              <p className="text-xs text-content-subtle">
                {changed.length === 0
                  ? 'Nothing changed yet'
                  : `${changed.length} ${changed.length === 1 ? 'change' : 'changes'}`}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={saving}
                  disabled={changed.length === 0 || emptied}
                >
                  Save changes
                </Button>
              </div>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
