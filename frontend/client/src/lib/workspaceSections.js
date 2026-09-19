import {
  IconBolt, IconBriefcase, IconCheck, IconInbox, IconList, IconPrinter, IconShield, IconShieldCheck,
  IconTarget, IconUser, IconUsers
} from '../components/ui/icons'
import { can } from './permissions'

/**
 * The things a team sets up once and then rarely touches, in one place.
 *
 * Shared by the Workspace tabs, the Workspace menu in the top bar and the
 * mobile drawer, so the three can never disagree about what exists or who
 * may open it.
 */
export const WORKSPACE_SECTIONS = [
  { to: 'projects', label: 'Projects', icon: IconBriefcase, module: 'projects' },
  { to: 'template', label: 'Standup template', icon: IconTarget, module: 'templates' },
  { to: 'integrations', label: 'Integrations', icon: IconBolt, module: 'integrations' },
  { to: 'activity', label: 'Activity', icon: IconList, module: 'activity' },
  { to: 'records', label: 'People records', icon: IconUser, module: 'records' },
  { to: 'hiring', label: 'Hiring', icon: IconUsers, module: 'hiring' },
  { to: 'onboarding', label: 'Onboarding', icon: IconCheck, module: 'onboarding' },
  { to: 'announcements', label: 'Announcements', icon: IconInbox, module: 'announce' },
  { to: 'approvals', label: 'Approvals', icon: IconCheck, module: 'approvals' },
  { to: 'payroll', label: 'Payroll', icon: IconPrinter, module: 'pay' },
  // Called the admin panel by the people who use it, so that is its name
  { to: 'admin', label: 'Admin panel', icon: IconShield, module: 'people' },
  { to: 'roles', label: 'Roles & access', icon: IconShieldCheck, module: 'roles' },
  { to: 'settings', label: 'Company settings', icon: IconTarget, module: 'settings' }
]

/** The sections this person may open, in order. */
export const workspaceSectionsFor = (user) =>
  WORKSPACE_SECTIONS.filter(section => can(user, section.module))
