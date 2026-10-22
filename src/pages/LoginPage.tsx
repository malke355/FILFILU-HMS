import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  Check,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useAuth } from '@/features/auth/AuthContext'
import { cn } from '@/lib/cn'
import type { UserRole } from '@/types'

const roles: { role: UserRole; label: string; description: string; icon: LucideIcon }[] = [
  {
    role: 'admin',
    label: 'Admin',
    description: 'Staff, rosters & reports',
    icon: ShieldCheck,
  },
  {
    role: 'doctor',
    label: 'Doctor',
    description: 'Your shifts & exchanges',
    icon: Stethoscope,
  },
  {
    role: 'nurse',
    label: 'Nurse',
    description: 'Ward duty schedule',
    icon: HeartPulse,
  },
  {
    role: 'patient',
    label: 'Patient',
    description: 'Find doctors on duty',
    icon: UserRound,
  },
]

const destinations: Record<UserRole, string> = {
  admin: '/admin',
  doctor: '/doctor',
  nurse: '/nurse',
  patient: '/patient',
}

export function LoginPage() {
  const { loginAs } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState<UserRole>('admin')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    loginAs(role)
    navigate(destinations[role])
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="bg-brand-gradient relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-40 -left-20 h-[28rem] w-[28rem] rounded-full bg-cyan-300/20 blur-3xl"
          aria-hidden
        />

        <Link to="/" className="relative no-underline">
          <span className="inline-flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30 backdrop-blur">
              <Activity className="h-5 w-5 text-white" strokeWidth={2.5} />
            </span>
            <span className="font-display text-xl font-extrabold tracking-tight text-white">
              Filfilu
            </span>
          </span>
        </Link>

        <div className="relative my-auto max-w-lg py-12">
          <h2 className="animate-fade-up text-5xl font-extrabold leading-[1.05] tracking-tight">
            Every shift,
            <br />
            perfectly in sync.
          </h2>
          <p className="animate-fade-up-delay mt-5 text-lg text-white/80">
            Plan duty rosters, publish schedules, and swap shifts — all in one calm, simple place.
          </p>

          <div className="relative mt-12 h-56">
            <div className="animate-float absolute left-0 top-0 w-72 rounded-2xl bg-white/15 p-4 shadow-2xl ring-1 ring-white/25 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-teal-700">
                  HT
                </span>
                <div>
                  <p className="text-sm font-semibold">Dr. Helen Tesfaye</p>
                  <p className="text-xs text-white/75">Internal Medicine · On duty now</p>
                </div>
                <span className="ml-auto h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_0_4px_rgb(110_231_183_/_0.3)]" />
              </div>
            </div>
            <div
              className="animate-float absolute right-0 top-24 w-64 rounded-2xl bg-white p-4 text-navy-900 shadow-2xl dark:text-slate-900"
              style={{ animationDelay: '1.5s' }}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <CalendarCheck2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Shift swap approved</p>
                  <p className="text-xs text-slate-500">Night · Fri 20:00 – 08:00</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative flex gap-10 text-white/90">
          {[
            ['24/7', 'Coverage view'],
            ['4', 'Role workspaces'],
            ['1-click', 'Publishing'],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-sm text-white/70">{label}</p>
            </div>
          ))}
        </div>
      </aside>

      <section className="relative flex flex-col px-6 py-6 sm:px-12">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 no-underline hover:text-navy-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="animate-fade-up text-4xl font-extrabold tracking-tight text-navy-900">
            Welcome back
          </h1>
          <p className="animate-fade-up-delay mt-2 text-ink-500">
            Choose your workspace to sign in to Filfilu.
          </p>

          <form onSubmit={onSubmit} className="mt-8">
            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-navy-800">Sign in as</legend>
              <div className="grid grid-cols-2 gap-3">
                {roles.map((r, i) => {
                  const selected = role === r.role
                  return (
                    <label
                      key={r.role}
                      className={cn(
                        'animate-fade-up relative cursor-pointer rounded-2xl border bg-surface p-4 transition-all duration-200',
                        selected
                          ? 'border-brand-500 shadow-lg shadow-brand-500/15 ring-4 ring-brand-500/10'
                          : 'border-navy-900/10 hover:-translate-y-0.5 hover:border-navy-900/20 hover:shadow-md',
                      )}
                      style={{ animationDelay: `${0.05 * i}s` }}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={r.role}
                        checked={selected}
                        onChange={() => setRole(r.role)}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          'mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl transition',
                          selected
                            ? 'bg-brand-gradient text-white'
                            : 'bg-surface-2 text-ink-500',
                        )}
                      >
                        <r.icon className="h-5 w-5" />
                      </span>
                      <span className="block text-sm font-bold text-navy-900">{r.label}</span>
                      <span className="mt-0.5 block text-xs text-ink-500">{r.description}</span>
                      <span
                        className={cn(
                          'absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full transition',
                          selected
                            ? 'bg-brand-500 text-white'
                            : 'border border-navy-900/15 text-transparent',
                        )}
                        aria-hidden
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <Button type="submit" size="lg" className="mt-6 w-full">
              Continue as {roles.find((r) => r.role === role)?.label}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500">
            Just looking for a doctor?{' '}
            <Link to="/doctors" className="font-semibold">
              Browse the directory
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-ink-500/80">
          Demo workspace · no password required
        </p>
      </section>
    </div>
  )
}
