import { useState } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
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
import Navbar from "./components/Navbar"
import ProtectedRoute from "./components/ProtectedRoute"
import Profile from "./pages/Profile"
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

export default function App() {
  const [user, setUser] = useState(getUser())

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      {user && <Navbar user={user} setUser={setUser} />}
      <Routes>
        <Route
          path="/login"
          element={
            !user ? <Login setUser={setUser} /> : <Navigate to="/dashboard" />
          }
        />
        <Route
          path="/register"
          element={
            !user ? (
              <Register setUser={setUser} />
            ) : (
              <Navigate to="/dashboard" />
            )
          }
        />

        <Route element={<ProtectedRoute user={user} />}>
          <Route path="/dashboard" element={<Dashboard user={user} />} />
          <Route path="/standup/new" element={<NewStandup />} />
          <Route path="/history" element={<History />} />
        </Route>

        <Route
          element={<ProtectedRoute user={user} roles={["manager", "admin"]} />}
        >
          <Route path="/team" element={<TeamView />} />
          <Route path="/blockers" element={<Blockers user={user} />} />
        </Route>

        <Route
          path="/profile"
          element={<Profile user={user} setUser={setUser} />}
        />

        <Route element={<ProtectedRoute user={user} roles={["admin"]} />}>
          <Route path="/admin" element={<AdminPanel />} />
        </Route>

        <Route
          path="*"
          element={<Navigate to={user ? "/dashboard" : "/login"} />}
        />
        <Route
          path="/forgot-password"
          element={!user ? <ForgotPassword /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/reset-password/:token"
          element={!user ? <ResetPassword /> : <Navigate to="/dashboard" />}
        />
      </Routes>
    </BrowserRouter>
  )
}
