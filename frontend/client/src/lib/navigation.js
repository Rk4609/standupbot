import {
  IconAlert, IconCalendar, IconChart, IconCheck, IconClock, IconFlame, IconHome, IconInbox,
  IconPlus, IconPrinter, IconSparkles, IconTimer, IconTrendUp, IconUsers, IconBriefcase, IconTarget } from '../components/ui/icons'
import { can } from './permissions'
import { workspaceSectionsFor } from './workspaceSections'

/**
 * What people open on a given day, grouped the way they think about it.
 *
 * Everything a team configures once lives behind Workspace. The groups used
 * to be sidebar sections; they are now the top bar — the personal ones as
 * pills, the team ones behind a single "Team" pill, and Workspace on its own
 * at the end, where settings usually sit.
 */
export const navGroups = (user) => {
  // Each row names the module it belongs to, so a role that had that module
  // taken away loses the row rather than finding a page that refuses it
  const groups = [
    {
      id: 'mine',
      label: null,
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: IconHome, module: 'dashboard' },
        { to: '/standup/new', label: 'New standup', icon: IconPlus, module: 'standup' },
        { to: '/history', label: 'History', icon: IconClock, module: 'history' },
        { to: '/kudos', label: 'Kudos', icon: IconFlame, module: 'kudos' },
        { to: '/support', label: 'Support', icon: IconInbox, module: 'support' }
      ]
    },
    {
      // A person's own HR: hours, days off and pay. One menu rather than
      // four more pills: the bar ran out of room at laptop width.
      id: 'time',
      label: 'My HR',
      items: [
        { to: '/attendance', label: 'Attendance', icon: IconCheck, module: 'attendance' },
        { to: '/timesheet', label: 'Timesheet', icon: IconTimer, module: 'timesheet' },
        { to: '/leave', label: 'Leave', icon: IconCalendar, module: 'leave' },
        { to: '/payslips', label: 'Payslips', icon: IconPrinter, module: 'payslips' },
        { to: '/expenses', label: 'Expenses', icon: IconBriefcase, module: 'expenses' },
        { to: '/reviews', label: 'Reviews & 1:1s', icon: IconTarget, module: 'reviews' },
        { to: '/documents', label: 'Documents', icon: IconPrinter, module: 'documents' }
      ]
    },
    {
      id: 'team',
      label: 'Team',
      items: [
        { to: '/brief', label: 'Daily brief', icon: IconSparkles, module: 'brief' },
        { to: '/team', label: 'Overview', icon: IconChart, module: 'team' },
        { to: '/employees', label: 'Employees', icon: IconUsers, module: 'employees' },
        { to: '/blockers', label: 'Blockers', icon: IconAlert, module: 'blockers' },
        { to: '/timesheets', label: 'Timesheets', icon: IconTimer, module: 'timesheets' },
        { to: '/team-attendance', label: 'Attendance', icon: IconCheck, module: 'team-attendance' },
        { to: '/leaves', label: 'Leave approvals', icon: IconCalendar, module: 'leaves' },
        { to: '/expense-approvals', label: 'Expense approvals', icon: IconBriefcase, module: 'expense-approvals' },
        { to: '/team-reviews', label: 'Team reviews & 1:1s', icon: IconTarget, module: 'team-reviews' },
        { to: '/analytics', label: 'Analytics', icon: IconTrendUp, module: 'analytics' },
        { to: '/reports', label: 'Weekly report', icon: IconPrinter, module: 'reports' },
        { to: '/retro', label: 'Weekly retro', icon: IconSparkles, module: 'retro' }
      ]
    },
    {
      // Every workspace section by name — the admin panel and roles used to
      // hide behind a single "Workspace" link, and at a narrow width behind
      // a scrolled-away tab as well
      id: 'manage',
      label: 'Workspace',
      items: workspaceSectionsFor(user).map(section => ({
        ...section,
        to: `/workspace/${section.to}`
      }))
    }
  ]

  return groups
    .map(group => ({ ...group, items: group.items.filter(i => can(user, i.module)) }))
    .filter(group => group.items.length > 0)
}

