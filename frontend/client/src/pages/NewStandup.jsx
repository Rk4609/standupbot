import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { Textarea } from '../components/ui/Field'
import { cn } from '../lib/cn'
import { SPRING } from '../lib/motion'
import { MOOD_OPTIONS } from '../lib/moods'



function Question({ step, icon, label, optional, children }) {
  return (
    <Card>
      <label className="mb-3 flex items-start gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          {step}
        </span>
        <span className="text-sm font-medium text-content md:text-base">
          <span aria-hidden="true" className="mr-1.5">
            {icon}
          </span>
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
  const [form, setForm] = useState({
    yesterday: '',
    today: '',
    blockers: '',
    mood: 'good'
  })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await API.post('/standups', form)
      toast.success('Standup submitted! 🎉')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong')
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

  return (
    <PageShell width="sm">
      <PageHeader title="Daily standup 📋" subtitle={dateLabel} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Question step={1} icon="✅" label="What did you accomplish yesterday?">
          <Textarea
            required
            rows={3}
            value={form.yesterday}
            onChange={set('yesterday')}
            placeholder="Describe the tasks you completed…"
          />
        </Question>

        <Question step={2} icon="🎯" label="What are you working on today?">
          <Textarea
            required
            rows={3}
            value={form.today}
            onChange={set('today')}
            placeholder="Share your plan for today…"
          />
        </Question>

        <Question step={3} icon="🚨" label="Any blockers or impediments?" optional>
          <Textarea
            rows={2}
            value={form.blockers}
            onChange={set('blockers')}
            placeholder="Anything slowing you down? Let your team know…"
          />
        </Question>

        <Card>
          <label className="mb-4 flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              4
            </span>
            <span className="text-sm font-medium text-content md:text-base">
              <span aria-hidden="true" className="mr-1.5">
                💭
              </span>
              How are you feeling today?
            </span>
          </label>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:gap-3">
            {MOOD_OPTIONS.map(m => {
              const active = form.mood === m.value
              return (
                <motion.button
                  type="button"
                  key={m.value}
                  onClick={() => setForm({ ...form, mood: m.value })}
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

        <Button type="submit" size="lg" full loading={loading}>
          {loading ? 'Submitting…' : '🚀 Submit standup'}
        </Button>
      </form>
    </PageShell>
  )
}
