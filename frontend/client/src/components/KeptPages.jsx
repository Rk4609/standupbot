import { Activity, Suspense, useEffect, useState } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import Skeleton from './ui/Skeleton'
import { warmUp } from '../api/axios'
import { can } from '../lib/permissions'
import { keepKeyFor } from '../lib/keepAlive'
import { todayForUser } from '../lib/timezone'

/**
 * Each module's first request, exactly as the page makes it — so the page
 * finds it already answered. If a page changes what it asks for, this simply
 * stops matching and the page fetches as before.
 */
const firstRequests = (user) => [
  ['history', '/templates/active'],
  ['history', '/standups/my'],
  ['timesheet', '/timesheets/me', { params: {} }],
  ['attendance', '/attendance/me', { params: {} }],
  ['team-attendance', '/attendance/team', { params: {} }],
  ['brief', '/brief', { params: {} }],
  ['payslips', '/payslips/mine'],
  ['kudos', '/kudos', { params: { page: 1 } }],
  ['expenses', '/expenses/mine'],
  ['documents', '/letters/mine'],
  ['dashboard', '/celebrations'],
  ['dashboard', '/announcements'],
  ['leave', '/leave/mine'],
  ['leave', '/leave/calendar', { params: {} }],
  ['leaves', '/leave/team', { params: { page: 1, status: 'pending' } }],
  ['support', '/support/mine'],
  ...(user?.role === 'admin' ? [['support', '/support?page=1']] : []),
  ['team', `/standups/team?date=${todayForUser()}`],
  ['team', '/standups/stats'],
  ['employees', '/employees/summary'],
  ['employees', '/employees', { params: { page: 1, limit: 20 } }],
  ['blockers', '/standups/blockers'],
  ['timesheets', '/timesheets', { params: {} }],
  ['analytics', '/analytics/overview', { params: { days: 30 } }],
  ['projects', '/projects/all']
]

/** Once per session: a permission refresh re-renders, it should not re-fetch. */
let warmedForToken = null

/**
 * Each page's code, with the module somebody needs to open it. Fetched once
 * the app has painted, so the first tap on any of them has nothing left to
 * download. Only the pages this person can open: an employee on a phone
 * should not pay for the analytics charts.
 */
const PAGES = [
  ['dashboard', () => import('../pages/Dashboard')],
  ['standup', () => import('../pages/NewStandup')],
  ['history', () => import('../pages/History')],
  ['timesheet', () => import('../pages/Timesheet')],
  ['leave', () => import('../pages/Leave')],
  ['attendance', () => import('../pages/Attendance')],
  ['payslips', () => import('../pages/Payslips')],
  ['kudos', () => import('../pages/Kudos')],
  ['expenses', () => import('../pages/Expenses')],
  ['reviews', () => import('../pages/Reviews')],
  ['reviews', () => import('../pages/ReviewDetail')],
  ['reviews', () => import('../pages/OneOnOneDetail')],
  ['documents', () => import('../pages/Documents')],
  ['documents', () => import('../pages/LetterView')],
  ['support', () => import('../pages/Support')],
  ['dashboard', () => import('../pages/Profile')],
  ['team', () => import('../pages/TeamView')],
  ['employees', () => import('../pages/Employees')],
  ['blockers', () => import('../pages/Blockers')],
  ['timesheets', () => import('../pages/TeamTimesheets')],
  ['leaves', () => import('../pages/LeaveApprovals')],
  ['expense-approvals', () => import('../pages/ExpenseApprovals')],
  ['team-reviews', () => import('../pages/TeamReviews')],
  ['team-attendance', () => import('../pages/TeamAttendance')],
  ['brief', () => import('../pages/Brief')],
  ['reports', () => import('../pages/WeeklyReport')],
  ['analytics', () => import('../pages/Analytics')],
  ['retro', () => import('../pages/Retro')],
  ['projects', () => import('./WorkspaceLayout')],
  ['projects', () => import('../pages/Projects')],
  ['templates', () => import('../pages/Templates')],
  ['integrations', () => import('../pages/Integrations')],
  ['activity', () => import('../pages/Activity')],
  ['records', () => import('../pages/People')],
  ['hiring', () => import('../pages/Hiring')],
  ['onboarding', () => import('../pages/Onboarding')],
  ['announce', () => import('../pages/Announcements')],
  ['dashboard', () => import('../pages/OnboardingDetail')],
  ['people', () => import('../pages/AdminPanel')],
  ['roles', () => import('../pages/Roles')],
  ['pay', () => import('../pages/Payroll')],
  ['settings', () => import('../pages/CompanySettings')]
]

function PageFallback() {
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
 * The pages inside the app, kept alive once opened.
 *
 * Opening a module used to build it from nothing — blank screen, skeleton,
 * wait — even one on screen a moment earlier. A page opened once now stays
 * mounted underneath, hidden in React's <Activity>. Coming back shows it at
 * once; because a hidden page's effects run again when it is shown, it
 * fetches fresh data in the background while the last data stays in view.
 */
export default function KeptPages({ user }) {
  const path = useLocation().pathname
  const outlet = useOutlet()

  // Nothing is kept for somebody signed out: those routes only redirect, and
  // one person's pages must never outlive their session
  const key = user ? keepKeyFor(path) : null
  const [opened, setOpened] = useState([])

  if (key && outlet && !opened.some(page => page.key === key)) {
    setOpened([...opened, { key, element: outlet }])
  }

  useEffect(() => {
    if (!user) return
    const start = window.requestIdleCallback || ((fn) => setTimeout(fn, 400))
    const stop = window.cancelIdleCallback || clearTimeout
    const handle = start(() => {
      for (const [module, load] of PAGES) {
        if (can(user, module)) load().catch(() => {})
      }

      // And their data. Not on a connection the phone has asked to spare.
      if (navigator.connection?.saveData || warmedForToken === user.token) return
      warmedForToken = user.token
      for (const [module, url, config] of firstRequests(user)) {
        if (can(user, module)) warmUp(url, config)
      }
    })
    return () => stop(handle)
  }, [user])

  return (
    <Suspense fallback={<PageFallback />}>
      {!key && outlet}

      {opened.map(page => (
        <Activity key={page.key} mode={page.key === key ? 'visible' : 'hidden'}>
          {/* The visible page gets the router's current element, so it sees
              any change in the signed-in user; hidden ones keep their last */}
          {page.key === key ? outlet : page.element}
        </Activity>
      ))}
    </Suspense>
  )
}
