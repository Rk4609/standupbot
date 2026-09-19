import { Suspense, lazy, useState } from "react"
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation
} from "react-router-dom"
import { AnimatePresence, MotionConfig } from "framer-motion"
import { Toaster } from "react-hot-toast"
import { getUser } from "./store/authStore"
import { workspaceSectionsFor } from "./lib/workspaceSections"

import AppShell from "./components/AppShell"
import ErrorBoundary from "./components/ErrorBoundary"
import ProtectedRoute from "./components/ProtectedRoute"
import KeptPages from "./components/KeptPages"
import OfflineIndicator from "./components/OfflineIndicator"
import Skeleton from "./components/ui/Skeleton"

/**
 * Pages are loaded on demand so the first paint does not ship every screen.
 * This keeps recharts (only used by Team and Admin) out of the entry bundle.
 */
const Login = lazy(() => import("./pages/Login"))
const Register = lazy(() => import("./pages/Register"))
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"))
const ResetPassword = lazy(() => import("./pages/ResetPassword"))
const Dashboard = lazy(() => import("./pages/Dashboard"))
const NewStandup = lazy(() => import("./pages/NewStandup"))
const History = lazy(() => import("./pages/History"))
const Profile = lazy(() => import("./pages/Profile"))
const TeamView = lazy(() => import("./pages/TeamView"))
const Blockers = lazy(() => import("./pages/Blockers"))
const Retro = lazy(() => import("./pages/Retro"))
const Employees = lazy(() => import("./pages/Employees"))
const Analytics = lazy(() => import("./pages/Analytics"))
const Activity = lazy(() => import("./pages/Activity"))
const Templates = lazy(() => import("./pages/Templates"))
const Integrations = lazy(() => import("./pages/Integrations"))
const WorkspaceLayout = lazy(() => import("./components/WorkspaceLayout"))
const Timesheet = lazy(() => import("./pages/Timesheet"))
const Support = lazy(() => import("./pages/Support"))
const Leave = lazy(() => import("./pages/Leave"))
const LeaveApprovals = lazy(() => import("./pages/LeaveApprovals"))
const Attendance = lazy(() => import("./pages/Attendance"))
const TeamAttendance = lazy(() => import("./pages/TeamAttendance"))
const Payslips = lazy(() => import("./pages/Payslips"))
const Payroll = lazy(() => import("./pages/Payroll"))
const Onboarding = lazy(() => import("./pages/Onboarding"))
const OnboardingDetail = lazy(() => import("./pages/OnboardingDetail"))
const Brief = lazy(() => import("./pages/Brief"))
const WeeklyReport = lazy(() => import("./pages/WeeklyReport"))
const Kudos = lazy(() => import("./pages/Kudos"))
const Expenses = lazy(() => import("./pages/Expenses"))
const ExpenseApprovals = lazy(() => import("./pages/ExpenseApprovals"))
const Reviews = lazy(() => import("./pages/Reviews"))
const TeamReviews = lazy(() => import("./pages/TeamReviews"))
const ReviewDetail = lazy(() => import("./pages/ReviewDetail"))
const OneOnOneDetail = lazy(() => import("./pages/OneOnOneDetail"))
const Documents = lazy(() => import("./pages/Documents"))
const Letters = lazy(() => import("./pages/Letters"))
const LetterView = lazy(() => import("./pages/LetterView"))
const VerifyLetter = lazy(() => import("./pages/VerifyLetter"))
const Announcements = lazy(() => import("./pages/Announcements"))
const CompanySettings = lazy(() => import("./pages/CompanySettings"))
const Roles = lazy(() => import("./pages/Roles"))
const People = lazy(() => import("./pages/People"))
const Hiring = lazy(() => import("./pages/Hiring"))
const Projects = lazy(() => import("./pages/Projects"))
const TeamTimesheets = lazy(() => import("./pages/TeamTimesheets"))
const NotFound = lazy(() => import("./pages/NotFound"))
const AdminPanel = lazy(() => import("./pages/AdminPanel"))

/** Shown while a route chunk is in flight — mirrors the page layout. */
function RouteFallback() {
  return (
    <div className="px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-4xl">
        <Skeleton className="mb-2 h-8 w-64" />
        <Skeleton className="mb-7 h-4 w-44" />
        <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 rounded-card" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-card" />
      </div>
    </div>
  )
}

/**
 * Which part of the app a path belongs to, for the page transition.
 *
 * Every Workspace tab is one place. Keyed by the full path, switching tabs
 * tore down the whole Workspace — tabs included — ran the exit animation,
 * waited on it, and built everything again, so a tab switch looked like a
 * full page reload. Keyed by section, the frame stays and only the content
 * under the tabs changes.
 */
const PUBLIC = ["/login", "/register", "/forgot-password", "/reset-password"]

// Inside the app the pages keep themselves (KeptPages); the screen-to-screen
// animation is only for the sign-in pages, which have nothing to keep
const transitionKey = (pathname) =>
  PUBLIC.some(p => pathname === p || pathname.startsWith(`${p}/`)) ? pathname : "app"

