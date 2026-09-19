/** Words and colours for a working day, shared by my attendance and the team's. */

export const STATE_LABEL = {
  working: 'In now',
  present: 'Present',
  'half-day': 'Half day',
  'no-checkout': 'No check-out',
  leave: 'On leave',
  absent: 'Absent',
  'not-in': 'Not in yet',
  weekend: 'Weekend',
  holiday: 'Holiday',
  upcoming: '',
  untracked: ''
}

export const STATE_TONE = {
  working: 'brand',
  present: 'positive',
  'half-day': 'info',
  'no-checkout': 'warning',
  leave: 'neutral',
  absent: 'danger',
  'not-in': 'neutral',
  weekend: 'neutral',
  holiday: 'info'
}

/** The fill of a day on the month grid. */
export const STATE_CELL = {
  working: 'bg-brand-400/70 text-brand-700 dark:bg-brand-400/40 dark:text-brand-200',
  present: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'half-day': 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  'no-checkout': 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  leave: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  absent: 'bg-red-500/15 text-red-600 dark:text-red-400',
  'not-in': 'ring-1 ring-inset ring-line text-content',
  weekend: 'text-content-subtle',
  holiday: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  upcoming: 'text-content-subtle',
  untracked: 'text-content-subtle'
}

/** "8h 30m", "45m". */
export const duration = (minutes) => {
  if (minutes === null || minutes === undefined) return '—'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

/** Minutes between an instant and now (or another instant). */
export const minutesSince = (from, to = Date.now()) =>
  Math.max(0, Math.floor((new Date(to) - new Date(from)) / 60_000))

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')
