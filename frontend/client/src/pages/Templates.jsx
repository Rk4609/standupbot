import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { Checkbox, Field, Input, Select } from '../components/ui/Field'
import { IconAlert, IconClose, IconPlus, IconTrash } from '../components/ui/icons'
import { cn } from '../lib/cn'
import { collapseVariants, DURATION, EASE } from '../lib/motion'
import { apiErrorMessage } from '../lib/apiError'

/** A label turned into a key: lowercase, underscores, nothing exotic. */
const toKey = (label) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+/, '')
    .replace(/_+$/, '')
    .slice(0, 40)

export default function Templates() {
  const [template, setTemplate] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [newLabel, setNewLabel] = useState('')

  useEffect(() => {
    let cancelled = false

    API.get('/templates')
      .then(res => {
        if (!cancelled) setTemplate(res.data)
      })
      .catch(err => {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load the template'))
      })

    return () => {
      cancelled = true
    }
  }, [])

  const core = template?.coreKeys || []
  const isCore = (key) => core.includes(key)

  const patch = (index, changes) =>
    setTemplate(t => ({
      ...t,
      questions: t.questions.map((q, i) => (i === index ? { ...q, ...changes } : q))
    }))

  const move = (index, by) =>
    setTemplate(t => {
      const next = [...t.questions]
      const target = index + by
      if (target < 0 || target >= next.length) return t
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...t, questions: next }
    })

  const remove = (index) =>
    setTemplate(t => ({ ...t, questions: t.questions.filter((_, i) => i !== index) }))

  const add = () => {
    const label = newLabel.trim()
    if (!label) return

    const key = toKey(label)
    if (!key) {
      toast.error('Give the question a name with some letters in it')
      return
    }
    if (template.questions.some(q => q.key === key)) {
      toast.error('There is already a question with that name')
      return
    }

    setTemplate(t => ({
      ...t,
      questions: [...t.questions, { key, label, placeholder: '', type: 'long', required: false }]
    }))
    setNewLabel('')
  }

  const save = async () => {
    setSaving(true)
    try {
      const { data } = await API.put('/templates', {
        name: template.name,
        askMood: template.askMood,
        trackTime: Boolean(template.trackTime),
        questions: template.questions.map(q => ({
          key: q.key,
          label: q.label.trim(),
          placeholder: (q.placeholder || '').trim(),
          type: q.type,
          required: Boolean(q.required)
        }))
      })
      setTemplate(data)
      toast.success('Template saved')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not save the template'))
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    setSaving(true)
    try {
      const { data } = await API.delete('/templates')
      setTemplate(data)
      toast.success('Back to the default questions')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not reset the template'))
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <PageShell width="md">
        <PageHeader title="Standup template" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (!template) {
    return (
      <PageShell width="md">
        <Skeleton className="mb-2 h-9 w-56" />
        <Skeleton className="mb-7 h-4 w-80" />
        <Skeleton className="h-[420px] rounded-card" />
      </PageShell>
    )
  }

  const blank = template.questions.some(q => !q.label.trim())

  return (
    <PageShell width="md">
      <PageHeader
        title="Standup template"
        subtitle="The questions your team is asked each morning."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {template.custom && (
              <Button variant="ghost" onClick={reset} disabled={saving}>
                Reset to default
              </Button>
            )}
            <Button onClick={save} loading={saving} disabled={blank}>
              Save template
            </Button>
          </div>
        }
      />

      {!template.custom && (
        <div className="mb-4 rounded-xl border border-line bg-surface-sunken px-4 py-3 text-sm text-content-muted">
          Your team is on the standard questions. Anything you change here
          applies to your team only.
        </div>
      )}

      <Card className="mb-4">
        <Field label="Template name" hint="Shown as the heading on the standup form.">
          <Input
            value={template.name}
            onChange={e => setTemplate(t => ({ ...t, name: e.target.value }))}
            maxLength={80}
          />
        </Field>
      </Card>

      <Card padded={false} className="mb-4">
        <div className="flex items-center justify-between gap-3 px-5 pt-5">
          <CardTitle className="mb-0">Questions</CardTitle>
          <span className="text-xs text-content-subtle">
            {template.questions.length} of 15
          </span>
        </div>

        <ul className="mt-4 divide-y divide-line border-t border-line">
          <AnimatePresence initial={false}>
            {template.questions.map((q, i) => (
              <motion.li
                key={q.key}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: DURATION.fast, ease: EASE }}
                className="px-5 py-4"
              >
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="tabular text-xs text-content-subtle">{i + 1}</span>
                    {isCore(q.key) ? (
                      <Badge tone="neutral">Built in</Badge>
                    ) : (
                      <Badge tone="brand">Your question</Badge>
                    )}
                    <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] text-content-subtle">
                      {q.key}
                    </code>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label={`Move "${q.label}" up`}
                      className="rounded-md px-1.5 py-1 text-xs text-content-subtle transition-colors hover:bg-surface-sunken hover:text-content disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === template.questions.length - 1}
                      aria-label={`Move "${q.label}" down`}
                      className="rounded-md px-1.5 py-1 text-xs text-content-subtle transition-colors hover:bg-surface-sunken hover:text-content disabled:opacity-30"
                    >
                      ↓
                    </button>
                    {!isCore(q.key) && (
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        aria-label={`Remove "${q.label}"`}
                        className="rounded-md p-1 text-content-subtle transition-colors hover:bg-red-500/10 hover:text-red-500"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Input
                    value={q.label}
                    onChange={e => patch(i, { label: e.target.value })}
                    placeholder="What do you want to ask?"
                    aria-label={`Question ${i + 1} wording`}
                    maxLength={160}
                    invalid={!q.label.trim()}
                  />
                  <Input
                    value={q.placeholder || ''}
                    onChange={e => patch(i, { placeholder: e.target.value })}
                    placeholder="Hint shown inside the empty box (optional)"
                    aria-label={`Question ${i + 1} hint`}
                    maxLength={160}
                    className="text-xs"
                  />

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="w-36">
                      <Select
                        value={q.type}
                        onChange={e => patch(i, { type: e.target.value })}
                        aria-label={`Question ${i + 1} answer size`}
                        className="py-2 text-xs"
                      >
                        <option value="long">Long answer</option>
                        <option value="short">Short answer</option>
                      </Select>
                    </div>

                    <Checkbox
                      label="Required"
                      checked={Boolean(q.required)}
                      // Everything downstream assumes a standup says what the
                      // day's plan is, so this one cannot be turned off
                      disabled={q.key === 'today'}
                      onChange={e => patch(i, { required: e.target.checked })}
                    />
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <div className="flex flex-col gap-2 border-t border-line px-5 py-4 sm:flex-row">
          <Input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            placeholder="Add a question of your own…"
            aria-label="New question"
            maxLength={160}
          />
          <Button
            type="button"
            variant="outline"
            onClick={add}
            disabled={!newLabel.trim() || template.questions.length >= 15}
            className="shrink-0"
          >
            <IconPlus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </Card>

      <Card className="space-y-5">
        <div>
          <Checkbox
            label="Ask how people are feeling"
            checked={template.askMood}
            onChange={e => setTemplate(t => ({ ...t, askMood: e.target.checked }))}
          />
          <p className="ml-7 mt-1 text-xs text-content-subtle">
            Mood is what the analytics trend and the at-risk list are built on. Turning
            it off leaves those blank.
          </p>
        </div>

        <div>
          <Checkbox
            label="Ask where the hours went"
            checked={Boolean(template.trackTime)}
            onChange={e => setTemplate(t => ({ ...t, trackTime: e.target.checked }))}
          />
          <p className="ml-7 mt-1 text-xs text-content-subtle">
            Adds a project and hours section to the standup, and those hours become the
            week's timesheet for you to approve. Turn this on and the standup stops being
            optional — the week cannot be signed off without it.
          </p>
        </div>
      </Card>

      <AnimatePresence initial={false}>
        {blank && (
          <motion.div
            variants={collapseVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="overflow-hidden"
          >
            <p className={cn('mt-4 flex items-center gap-2 text-sm text-red-500')}>
              <IconClose className="h-4 w-4 shrink-0" />
              Every question needs some wording before this can be saved.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  )
}
