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
import WorkEntries from '../components/WorkEntries'
import { apiErrorMessage } from '../lib/apiError'

/** Matches the server's fallback, so the form is never blank if the fetch fails. */
const DEFAULT_TEMPLATE = {
  name: 'Daily standup',
  askMood: true,
  trackTime: false,
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
  const [projects, setProjects] = useState([])
  const [work, setWork] = useState([])
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

  // Only fetched once the template says this team books its time, so a team
  // that does not never pays for the request
  useEffect(() => {
    if (!template?.trackTime) return
    let cancelled = false

    API.get('/projects')
      .then(res => {
        if (cancelled) return
        setProjects(res.data)
        // One empty row to start, so the section is obviously fillable
        setWork(w => (w.length > 0 ? w : [{ project: res.data[0]?._id || '', hours: '', note: '' }]))
      })
      .catch(() => {
        if (!cancelled) setProjects([])
      })

    return () => {
      cancelled = true
    }
  }, [template?.trackTime])

  const set = (key) => (e) =>
    setValues(v => ({ ...v, [key]: e.target.value }))

  const missing = useMemo(
    () =>
      (template?.questions || []).filter(
        q => q.required && !String(values[q.key] || '').trim()
      ),
    [template, values]
  )

  // Rows with a project and some hours. A half-filled row is not an error,
  // it is someone still typing, so it is simply not sent.
  const filledWork = work.filter(w => w.project && Number(w.hours) > 0)
  const workTotal = filledWork.reduce((sum, w) => sum + Number(w.hours), 0)
  const needsHours = Boolean(template?.trackTime) && filledWork.length === 0
  const tooManyHours = workTotal > 24

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (missing.length > 0 || needsHours || tooManyHours) return

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

      if (filledWork.length > 0) {
        body.work = filledWork.map(w => ({
          project: w.project,
          hours: Number(w.hours),
          note: w.note || ''
        }))
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

        {template.trackTime && (
          <Card>
            <label className="mb-3 flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                {template.questions.length + 1}
              </span>
              <span className="text-sm font-medium text-content md:text-base">
                Where did your hours go?
              </span>
            </label>
            <WorkEntries projects={projects} rows={work} onChange={setWork} />
          </Card>
        )}

        {template.askMood && (
          <Card>
            <label className="mb-4 flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                {template.questions.length + (template.trackTime ? 2 : 1)}
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

        <Button
          type="submit"
          size="lg"
          full
          loading={loading}
          disabled={missing.length > 0 || needsHours || tooManyHours}
        >
          {loading ? 'Submitting…' : 'Submit standup'}
        </Button>

        {missing.length > 0 && (
          <p className="text-center text-xs text-content-subtle">
            Still to answer: {missing.map(q => q.label).join(', ')}
          </p>
        )}

        {missing.length === 0 && needsHours && (
          <p className="text-center text-xs text-content-subtle">
            Add where your hours went before submitting.
          </p>
        )}
      </form>
    </PageShell>
  )
}
