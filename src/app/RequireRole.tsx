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
        title="This page isn't available for your role"
        description={`You're signed in as ${session.role}. Sign in with a different role to continue.`}
        action={
          <Link to="/login">
            <Button variant="outline">Switch role</Button>
          </Link>
        }
      />
    )
  }
  return children
}
