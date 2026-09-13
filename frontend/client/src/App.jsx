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

import AppShell from "./components/AppShell"
import ErrorBoundary from "./components/ErrorBoundary"
import ProtectedRoute from "./components/ProtectedRoute"
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
 * Routes live in their own component so they can read the location — the key
 * AnimatePresence needs to run exit animations between pages.
 */
function AnimatedRoutes({ user, setUser }) {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
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

        <Route
          path="/reset-password/:token"
          element={!user ? <ResetPassword /> : <Navigate to="/dashboard" replace />}
        />

        <Route element={<ProtectedRoute user={user} />}>
          <Route path="/dashboard" element={<Dashboard user={user} />} />
          <Route path="/standup/new" element={<NewStandup />} />
          <Route path="/history" element={<History />} />
          <Route path="/profile" element={<Profile user={user} setUser={setUser} />} />
          <Route path="/timesheet" element={<Timesheet />} />
          <Route path="/support" element={<Support user={user} />} />
        </Route>

        <Route element={<ProtectedRoute user={user} roles={["manager", "admin"]} />}>
          <Route path="/team" element={<TeamView />} />
          <Route path="/blockers" element={<Blockers user={user} />} />
          <Route path="/retro" element={<Retro user={user} />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/timesheets" element={<TeamTimesheets />} />

          {/* Set-up lives together rather than as five more sidebar rows */}
          <Route path="/workspace" element={<WorkspaceLayout user={user} />}>
            <Route index element={<Navigate to="projects" replace />} />
            <Route path="projects" element={<Projects />} />
            <Route path="template" element={<Templates />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="activity" element={<Activity />} />
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
          <Route path="/workspace" element={<WorkspaceLayout user={user} />}>
            <Route path="admin" element={<AdminPanel user={user} />} />
          </Route>
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
          toastOptions={{
            duration: 3500,
            className:
              "!bg-surface-raised !text-content !border !border-line !shadow-pop !text-sm",
            success: { iconTheme: { primary: "#7c3aed", secondary: "#fff" } },
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
