import {
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  Clock3,
  HeartPulse,
  Search,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import heroImage from '@/assets/filfilu-login.jpg'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { useAuth } from '@/features/auth/AuthContext'
import { departmentService } from '@/services/departmentService'
import { doctorService } from '@/services/doctorService'

const dashboardPath = { admin: '/admin', doctor: '/doctor', nurse: '/nurse', patient: '/patient' }

const pillars = [
  { icon: Stethoscope, label: 'Better Care' },
  { icon: Clock3, label: 'Faster Service' },
  { icon: ShieldCheck, label: 'Safer & Secure' },
  { icon: Users, label: 'Health for All' },
]

const features = [
  {
    icon: Search,
    title: 'Find the right doctor',
    body: 'Search published profiles by name or specialty — no account needed.',
  },
  {
    icon: CalendarDays,
    title: 'Draft, then publish',
    body: 'Build rosters privately and publish only what patients should see.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Painless shift swaps',
    body: 'Request, accept, and approve exchanges in a few clicks.',
  },
]

function initials(name: string) {
  return name
    .replace(/^Dr\.\s*/, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
}

export function HomePage() {
  const { session } = useAuth()
  const doctors = useMemo(() => doctorService.listPublished(), [])
  const onDuty = useMemo(() => doctorService.listOnDuty(), [])
  const departments = departmentService.list().filter((d) => d.active)
  const preview = (onDuty.length ? onDuty : doctors).slice(0, 4)

  const stats = [
    { value: doctors.length, label: 'Published doctors' },
    { value: onDuty.length, label: 'On duty today' },
    { value: departments.length, label: 'Departments' },
  ]

  return (
    <div className="space-y-20">
      <section className="relative overflow-hidden rounded-[2rem] border border-navy-900/8 bg-surface shadow-[0_24px_60px_-30px_rgb(15_23_42_/_0.35)]">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative z-10 flex flex-col justify-center px-8 py-12 sm:px-12 lg:py-16">
            <Logo showTagline className="mb-8" />
            <h1 className="animate-fade-up max-w-lg text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-blue-950 sm:text-5xl dark:text-navy-900">
              From clinically to{' '}
              <span className="bg-gradient-to-r from-sky-500 to-teal-500 bg-clip-text text-transparent">
                one place.
              </span>
            </h1>
            <p className="animate-fade-up-delay mt-5 max-w-md text-base text-ink-500 sm:text-lg">
              Filfilu Hospital brings patients, doctors, and health services together — all in one
              smart system.
            </p>
            <div className="animate-fade-up-delay mt-8 flex flex-wrap gap-3">
              <Link to="/doctors" className="no-underline">
                <Button size="lg">
                  Find a doctor <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              {session ? (
                <Link to={dashboardPath[session.role]} className="no-underline">
                  <Button size="lg" variant="outline">
                    Go to dashboard
                  </Button>
                </Link>
              ) : (
                <Link to="/login" className="no-underline">
                  <Button size="lg" variant="outline">
                    Staff sign in
                  </Button>
                </Link>
              )}
            </div>

            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {pillars.map((p) => (
                <div key={p.label} className="flex flex-col items-start gap-2">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-teal-500 text-white shadow-md shadow-teal-500/30">
                    <p.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-xs font-semibold text-navy-900">{p.label}</span>
                </div>
              ))}
            </div>

            <dl className="mt-10 flex flex-wrap gap-8 border-t border-navy-900/8 pt-8">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="text-3xl font-extrabold text-blue-950 dark:text-navy-900">
                    {s.value}
                  </dd>
                  <p className="text-sm text-ink-500">{s.label}</p>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative min-h-[22rem] overflow-hidden lg:min-h-full">
            <img
              src={heroImage}
              alt="Filfilu Hospital care team"
              className="absolute inset-0 h-full w-full object-cover object-[72%_center]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/40 to-transparent lg:from-transparent" />
            <div className="absolute bottom-6 left-6 right-6 sm:left-auto sm:right-6 sm:w-80">
              <div className="surface-panel animate-fade-up-delay p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-navy-900">
                      {onDuty.length ? 'On duty today' : 'Our doctors'}
                    </p>
                    <p className="text-xs text-ink-500">Live published schedule</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-ok-600 dark:bg-emerald-500/10">
                    <span className="animate-soft-pulse h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Live
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {preview.map((doc) => (
                    <li key={doc.id}>
                      <Link
                        to={`/doctors/${doc.id}`}
                        className="flex items-center gap-3 rounded-xl p-2 no-underline transition hover:bg-navy-900/4"
                      >
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-teal-500 text-[11px] font-bold text-white">
                          {initials(doc.displayName)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-navy-900">
                            {doc.displayName}
                          </span>
                          <span className="block truncate text-xs text-ink-500">
                            {doc.specialty}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">
            Everything your hospital needs
          </h2>
          <p className="mt-3 text-ink-500">
            Simple tools for patients, doctors, nurses, and administrators.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {features.map((item, i) => (
            <div
              key={item.title}
              className="surface-panel animate-fade-up group p-6 transition duration-300 hover:-translate-y-1 hover:border-brand-500/30"
              style={{ animationDelay: `${0.08 * i}s` }}
            >
              <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-teal-500 text-white shadow-lg shadow-teal-500/25 transition group-hover:scale-110">
                <item.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="text-lg font-bold text-navy-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 px-8 py-14 text-center text-white sm:px-16">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-20" aria-hidden />
        <div className="relative">
          <HeartPulse className="mx-auto mb-4 h-10 w-10 text-teal-200" />
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {session ? 'Pick up where you left off' : 'Your health, our priority'}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-white/80">
            {session
              ? 'Your schedule, exchanges, and notifications are waiting.'
              : 'Sign in to manage schedules, or browse doctors on duty right now.'}
          </p>
          <Link
            to={session ? dashboardPath[session.role] : '/login'}
            className="mt-8 inline-block no-underline"
          >
            <Button size="lg" className="bg-white text-blue-800 shadow-xl hover:bg-white/90">
              {session ? 'Open dashboard' : 'Welcome back — Sign in'}{' '}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
