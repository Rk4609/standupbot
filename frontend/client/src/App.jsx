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

import Navbar from "./components/Navbar"
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
const AdminPanel = lazy(() => import("./pages/AdminPanel"))

/** Shown while a route chunk is in flight — mirrors the page layout. */
function RouteFallback() {
  return (
    <div className="min-h-screen bg-surface-muted px-4 py-6 md:py-8">
      <div className="mx-auto max-w-3xl">
        <Skeleton className="mb-2 h-7 w-56" />
        <Skeleton className="mb-6 h-4 w-40" />
        <div className="mb-5 grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-[76px] rounded-card md:h-[88px]" />
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
        </Route>

        <Route element={<ProtectedRoute user={user} roles={["admin"]} />}>
          <Route path="/admin" element={<AdminPanel />} />
        </Route>

        <Route
          path="*"
          element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
        />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  const [user, setUser] = useState(getUser())

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
              "!bg-surface !text-content !border !border-line !shadow-lift !text-sm",
            success: { iconTheme: { primary: "#7c3aed", secondary: "#fff" } },
            error: { iconTheme: { primary: "#dc2626", secondary: "#fff" } }
          }}
        />

        {user && <Navbar user={user} setUser={setUser} />}

        <Suspense fallback={<RouteFallback />}>
          <AnimatedRoutes user={user} setUser={setUser} />
        </Suspense>
      </BrowserRouter>
    </MotionConfig>
  )
}
