import {
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthContext'
import { departmentService } from '@/services/departmentService'
import { doctorService } from '@/services/doctorService'

const dashboardPath = { admin: '/admin', doctor: '/doctor', nurse: '/nurse', patient: '/patient' }

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
    <div className="space-y-24">
      <section className="relative grid items-center gap-12 pt-6 lg:grid-cols-[1.1fr_1fr] lg:pt-12">
        <div
          className="pointer-events-none absolute -left-32 -top-24 -z-10 h-[28rem] w-[28rem] rounded-full bg-brand-500/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-20 top-20 -z-10 h-80 w-80 rounded-full bg-sky-brand/15 blur-3xl"
          aria-hidden
        />

        <div>
          <span className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-600">
            <Sparkles className="h-3.5 w-3.5" /> Live hospital duty schedules
          </span>
          <h1 className="animate-fade-up mt-6 text-balance text-5xl font-extrabold leading-[1.05] tracking-tight text-navy-900 sm:text-6xl">
            Hospital shifts, <span className="text-gradient">beautifully simple.</span>
          </h1>
          <p className="animate-fade-up-delay mt-6 max-w-lg text-lg text-ink-500">
            See which doctors are on duty, plan rosters with confidence, and keep every team in sync
            — all from one calm workspace.
          </p>
          <div className="animate-fade-up-delay mt-9 flex flex-wrap gap-3">
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

          <dl className="animate-fade-up-delay mt-12 flex gap-10">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="text-3xl font-extrabold text-navy-900">{s.value}</dd>
                <p className="text-sm text-ink-500">{s.label}</p>
              </div>
            ))}
          </dl>
        </div>

        <div className="animate-fade-up-delay relative">
          <div className="surface-panel relative overflow-hidden p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-navy-900">
                  {onDuty.length ? 'On duty today' : 'Our doctors'}
                </p>
                <p className="text-xs text-ink-500">
                  {new Date().toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-ok-600 dark:bg-emerald-500/10">
                <span className="animate-soft-pulse h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <ul className="space-y-2">
              {preview.map((doc) => (
                <li key={doc.id}>
                  <Link
                    to={`/doctors/${doc.id}`}
                    className="flex items-center gap-3 rounded-xl p-2.5 no-underline transition hover:bg-navy-900/4"
                  >
                    <span className="bg-brand-gradient inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                      {initials(doc.displayName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-navy-900">
                        {doc.displayName}
                      </span>
                      <span className="block truncate text-xs text-ink-500">
                        {doc.specialty} · {doc.departmentName}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-ink-500" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/doctors/on-duty"
              className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-navy-900/8 py-2.5 text-sm font-semibold no-underline transition hover:bg-teal-50"
            >
              View full duty board <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="animate-float absolute -bottom-6 -left-6 hidden rounded-2xl border border-navy-900/8 bg-surface p-3.5 shadow-xl sm:block">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold text-navy-900">Only published shifts</p>
                <p className="text-[11px] text-ink-500">Drafts stay private</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto mb-12 max-w-2xl text-center">
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
              <span className="bg-brand-gradient mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-lg shadow-brand-600/25 transition group-hover:scale-110">
                <item.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="text-lg font-bold text-navy-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand-gradient relative overflow-hidden rounded-3xl px-8 py-14 text-center text-white sm:px-16">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden />
        <div className="relative">
          <Stethoscope className="mx-auto mb-4 h-10 w-10 text-white/90" />
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {session ? 'Pick up where you left off' : 'Ready to get started?'}
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
            <Button size="lg" className="bg-white text-teal-700 shadow-xl hover:bg-white/90">
              {session ? 'Open dashboard' : 'Sign in'} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
