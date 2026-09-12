import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import { Input, Textarea } from '../components/ui/Field'
import { cn } from '../lib/cn'
import { SPRING } from '../lib/motion'
import { MOOD_OPTIONS } from '../lib/moods'
import { apiErrorMessage } from '../lib/apiError'

/** Matches the server's fallback, so the form is never blank if the fetch fails. */
const DEFAULT_TEMPLATE = {
  name: 'Daily standup',
  askMood: true,
  coreKeys: ['yesterday', 'today', 'blockers'],
  questions: [
    {
      key: 'yesterday',
      label: 'What did you accomplish yesterday?',
      placeholder: 'Describe the tasks you completed…',
      type: 'long',
      required: true
    },
    {
      key: 'today',
      label: 'What are you working on today?',
      placeholder: 'Share your plan for today…',
      type: 'long',
      required: true
    },
    {
      key: 'blockers',
      label: 'Any blockers or impediments?',
      placeholder: 'Anything slowing you down? Let your team know…',
      type: 'long',
      required: false
    }
  ]
}

function Question({ step, label, optional, children }) {
  return (
    <Card>
      <label className="mb-3 flex items-start gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          {step}
        </span>
        <span className="text-sm font-medium text-content md:text-base">
          {label}
          {optional && (
            <span className="ml-1.5 text-xs font-normal text-content-subtle">(optional)</span>
          )}
        </span>
      </label>
      {children}
    </Card>
  )
}

export default function NewStandup() {
  const [template, setTemplate] = useState(null)
  const [values, setValues] = useState({})
  const [mood, setMood] = useState('good')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    API.get('/templates/active')
      .then(res => {
        if (!cancelled) setTemplate(res.data)
      })
      .catch(() => {
        // A team's own wording is a nicety; being unable to file a standup is
        // not, so fall back to the standard questions rather than blocking
        if (!cancelled) setTemplate(DEFAULT_TEMPLATE)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const set = (key) => (e) =>
    setValues(v => ({ ...v, [key]: e.target.value }))

  const missing = useMemo(
    () =>
      (template?.questions || []).filter(
        q => q.required && !String(values[q.key] || '').trim()
      ),
    [template, values]
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (missing.length > 0) return

    setLoading(true)
    try {
      const core = template.coreKeys
      // The three core answers have their own fields on a standup; the rest
      // are the team's own questions and go in `answers`
      const body = { mood }
      for (const q of template.questions) {
        const value = String(values[q.key] || '').trim()
        if (core.includes(q.key)) body[q.key] = value
        else (body.answers ??= {})[q.key] = value
      }

      await API.post('/standups', body)
      toast.success('Standup submitted')
      navigate('/dashboard')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Something went wrong'))
    } finally {
      setLoading(false)
    }
  }

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  if (!template) {
    return (
      <PageShell width="sm">
        <Skeleton className="mb-2 h-9 w-48" />
        <Skeleton className="mb-7 h-4 w-64" />
        <div className="space-y-4">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-36 rounded-card" />
          ))}
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell width="sm">
      <PageHeader title={template.name || 'Daily standup'} subtitle={dateLabel} />

      <form onSubmit={handleSubmit} className="space-y-4">
        {template.questions.map((q, i) => (
          <Question key={q.key} step={i + 1} label={q.label} optional={!q.required}>
            {q.type === 'short' ? (
              <Input
                value={values[q.key] || ''}
                onChange={set(q.key)}
                placeholder={q.placeholder}
                maxLength={2000}
              />
            ) : (
              <Textarea
                rows={3}
                value={values[q.key] || ''}
                onChange={set(q.key)}
                placeholder={q.placeholder}
                maxLength={2000}
              />
            )}
          </Question>
        ))}

        {template.askMood && (
          <Card>
            <label className="mb-4 flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                {template.questions.length + 1}
              </span>
              <span className="text-sm font-medium text-content md:text-base">
                How are you feeling today?
              </span>
            </label>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:gap-3">
              {MOOD_OPTIONS.map(m => {
                const active = mood === m.value
                return (
                  <motion.button
                    type="button"
                    key={m.value}
                    onClick={() => setMood(m.value)}
                    whileTap={{ scale: 0.94 }}
                    transition={SPRING}
                    aria-pressed={active}
                    className={cn(
                      'relative flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 transition-colors md:px-3 md:py-3',
                      active
                        ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-950'
                        : 'border-line bg-surface hover:border-brand-200 dark:hover:border-brand-800'
                    )}
                  >
                    <motion.span
                      aria-hidden="true"
                      className="text-xl md:text-2xl"
                      animate={active ? { scale: 1.15, y: -1 } : { scale: 1, y: 0 }}
                      transition={SPRING}
                    >
                      {m.emoji}
                    </motion.span>
                    <span
                      className={cn(
                        'text-center text-xs leading-tight transition-colors',
                        active
                          ? 'font-medium text-brand-700 dark:text-brand-300'
                          : 'text-content-muted'
                      )}
                    >
                      {m.label}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </Card>
        )}

        <Button type="submit" size="lg" full loading={loading} disabled={missing.length > 0}>
          {loading ? 'Submitting…' : 'Submit standup'}
        </Button>

        {missing.length > 0 && (
          <p className="text-center text-xs text-content-subtle">
            Still to answer: {missing.map(q => q.label).join(', ')}
          </p>
        )}
      </form>
    </PageShell>
  )
}
