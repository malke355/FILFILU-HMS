import { ArrowRight, CalendarDays, Stethoscope, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthContext'

export function HomePage() {
  const { session, loginAs } = useAuth()

  return (
    <div>
      <section className="relative -mx-4 mb-12 overflow-hidden px-4 pb-16 pt-8 sm:pt-12">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden
          style={{
            background:
              'linear-gradient(135deg, rgb(11 31 58 / 0.92) 0%, rgb(18 48 86 / 0.88) 45%, rgb(13 148 136 / 0.75) 100%), radial-gradient(circle at 80% 20%, rgb(20 184 166 / 0.35), transparent 40%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-30"
          aria-hidden
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.12\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }}
        />
        <div className="mx-auto max-w-3xl text-white">
          <p className="animate-fade-up font-display text-5xl font-bold tracking-tight sm:text-6xl">
            Filfilu
          </p>
          <h1 className="animate-fade-up-delay mt-3 max-w-xl text-balance font-display text-2xl font-medium text-teal-50 sm:text-3xl">
            Hospital duty schedules, clearly published for staff and patients.
          </h1>
          <p className="animate-fade-up-delay mt-4 max-w-lg text-base text-white/80">
            Browse published doctors on duty, manage drafts securely for staff, and coordinate shift
            exchanges — Phase 1 demonstration frontend.
          </p>
          <div className="animate-fade-up-delay mt-8 flex flex-wrap gap-3">
            <Link to="/doctors">
              <Button variant="secondary" size="lg">
                Find a Doctor <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/doctors/on-duty">
              <Button
                size="lg"
                className="border border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                Doctors on Duty
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mb-10 grid gap-6 sm:grid-cols-3">
        {[
          {
            icon: Stethoscope,
            title: 'Public directory',
            body: 'Patients can browse published doctor profiles without signing in.',
          },
          {
            icon: CalendarDays,
            title: 'Draft → publish',
            body: 'Staff build duty rosters privately, then publish only what should be visible.',
          },
          {
            icon: Users,
            title: 'Role-aware demos',
            body: 'Switch Admin, Doctor, Nurse, or Patient roles from the demo banner.',
          },
        ].map((item, i) => (
          <div
            key={item.title}
            className="animate-fade-up"
            style={{ animationDelay: `${0.08 * i}s` }}
          >
            <item.icon className="mb-3 h-6 w-6 text-teal-600" aria-hidden />
            <h2 className="font-display text-xl text-navy-900">{item.title}</h2>
            <p className="mt-1 text-sm text-ink-500">{item.body}</p>
          </div>
        ))}
      </section>

      <section className="surface-panel p-6">
        <h2 className="font-display text-2xl text-navy-900">Try a demo role</h2>
        <p className="mt-1 text-sm text-ink-500">
          {session
            ? `You are viewing as ${session.displayName}. Use the banner to switch.`
            : 'No login required for the public directory. Sign in with a demo role to explore staff tools.'}
        </p>
        {!session ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => loginAs('admin')}>Enter as Admin</Button>
            <Button variant="outline" onClick={() => loginAs('doctor')}>
              Enter as Doctor
            </Button>
            <Button variant="outline" onClick={() => loginAs('nurse')}>
              Enter as Nurse
            </Button>
            <Button variant="outline" onClick={() => loginAs('patient')}>
              Enter as Patient
            </Button>
          </div>
        ) : (
          <div className="mt-4">
            <Link to={`/${session.role === 'admin' ? 'admin' : session.role}`}>
              <Button>
                Go to dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
