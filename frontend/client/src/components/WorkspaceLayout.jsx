import { NavLink, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { can } from '../lib/permissions'
import { SPRING } from '../lib/motion'
import {
  IconBolt, IconBriefcase, IconCheck, IconList, IconShield, IconShieldCheck,
  IconTarget, IconUser, IconUsers
} from './ui/icons'

/**
 * The things a team sets up once and then rarely touches.
 *
 * These each had their own row in the sidebar, which pushed the work people
 * do every day — their standup, their week, the blockers — down among
 * settings they open twice a year. They live behind one entry now, with their
 * own row of tabs.
 */
const SECTIONS = [
  { to: 'projects', label: 'Projects', icon: IconBriefcase, module: 'projects' },
  { to: 'template', label: 'Standup template', icon: IconTarget, module: 'templates' },
  { to: 'integrations', label: 'Integrations', icon: IconBolt, module: 'integrations' },
  { to: 'activity', label: 'Activity', icon: IconList, module: 'activity' },
  { to: 'records', label: 'People records', icon: IconUser, module: 'records' },
  { to: 'hiring', label: 'Hiring', icon: IconUsers, module: 'hiring' },
  { to: 'approvals', label: 'Approvals', icon: IconCheck, module: 'approvals' },
  { to: 'admin', label: 'People & teams', icon: IconShield, module: 'people' },
  { to: 'roles', label: 'Roles & access', icon: IconShieldCheck, module: 'roles' }
]

export default function WorkspaceLayout({ user }) {
  const sections = SECTIONS.filter(s => can(user, s.module))

  return (
    <>
      {/* Matches the page frame below it, so the tabs sit on the same left
          edge as every page title in the app */}
      <div className="px-4 pt-6 md:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow mb-2.5">Workspace</p>

          {/* The same pills as the main navigation, in their own tray. Runs
              to the screen edge on a phone, so a tab that does not fit reads
              as "there is more this way" rather than as a clipped row */}
          <nav className="scroll-slim -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:w-fit md:max-w-full md:rounded-full md:border md:border-line/70 md:bg-surface/70 md:p-1 md:backdrop-blur-sm">
            {sections.map(section => (
              <NavLink
                key={section.to}
                to={section.to}
                className="relative shrink-0"
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="workspace-tab"
                        transition={SPRING}
                        className="absolute inset-0 rounded-full bg-brand-600 dark:bg-brand-400"
                      />
                    )}

                    <span
                      className={cn(
                        'relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] transition-colors',
                        isActive
                          ? 'font-medium text-white dark:text-brand-700'
                          : 'text-content-muted hover:text-content'
                      )}
                    >
                      <section.icon className="h-4 w-4" />
                      {section.label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <Outlet />
    </>
  )
}
