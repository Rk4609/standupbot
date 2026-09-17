import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { IconAlert, IconCheck } from '../components/ui/icons'
import OnboardingChecklist from '../components/OnboardingChecklist'
import { getUser } from '../store/authStore'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { shortDay } from '../lib/leave'

/** Progress as a ring: the share done, and the count in the middle. */
function Ring({ done, total }) {
  const r = 34
  const length = 2 * Math.PI * r
  const share = total ? done / total : 0
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" className="stroke-white/15 dark:stroke-line" />
        <circle
          cx="40" cy="40" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
          className="stroke-brand-400 transition-[stroke-dashoffset] duration-500"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - share)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-xl font-light">{done}/{total}</span>
        <span className="text-[10px] uppercase tracking-wide opacity-60">done</span>
      </div>
    </div>
  )
}

/**
 * One person's first weeks. `/onboarding/me` is the signed-in person's own;
 * `/onboarding/:id` is anybody's the reader is allowed to see.
 */
export default function OnboardingDetail() {
  const { id } = useParams()
  const live = useLiveRefresh()
  const [onboarding, setOnboarding] = useState(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    const request = id === 'me' ? API.get('/onboarding/mine') : API.get(`/onboarding/${id}`)
    request
      .then(res => {
        if (!current) return
        setOnboarding(res.data.onboarding)
        setMissing(!res.data.onboarding)
        setError('')
      })
      .catch(err => current && setError(apiErrorMessage(err, 'Could not load this checklist')))
    return () => { current = false }
  }, [id, live])

  if (error && !onboarding) {
    return (
      <PageShell>
        <PageHeader title="Onboarding" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (missing) {
    return (
      <PageShell>
        <PageHeader title="Onboarding" />
        <EmptyState
          icon={<IconCheck className="h-6 w-6" />}
          title="No onboarding checklist"
          description="Checklists are made when a new joiner is approved."
        />
      </PageShell>
    )
  }

  if (!onboarding) {
    return (
      <PageShell>
        <Skeleton className="mb-5 h-40 rounded-card" />
        <Skeleton className="mb-4 h-64 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </PageShell>
    )
  }

  const isJoiner = String(onboarding.user) === String(getUser()?._id)
  const { progress } = onboarding

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center gap-5 rounded-card bg-brand-600 p-5 text-white shadow-card dark:bg-surface-raised dark:text-content md:p-6">
          <Ring done={progress.done} total={progress.total} />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.14em] text-white/60 dark:text-content-subtle">
              {isJoiner ? 'Your first weeks' : 'Onboarding'}
            </p>
            <h1 className="mt-1 truncate text-2xl font-light tracking-tight text-white dark:text-content md:text-3xl">
              {isJoiner ? 'Welcome aboard' : onboarding.userName}
            </h1>
            <p className="mt-1 text-sm text-white/75 dark:text-content-muted">
              {[onboarding.position, `joined ${shortDay(onboarding.startsOn)}`].filter(Boolean).join(' · ')}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {onboarding.status === 'complete'
                ? <Badge tone="positive">Complete</Badge>
                : <Badge tone="brand">{progress.percent}% done</Badge>}
              {progress.overdue > 0 && <Badge tone="danger">{progress.overdue} overdue</Badge>}
            </div>
          </div>
        </div>

        <OnboardingChecklist
          onboarding={onboarding}
          onChange={setOnboarding}
          viewerIsJoiner={isJoiner}
        />
      </div>
    </PageShell>
  )
}
