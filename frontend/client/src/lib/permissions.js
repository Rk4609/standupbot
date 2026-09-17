/**
 * What this person may open, read from the session the server handed back.
 *
 * The server checks every one of these again on the request itself — this is
 * only here so the app does not show somebody a page that is going to refuse
 * them. A session saved before roles existed has no `modules` at all, so it
 * falls back to what that role could always reach: an older tab must not
 * suddenly lose its sidebar.
 */
const FALLBACK = {
  employee: ['dashboard', 'standup', 'history', 'timesheet', 'leave', 'attendance', 'payslips', 'support'],
  manager: [
    'dashboard', 'standup', 'history', 'timesheet', 'leave', 'attendance', 'payslips', 'support',
    'team', 'employees', 'blockers', 'timesheets', 'analytics', 'retro', 'leaves', 'team-attendance', 'brief',
    'projects', 'templates', 'integrations', 'activity', 'onboarding'
  ],
  admin: [
    'dashboard', 'standup', 'history', 'timesheet', 'leave', 'attendance', 'payslips', 'support',
    'team', 'employees', 'blockers', 'timesheets', 'analytics', 'retro', 'leaves', 'team-attendance', 'brief',
    'projects', 'templates', 'integrations', 'activity', 'onboarding', 'people', 'roles'
  ]
}

/** Nobody is ever locked out of these. */
const ALWAYS = ['dashboard', 'support']

export const modulesOf = (user) => {
  if (!user) return []
  if (Array.isArray(user.modules) && user.modules.length > 0) return user.modules
  return FALLBACK[user.role] || FALLBACK.employee
}

/** Can this person open that part of the app? */
export const can = (user, moduleKey) => {
  if (!moduleKey) return true
  if (ALWAYS.includes(moduleKey)) return Boolean(user)
  return modulesOf(user).includes(moduleKey)
}
