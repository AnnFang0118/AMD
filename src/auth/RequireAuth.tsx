import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function RequireAuth({ allow }: { allow: ('user'|'child')[] }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  if (!allow.includes(session.role)) return <Navigate to="/login" replace />
  return <Outlet/>
}
