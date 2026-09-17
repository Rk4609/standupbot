import { Activity, Suspense, useEffect, useState } from 'react'
import { NavLink, useLocation, useOutlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import Skeleton from './ui/Skeleton'
import { cn } from '../lib/cn'
import { SPRING } from '../lib/motion'
import { workspaceSectionsFor } from '../lib/workspaceSections'

/**
 * Every Workspace page's code, fetched as soon as Workspace opens.
 *
 * The same module paths App.jsx loads lazily, so they resolve to the same
 * chunks: once these have landed, clicking a tab has nothing left to
 * download and goes straight to the page.
 */
const PAGES = [
  () => import('../pages/Projects'),
  () => import('../pages/Templates'),
  () => import('../pages/Integrations'),
  () => import('../pages/Activity'),
  () => import('../pages/People'),
  () => import('../pages/Hiring'),
  () => import('../pages/AdminPanel'),
  () => import('../pages/Roles')
]

/** Stands in for the page under the tabs while its code is still arriving. */
function ContentFallback() {
  return (
    <div className="px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-6xl">
        <Skeleton className="mb-2 h-8 w-56" />
        <Skeleton className="mb-7 h-4 w-80" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    </div>
  )
}

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

  /**
   * Tabs already opened stay alive underneath, hidden.
   *
   * Each page fetched its data on mount, so coming back to a tab meant a
   * skeleton and a wait for something that had been on screen seconds ago.
   * Held in an <Activity>, a hidden page keeps what it loaded; when it is
   * shown again its effects run again, so it refetches in the background
   * while the last data stays in view — current, but never blank.
   */
  const path = useLocation().pathname
  const outlet = useOutlet()
  const isTab = path.replace(/\/+$/, '') !== '/workspace'
  const [opened, setOpened] = useState([])

  if (isTab && outlet && !opened.some(page => page.path === path)) {
    setOpened([...opened, { path, element: outlet }])
  }

  useEffect(() => {
    // After first paint, so fetching the other tabs never slows this one
    const start = window.requestIdleCallback || ((fn) => setTimeout(fn, 200))
    const handle = start(() => PAGES.forEach(load => load().catch(() => {})))
    return () => (window.cancelIdleCallback || clearTimeout)(handle)
  }, [])

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

      {/* Its own loading boundary, below the tabs: a page whose code is still
          on its way fills the content area, instead of the app-wide fallback
          blanking the tabs as well */}
      <Suspense fallback={<ContentFallback />}>
        {/* /workspace itself only redirects, so it is never kept */}
        {!isTab && outlet}

        {opened.map(page => (
          <Activity key={page.path} mode={page.path === path ? 'visible' : 'hidden'}>
            {/* The visible one gets the router's current element, so it sees
                any change in the user; hidden ones keep their last one */}
            {page.path === path ? outlet : page.element}
          </Activity>
        ))}
      </Suspense>
    </>
  )
}
