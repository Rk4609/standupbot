import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { DURATION, EASE } from '../lib/motion'
import { IconAlert, IconBell, IconCalendar, IconCheck, IconClose, IconInbox, IconSparkles, IconUsers } from './ui/icons'

/** Icon and tint per kind, so a blocker does not look like a standup. */
const LOOK = {
  support_raised: { icon: IconInbox, plate: 'bg-brand-600/12 text-brand-700 dark:text-brand-300' },
  support_replied: { icon: IconInbox, plate: 'bg-sky-500/12 text-sky-600 dark:text-sky-400' },
  support_closed: { icon: IconCheck, plate: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' },
  blocker_added: { icon: IconAlert, plate: 'bg-red-500/12 text-red-600 dark:text-red-400' },
  standup_submitted: { icon: IconCheck, plate: 'bg-brand-600/12 text-brand-700 dark:text-brand-300' },
  hiring_submitted: { icon: IconUsers, plate: 'bg-brand-600/12 text-brand-700 dark:text-brand-300' },
  hiring_decided: { icon: IconCheck, plate: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' },
  leave_requested: { icon: IconCalendar, plate: 'bg-sky-500/12 text-sky-600 dark:text-sky-400' },
  leave_decided: { icon: IconCalendar, plate: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' },
  payslip_ready: { icon: IconCheck, plate: 'bg-brand-600/12 text-brand-700 dark:text-brand-300' },
  onboarding_started: { icon: IconUsers, plate: 'bg-sky-500/12 text-sky-600 dark:text-sky-400' },
  onboarding_complete: { icon: IconCheck, plate: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' },
  brief_ready: { icon: IconSparkles, plate: 'bg-brand-600/12 text-brand-700 dark:text-brand-300' },
  report_ready: { icon: IconSparkles, plate: 'bg-sky-500/12 text-sky-600 dark:text-sky-400' },
  reminder: { icon: IconBell, plate: 'bg-amber-500/12 text-amber-600 dark:text-amber-400' }
}

const TITLE = {
  support_raised: 'New issue reported',
  support_replied: 'Your report was answered',
  support_closed: 'Report closed',
  blocker_added: 'Blocker raised',
  standup_submitted: 'Standup submitted',
  hiring_submitted: 'Somebody put forward',
  hiring_decided: 'Hiring decision',
  leave_requested: 'Leave requested',
  leave_decided: 'Leave update',
  payslip_ready: 'Payslip ready',
  onboarding_started: 'Welcome aboard',
  onboarding_complete: 'Onboarding complete',
  brief_ready: 'Morning brief',
  report_ready: 'Weekly report',
  reminder: 'Reminder'
}

/**
 * The thing that just happened, in the corner, while you are somewhere else.
 *
 * The bell already collects notifications, but a badge only counts: somebody
 * answering your report while you are on the dashboard should be visible
 * without you thinking to check. Clicking takes you to it and marks it read,
 * which is the same thing the dropdown row does.
 */
export default function NotificationToast({ t, notification, onOpen }) {
  const look = LOOK[notification.type] || LOOK.reminder
  const Icon = look.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: t.visible ? 1 : 0, y: t.visible ? 0 : -10, scale: t.visible ? 1 : 0.97 }}
      transition={{ duration: DURATION.fast, ease: EASE }}
      role="status"
      className="pointer-events-auto flex w-[min(22rem,calc(100vw-2rem))] items-start gap-3 rounded-card border border-line bg-surface-raised p-3 shadow-pop"
    >
      <span
        aria-hidden="true"
        className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', look.plate)}
      >
        <Icon className="h-4 w-4" />
      </span>

      <button
        type="button"
        onClick={() => {
          toast.dismiss(t.id)
          onOpen(notification)
        }}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block text-sm font-medium text-content">
          {TITLE[notification.type] || 'Notification'}
        </span>
        <span className="mt-0.5 block text-xs text-content-muted line-clamp-2">
          {notification.message}
        </span>
        <span className="mt-1.5 block text-xs font-medium text-brand-600 dark:text-brand-400">
          Open →
        </span>
      </button>

      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-content-subtle transition-colors hover:bg-surface-sunken hover:text-content"
      >
        <IconClose className="h-4 w-4" />
      </button>
    </motion.div>
  )
}
