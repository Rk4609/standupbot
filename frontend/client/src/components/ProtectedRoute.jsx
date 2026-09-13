import { Navigate, Outlet } from 'react-router-dom'
import NoAccess from './NoAccess'
import { can } from '../lib/permissions'

export default function ProtectedRoute({ user, roles, module }) {
  if (!user) return <Navigate to="/login" />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />

  // A silent bounce to the dashboard reads as a broken link. Saying which
  // part of the app this is, and who can turn it back on, is one screen and
  // saves somebody guessing.
  if (module && !can(user, module)) return <NoAccess module={module} />

  return <Outlet />
}
