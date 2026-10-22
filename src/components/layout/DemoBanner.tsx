import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/Button'
import type { UserRole } from '@/types'

const roles: UserRole[] = ['admin', 'doctor', 'nurse', 'patient']

export function DemoBanner() {
  const { session, switchRole, logout, loginAs } = useAuth()

  return (
    <div className="border-b border-amber-500/30 bg-amber-50 text-amber-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-xs sm:text-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong>Demonstration mode</strong> — role switching is not security. No real
            authentication, hospital credentials, or verified contact details.
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {roles.map((role) => (
            <Button
              key={role}
              size="sm"
              variant={session?.role === role ? 'secondary' : 'outline'}
              onClick={() => (session ? switchRole(role) : loginAs(role))}
              className="capitalize"
            >
              {role}
            </Button>
          ))}
          {session ? (
            <Button size="sm" variant="ghost" onClick={logout}>
              Sign out
            </Button>
          ) : (
            <Link to="/login" className="text-xs font-semibold text-amber-950 underline">
              Demo login
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
