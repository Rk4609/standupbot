import { NavLink, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { SPRING } from '../lib/motion'
import { workspaceSectionsFor } from '../lib/workspaceSections'

/**
 * The things a team sets up once and then rarely touches.
 *
 * These each had their own row in the sidebar, which pushed the work people
 * do every day — their standup, their week, the blockers — down among
 * settings they open twice a year. They live behind one entry now, with their
 * own row of tabs.
 */
export default function WorkspaceLayout({ user }) {
  const sections = workspaceSectionsFor(user)

  return (
    <>
      <div className="px-4 pt-6 md:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow mb-2.5">Workspace</p>

          {/* The same pills as the main navigation, in their own tray. They
              wrap onto a second line rather than scrolling: a tab pushed off
              the right edge is a tab nobody finds, and the last ones here are
              the admin panel and roles. */}
          <nav className="flex flex-wrap gap-1 md:w-fit md:max-w-full md:rounded-[1.75rem] md:border md:border-line/70 md:bg-surface/70 md:p-1 md:backdrop-blur-sm">
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
