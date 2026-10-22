import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ScheduleDisclaimer } from '@/components/layout/ScheduleDisclaimer'
import { useAuth } from '@/features/auth/AuthContext'
import { doctorService, dutyStatusLabel } from '@/services/doctorService'
import { patientService } from '@/services/patientService'
import { useStoreVersion } from '@/hooks/useStoreVersion'

export function PatientDashboardPage() {
  const { session } = useAuth()
  const { version } = useStoreVersion()
  void version
  const patient = session ? patientService.getById(session.userId) : undefined
  const doctors = doctorService.listPublished()
  const saved = doctors.filter((d) => patient?.savedDoctorIds.includes(d.id))

  return (
    <div>
      <PageHeader
        title="Patient dashboard"
        description={`Hello${patient ? `, ${patient.firstName}` : ''}. Track saved doctors and published duty status.`}
        actions={
          <Link to="/doctors">
            <Button>Find a Doctor</Button>
          </Link>
        }
      />
      <ScheduleDisclaimer className="mb-6" />
      <section className="surface-panel p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl">Saved doctors</h2>
          <Link to="/patient/saved" className="text-sm font-semibold">
            View all
          </Link>
        </div>
        {saved.length === 0 ? (
          <p className="text-sm text-ink-500">No saved doctors yet.</p>
        ) : (
          <ul className="space-y-3">
            {saved.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link to={`/doctors/${d.id}`} className="font-semibold no-underline">
                    {d.displayName}
                  </Link>
                  <p className="text-sm text-ink-500">{d.specialty}</p>
                </div>
                <Badge tone="teal">{dutyStatusLabel(d.dutyStatus)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export function SavedDoctorsPage() {
  const { session } = useAuth()
  const { version, refresh } = useStoreVersion()
  void version
  const patient = session ? patientService.getById(session.userId) : undefined
  const saved = doctorService
    .listPublished()
    .filter((d) => patient?.savedDoctorIds.includes(d.id))

  return (
    <div>
      <PageHeader
        title="Saved doctors"
        description="Demonstration bookmarks stored in localStorage."
      />
      <ScheduleDisclaimer className="mb-6" />
      <ul className="space-y-3">
        {saved.map((d) => (
          <li key={d.id} className="surface-panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <Link to={`/doctors/${d.id}`} className="font-display text-lg no-underline">
                {d.displayName}
              </Link>
              <p className="text-sm text-ink-500">
                {d.specialty} · {dutyStatusLabel(d.dutyStatus)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (session) doctorService.toggleSaved(session.userId, d.id)
                refresh()
              }}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PatientProfilePage() {
  const { session } = useAuth()
  const patient = session ? patientService.getById(session.userId) : undefined

  return (
    <div>
      <PageHeader title="My profile" description="Demonstration patient profile (not verified)." />
      <div className="surface-panel max-w-lg space-y-3 p-5 text-sm">
        <p>
          <span className="text-ink-500">Name:</span>{' '}
          <strong>
            {patient?.firstName} {patient?.lastName}
          </strong>
        </p>
        <p>
          <span className="text-ink-500">Email:</span> {patient?.email}
        </p>
        <p>
          <span className="text-ink-500">Preferred language:</span>{' '}
          {patient?.preferredLanguage ?? '—'}
        </p>
        <p className="text-xs text-ink-500">
          No hospital address or phone is listed — this is demonstration data only.
        </p>
      </div>
    </div>
  )
}
