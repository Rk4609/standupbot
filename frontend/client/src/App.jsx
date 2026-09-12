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
        </Route>

        <Route element={<ProtectedRoute user={user} roles={["manager", "admin"]} />}>
          <Route path="/team" element={<TeamView />} />
          <Route path="/blockers" element={<Blockers user={user} />} />
          <Route path="/retro" element={<Retro user={user} />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/analytics" element={<Analytics />} />
        </Route>

        <Route element={<ProtectedRoute user={user} roles={["admin"]} />}>
          <Route path="/admin" element={<AdminPanel user={user} />} />
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

  const routes = (
    <Suspense fallback={<RouteFallback />}>
      <AnimatedRoutes user={user} setUser={setUser} />
    </Suspense>
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
