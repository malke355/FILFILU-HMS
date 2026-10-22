import { Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import type { UserRole } from '@/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Link } from 'react-router-dom'

export function RequireRole({
  roles,
  children,
}: {
  roles: UserRole[]
  children: React.ReactNode
}) {
  const { session } = useAuth()
  if (!session) {
    return <Navigate to="/login" replace />
  }
  if (!roles.includes(session.role)) {
    return (
      <EmptyState
        title="Role not permitted in this demo view"
        description={`Signed in as ${session.role}. Switch roles from the demo banner.`}
        action={
          <Link to="/">
            <Button variant="outline">Home</Button>
          </Link>
        }
      />
    )
  }
  return children
}
