import { Bell, LogOut, Menu, X } from 'lucide-react'
import { useMemo, useState, type MouseEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { notificationService } from '@/services/notificationService'
import { NavLinks, adminNav, doctorNav, nurseNav, patientNav, publicNav, type NavItem } from './NavLinks'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useStoreVersion } from '@/hooks/useStoreVersion'
import { cn } from '@/lib/cn'
import type { DemoSession } from '@/types'

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

function initials(name: string) {
  return name
    .replace(/\(.*?\)/g, '')
    .replace(/^Dr\.\s*/, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        'bg-brand-gradient inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

function NotificationBell({ unread }: { unread: number }) {
  return (
    <Link
      to="/notifications"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-navy-900/10 bg-surface text-navy-800 transition hover:border-brand-500/40 hover:text-teal-600"
      aria-label="Notifications"
    >
      <Bell className="h-[18px] w-[18px]" />
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-sand-50">
          {unread}
        </span>
      ) : null}
    </Link>
  )
}

function UserCard({ session, onLogout }: { session: DemoSession; onLogout: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-navy-900/8 bg-surface-2/60 p-3">
      <Avatar name={session.displayName} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-navy-900">
          {session.displayName.replace(/\s*\(.*?\)/, '')}
        </p>
        <p className="text-xs capitalize text-ink-500">{session.role}</p>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition hover:bg-navy-900/5 hover:text-danger-600"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  )
}

function PublicShell() {
  const [open, setOpen] = useState(false)
  const closeOnLink = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a')) setOpen(false)
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-navy-900/6 bg-sand-50/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="no-underline">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {publicNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3.5 py-2 text-sm font-medium no-underline transition',
                    isActive
                      ? 'text-navy-900'
                      : 'text-ink-500 hover:bg-navy-900/5 hover:text-navy-900',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/login" className="hidden no-underline sm:block">
              <Button size="sm" className="px-4 py-2">
                Sign in
              </Button>
            </Link>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-navy-900/10 bg-surface text-navy-800 md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {open ? (
          <div className="border-t border-navy-900/6 px-4 py-3 md:hidden" onClick={closeOnLink}>
            <NavLinks items={publicNav} />
            <Link to="/login" className="mt-3 block no-underline">
              <Button className="w-full">Sign in</Button>
            </Link>
          </div>
        ) : null}
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <Outlet />
      </main>
      <footer className="border-t border-navy-900/6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-ink-500 sm:flex-row sm:px-6">
          <Logo className="scale-90" />
          <p>© {new Date().getFullYear()} Filfilu Hospital · Duty Schedule System</p>
        </div>
      </footer>
    </div>
  )
}

function SignedInShell({ session }: { session: DemoSession }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const { version } = useStoreVersion()
  const items = navForRole(session.role)
  const unread = useMemo(() => {
    void version
    return notificationService.unreadCount(session.userId)
  }, [session.userId, version])

  const closeOnLink = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a')) setOpen(false)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link to="/" className="px-2 pt-1 no-underline">
        <Logo />
      </Link>
      <div className="flex-1 overflow-y-auto">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
          Menu
        </p>
        <NavLinks items={items} />
      </div>
      <UserCard session={session} onLogout={handleLogout} />
    </div>
  )

  return (
    <div className="min-h-screen lg:pl-72">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-navy-900/6 bg-surface lg:block">
        {sidebar}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside
            onClick={closeOnLink}
            className="animate-fade-up relative h-full w-72 border-r border-navy-900/6 bg-surface shadow-2xl">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <header className="sticky top-0 z-30 border-b border-navy-900/6 bg-sand-50/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-navy-900/10 bg-surface text-navy-800 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="lg:hidden">
              <Logo />
            </div>
            <p className="hidden text-sm text-ink-500 lg:block">
              Welcome back,{' '}
              <span className="font-semibold text-navy-900">
                {session.displayName.replace(/\s*\(.*?\)/, '')}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell unread={unread} />
            <Avatar name={session.displayName} className="ml-1 hidden sm:inline-flex" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-8">
        <Outlet />
      </main>
    </div>
  )
}

export function AppShell() {
  const { session } = useAuth()
  return session ? <SignedInShell session={session} /> : <PublicShell />
}
