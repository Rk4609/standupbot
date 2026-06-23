import { Navigate, Outlet } from 'react-router-dom'

export default function ProtectedRoute({ user, roles }) {
  if (!user) return <Navigate to="/login" />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />
  return <Outlet />
}