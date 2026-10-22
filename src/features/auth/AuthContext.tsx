import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react'
import type { DemoSession, UserRole } from '@/types'
import { patientService } from '@/services/patientService'
import { staffService } from '@/services/staffService'

const SESSION_KEY = 'filfilu-demo-session'

const ROLE_DEFAULTS: Record<UserRole, { userId: string; displayName: string }> = {
  admin: { userId: 'staff-admin', displayName: 'Selam Bekele (Admin)' },
  doctor: { userId: 'staff-doc-1', displayName: 'Dr. Helen Tesfaye' },
  nurse: { userId: 'staff-nurse-1', displayName: 'Rahel Abebe' },
  patient: { userId: 'patient-1', displayName: 'Amina Mohammed' },
}

function readSession(): DemoSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DemoSession
  } catch {
    return null
  }
}

interface AuthContextValue {
  session: DemoSession | null
  isAuthenticated: boolean
  loginAs: (role: UserRole, userId?: string) => void
  logout: () => void
  switchRole: (role: UserRole) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoSession | null>(() => readSession())

  const persist = useCallback((next: DemoSession | null) => {
    setSession(next)
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next))
    else localStorage.removeItem(SESSION_KEY)
  }, [])

  const loginAs = useCallback(
    (role: UserRole, userId?: string) => {
      if (userId) {
        if (role === 'patient') {
          const p = patientService.getById(userId)
          persist({
            role,
            userId,
            displayName: p ? `${p.firstName} ${p.lastName}` : ROLE_DEFAULTS.patient.displayName,
          })
          return
        }
        const s = staffService.getById(userId)
        persist({
          role,
          userId,
          displayName: s
            ? `${role === 'doctor' ? 'Dr. ' : ''}${s.firstName} ${s.lastName}`
            : ROLE_DEFAULTS[role].displayName,
        })
        return
      }
      const defaults = ROLE_DEFAULTS[role]
      persist({ role, ...defaults })
    },
    [persist],
  )

  const logout = useCallback(() => persist(null), [persist])
  const switchRole = useCallback((role: UserRole) => loginAs(role), [loginAs])

  const value = useMemo(
    () => ({
      session,
      isAuthenticated: Boolean(session),
      loginAs,
      logout,
      switchRole,
    }),
    [session, loginAs, logout, switchRole],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
