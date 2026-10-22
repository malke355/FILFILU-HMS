import { Link, useParams } from 'react-router-dom'
import { Bookmark } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ScheduleDisclaimer } from '@/components/layout/ScheduleDisclaimer'
import { useAuth } from '@/features/auth/AuthContext'
import { doctorService, dutyStatusLabel } from '@/services/doctorService'
import { patientService } from '@/services/patientService'
import { useStoreVersion } from '@/hooks/useStoreVersion'

export function DoctorProfilePage() {
  const { id } = useParams()
  const { session } = useAuth()
  const { version, refresh } = useStoreVersion()
  const doctor = id ? doctorService.getPublishedById(id) : undefined
  void version
  const patient =
    session?.role === 'patient' ? patientService.getById(session.userId) : undefined
  const saved = patient?.savedDoctorIds.includes(doctor?.id ?? '') ?? false

  if (!doctor) {
    return (
      <EmptyState
        title="Doctor not found"
        description="This profile is unpublished or does not exist in the demonstration directory."
        action={
          <Link to="/doctors">
            <Button variant="outline">Back to directory</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div>
      <Link to="/doctors" className="mb-4 inline-block text-sm font-semibold">
        ← Directory
      </Link>
      <ScheduleDisclaimer className="mb-6" />
      <div className="surface-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-navy-900">{doctor.displayName}</h1>
            <p className="mt-1 text-ink-500">
              {doctor.specialty} · {doctor.departmentName}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="teal">{dutyStatusLabel(doctor.dutyStatus)}</Badge>
              {doctor.acceptingPatients ? (
                <Badge tone="ok">Accepting referrals (demo)</Badge>
              ) : (
                <Badge tone="muted">Not listing as accepting</Badge>
              )}
            </div>
          </div>
          {session?.role === 'patient' ? (
            <Button
              variant={saved ? 'secondary' : 'outline'}
              onClick={() => {
                doctorService.toggleSaved(session.userId, doctor.id)
                refresh()
              }}
            >
              <Bookmark className="h-4 w-4" />
              {saved ? 'Saved' : 'Save doctor'}
            </Button>
          ) : null}
        </div>
        <p className="mt-6 max-w-2xl text-ink-700">{doctor.bio}</p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Experience</dt>
            <dd className="mt-1 font-medium">{doctor.yearsExperience} years (demo)</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Languages</dt>
            <dd className="mt-1 font-medium">{doctor.languages.join(', ')}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Next published duty</dt>
            <dd className="mt-1 font-medium">{doctor.nextShiftLabel ?? 'None listed'}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