/**
 * Routes live in their own component so they can read the location — the key
 * AnimatePresence needs to run exit animations between pages.
 */
function AnimatedRoutes({ user, setUser }) {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={transitionKey(location.pathname)}>
        {/* The address people actually type, and the one the installed app
            opens at. It used to be caught by a redirect-everything route;
            when that became a real 404 page, the front door became one too. */}
        <Route
          path="/"
          element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
        />

        <Route
          path="/login"
          element={
            !user ? <Login setUser={setUser} /> : <Navigate to="/dashboard" replace />
          }
        />

        <Route
          path="/register"
          element={
            !user ? <Register setUser={setUser} /> : <Navigate to="/dashboard" replace />
          }
        />

        <Route
          path="/forgot-password"
          element={!user ? <ForgotPassword /> : <Navigate to="/dashboard" replace />}
        />

        {/* Public, signed in or not: a bank checking a letter is real */}
        <Route path="/verify/:code" element={<VerifyLetter />} />

        <Route
          path="/reset-password/:token"
          element={!user ? <ResetPassword /> : <Navigate to="/dashboard" replace />}
        />

        {/* Every page inside the app, kept alive once opened */}
        <Route element={<KeptPages user={user} />}>
        <Route element={<ProtectedRoute user={user} />}>
          <Route path="/dashboard" element={<Dashboard user={user} />} />
          <Route path="/profile" element={<Profile user={user} setUser={setUser} />} />
          <Route path="/support" element={<Support user={user} />} />
        </Route>

        {/* Every route below names the module its role must still hold. The
            server refuses these too — this only keeps somebody from walking
            into a page that is going to turn them away. */}
        <Route element={<ProtectedRoute user={user} module="standup" />}>
          <Route path="/standup/new" element={<NewStandup />} />
        </Route>
        <Route element={<ProtectedRoute user={user} module="history" />}>
          <Route path="/history" element={<History />} />
        </Route>
        <Route element={<ProtectedRoute user={user} module="timesheet" />}>
          <Route path="/timesheet" element={<Timesheet />} />
        </Route>
        <Route element={<ProtectedRoute user={user} module="leave" />}>
          <Route path="/leave" element={<Leave />} />
        </Route>
        <Route element={<ProtectedRoute user={user} module="kudos" />}>
          <Route path="/kudos" element={<Kudos />} />
        </Route>
        <Route element={<ProtectedRoute user={user} module="attendance" />}>
          <Route path="/attendance" element={<Attendance />} />
        </Route>
        {/* One slip: its owner, or whoever runs payroll — the server decides */}
        <Route element={<ProtectedRoute user={user} />}>
          <Route path="/payslips/:id" element={<Payslips />} />
          {/* A checklist: the joiner's own, or one the reader helps with —
              the server says which, and hides the rest */}
          <Route path="/onboarding/:id" element={<OnboardingDetail />} />
          {/* A review or a 1:1: its owner or the manager on the other side — the server says which */}
          <Route path="/reviews/:id" element={<ReviewDetail />} />
          <Route path="/one-on-ones/:id" element={<OneOnOneDetail />} />
          <Route path="/letters/:id" element={<LetterView />} />
        </Route>
        <Route element={<ProtectedRoute user={user} module="payslips" />}>
          <Route path="/payslips" element={<Payslips />} />
        </Route>
        <Route element={<ProtectedRoute user={user} module="expenses" />}>
          <Route path="/expenses" element={<Expenses />} />
        </Route>
        <Route element={<ProtectedRoute user={user} module="reviews" />}>
          <Route path="/reviews" element={<Reviews />} />
        </Route>
        <Route element={<ProtectedRoute user={user} module="documents" />}>
          <Route path="/documents" element={<Documents />} />
        </Route>

        <Route element={<ProtectedRoute user={user} roles={["manager", "admin"]} />}>
          <Route element={<ProtectedRoute user={user} module="team" />}>
            <Route path="/team" element={<TeamView />} />
          </Route>
          <Route element={<ProtectedRoute user={user} module="blockers" />}>
            <Route path="/blockers" element={<Blockers user={user} />} />
          </Route>
          <Route element={<ProtectedRoute user={user} module="retro" />}>
            <Route path="/retro" element={<Retro user={user} />} />
          </Route>
          <Route element={<ProtectedRoute user={user} module="employees" />}>
            <Route path="/employees" element={<Employees />} />
          </Route>
          <Route element={<ProtectedRoute user={user} module="analytics" />}>
            <Route path="/analytics" element={<Analytics />} />
          </Route>
          <Route element={<ProtectedRoute user={user} module="timesheets" />}>
            <Route path="/timesheets" element={<TeamTimesheets />} />
          </Route>
          <Route element={<ProtectedRoute user={user} module="leaves" />}>
            <Route path="/leaves" element={<LeaveApprovals />} />
          </Route>
          <Route element={<ProtectedRoute user={user} module="expense-approvals" />}>
            <Route path="/expense-approvals" element={<ExpenseApprovals />} />
          </Route>
          <Route element={<ProtectedRoute user={user} module="team-reviews" />}>
            <Route path="/team-reviews" element={<TeamReviews />} />
          </Route>
          <Route element={<ProtectedRoute user={user} module="brief" />}>
            <Route path="/brief" element={<Brief />} />
          </Route>
          <Route element={<ProtectedRoute user={user} module="reports" />}>
            <Route path="/reports" element={<WeeklyReport />} />
          </Route>
          <Route element={<ProtectedRoute user={user} module="team-attendance" />}>
            <Route path="/team-attendance" element={<TeamAttendance />} />
          </Route>

          {/* Set-up lives together rather than as five more sidebar rows */}
          <Route path="/workspace" element={<WorkspaceLayout user={user} />}>
            {/* The first section this person may open — landing everybody on
                Projects showed "not part of your role" to a role without it */}
            <Route
              index
              element={
                <Navigate to={workspaceSectionsFor(user)[0]?.to || "projects"} replace />
              }
            />
            <Route element={<ProtectedRoute user={user} module="projects" />}>
              <Route path="projects" element={<Projects />} />
            </Route>
            <Route element={<ProtectedRoute user={user} module="templates" />}>
              <Route path="template" element={<Templates />} />
            </Route>
            <Route element={<ProtectedRoute user={user} module="integrations" />}>
              <Route path="integrations" element={<Integrations />} />
            </Route>
            <Route element={<ProtectedRoute user={user} module="activity" />}>
              <Route path="activity" element={<Activity />} />
            </Route>
            <Route element={<ProtectedRoute user={user} module="records" />}>
              <Route path="records" element={<People user={user} />} />
            </Route>
            <Route element={<ProtectedRoute user={user} module="hiring" />}>
              <Route path="hiring" element={<Hiring />} />
            </Route>
            <Route element={<ProtectedRoute user={user} module="announce" />}>
              <Route path="announcements" element={<Announcements />} />
            </Route>
            <Route element={<ProtectedRoute user={user} module="onboarding" />}>
              <Route path="onboarding" element={<Onboarding />} />
            </Route>

            {/* The admin-only tabs sit in the same Workspace as the rest. As a
                second <Route path="/workspace"> of their own, moving between
                one of them and any other tab swapped one layout for another
                and rebuilt the tabs, which is the reload this is avoiding. */}
            <Route element={<ProtectedRoute user={user} roles={["admin"]} />}>
              <Route element={<ProtectedRoute user={user} module="people" />}>
                <Route path="admin" element={<AdminPanel user={user} />} />
              </Route>
              <Route element={<ProtectedRoute user={user} module="roles" />}>
                <Route path="roles" element={<Roles />} />
              </Route>
              <Route element={<ProtectedRoute user={user} module="approvals" />}>
                <Route path="approvals" element={<Hiring decide />} />
              </Route>
              <Route element={<ProtectedRoute user={user} module="pay" />}>
                <Route path="payroll" element={<Payroll />} />
              </Route>
              <Route element={<ProtectedRoute user={user} module="settings" />}>
                <Route path="settings" element={<CompanySettings />} />
              </Route>
              <Route element={<ProtectedRoute user={user} module="letters" />}>
                <Route path="letters" element={<Letters />} />
              </Route>
            </Route>
          </Route>
        </Route>
        </Route>

        {/* The paths these pages used to live at, so a bookmark still lands */}
        <Route path="/projects" element={<Navigate to="/workspace/projects" replace />} />
        <Route path="/templates" element={<Navigate to="/workspace/template" replace />} />
        <Route
          path="/integrations"
          element={<Navigate to="/workspace/integrations" replace />}
        />
        <Route path="/activity" element={<Navigate to="/workspace/activity" replace />} />

        <Route element={<ProtectedRoute user={user} roles={["admin"]} />}>
          <Route path="/admin" element={<Navigate to="/workspace/admin" replace />} />
        </Route>

        {/* A silent redirect here made a stale bundle look like a broken
            link — say what happened instead */}
        <Route path="*" element={<NotFound user={user} />} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  const [user, setUser] = useState(getUser())

  // Inside the shell rather than around it: a page that throws should leave
  // the navigation, the theme toggle and the sign-out button working.
  const routes = (
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <AnimatedRoutes user={user} setUser={setUser} />
      </Suspense>
    </ErrorBoundary>
  )

  return (
    // reducedMotion="user" makes every Framer animation respect the OS setting
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <OfflineIndicator />

        <Toaster
          position="top-right"
          // Below the top bar: a popup sitting on the bell hides the very
          // badge it is telling you about
          containerStyle={{ top: 64 }}
          toastOptions={{
            duration: 3500,
            className:
              "!bg-surface-raised !text-content !border !border-line !shadow-pop !text-sm",
            success: { iconTheme: { primary: "#e9b20c", secondary: "#1c1c1a" } },
            error: { iconTheme: { primary: "#dc2626", secondary: "#fff" } }
          }}
        />

        {user ? (
          <AppShell user={user} setUser={setUser}>
            {routes}
          </AppShell>
        ) : (
          routes
        )}
      </BrowserRouter>
    </MotionConfig>
  )
}
