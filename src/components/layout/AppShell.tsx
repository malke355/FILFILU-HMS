import { Menu, X, Bell } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { notificationService } from '@/services/notificationService'
import { DemoBanner } from './DemoBanner'
import {
  NavLinks,
  adminNav,
  doctorNav,
  nurseNav,
  patientNav,
  publicNav,
  type NavItem,
} from './NavLinks'
import { Button } from '@/components/ui/Button'
import { useStoreVersion } from '@/hooks/useStoreVersion'

function navForRole(role: string | undefined): NavItem[] {
  switch (role) {
    case 'admin':
      return adminNav
    case 'doctor':
      return doctorNav
    case 'nurse':
      return nurseNav
    case 'patient':
      return patientNav
    default:
      return publicNav
  }
}

export function AppShell() {
  const { session } = useAuth()
  const [open, setOpen] = useState(false)
  const { version } = useStoreVersion()
  const items = navForRole(session?.role)
  const unread = useMemo(() => {
    void version
    if (!session) return 0
    return notificationService.unreadCount(session.userId)
  }, [session, version])

  return (
    <div className="min-h-screen">
      <DemoBanner />
      <header className="border-b border-navy-900/8 bg-white/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="group flex items-baseline gap-2 no-underline">
            <span className="font-display text-2xl font-bold tracking-tight text-navy-900 group-hover:text-teal-600">
              Filfilu
            </span>
            <span className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-ink-500 sm:inline">
              Duty Schedule
            </span>
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {items.slice(0, 5).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-xl px-3 py-2 text-sm font-medium text-navy-800 no-underline hover:bg-teal-50"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {session ? (
              <Link
                to="/notifications"
                className="relative rounded-xl p-2 text-navy-800 hover:bg-teal-50"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unread > 0 ? (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                ) : null}
              </Link>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {open ? (
          <div className="border-t border-navy-900/8 px-4 py-3 md:hidden">
            <NavLinks items={items} onNavigate={() => setOpen(false)} />
          </div>
        ) : null}
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <div className="surface-panel sticky top-4 p-3">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-ink-500">
              {session ? `${session.role} menu` : 'Browse'}
            </p>
            <NavLinks items={items} />
            {session ? (
              <p className="mt-4 border-t border-navy-900/8 px-3 pt-3 text-xs text-ink-500">
                Signed in as <span className="font-semibold text-navy-800">{session.displayName}</span>
              </p>
            ) : (
              <p className="mt-4 border-t border-navy-900/8 px-3 pt-3 text-xs text-ink-500">
                Public browse — no login required for the doctor directory.
              </p>
            )}
          </div>
        </aside>
        <main className="min-w-0 pb-16">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
