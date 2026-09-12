import { useState } from "react"
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

import Login from "./pages/Login"
import Register from "./pages/Register"
import Dashboard from "./pages/Dashboard"
import NewStandup from "./pages/NewStandup"
import History from "./pages/History"
import TeamView from "./pages/TeamView"
import Blockers from "./pages/Blockers"
import AdminPanel from "./pages/AdminPanel"
import Profile from "./pages/Profile"
import ForgotPassword from "./pages/ForgotPassword"
import ResetPassword from "./pages/ResetPassword"
import Retro from "./pages/Retro"

import Navbar from "./components/Navbar"
import ProtectedRoute from "./components/ProtectedRoute"
import OfflineIndicator from "./components/OfflineIndicator"

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

        <AnimatedRoutes user={user} setUser={setUser} />
      </BrowserRouter>
    </MotionConfig>
  )
}
