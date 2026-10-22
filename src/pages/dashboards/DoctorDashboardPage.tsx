import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthContext'
import { exchangeService } from '@/services/exchangeService'
import { scheduleService } from '@/services/scheduleService'
import { shiftTypeService } from '@/services/departmentService'
import { formatDisplayDate } from '@/lib/dates'

export function DoctorDashboardPage() {
  const { session } = useAuth()
  const assignments = session
    ? scheduleService.listForStaff(session.userId).sort((a, b) => a.date.localeCompare(b.date))
    : []
  const exchanges = session ? exchangeService.listForUser(session.userId) : []

  return (
    <div>
      <PageHeader
        title="Doctor dashboard"
        description={`Welcome${session ? `, ${session.displayName}` : ''}. Review your duty assignments and exchanges.`}
        actions={
          <Link to="/doctor/schedule">
            <Button variant="outline">Full schedule</Button>
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface-panel p-5">
          <h2 className="font-display text-xl">Upcoming duties</h2>
          <ul className="mt-3 space-y-2">
            {assignments.slice(0, 5).map((a) => {
              const shift = shiftTypeService.getById(a.shiftTypeId)
              return (
                <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {formatDisplayDate(a.date)} · {shift?.name}
                    {shift?.overnight ? ' (overnight)' : ''}
                  </span>
                  <Badge tone={a.status === 'published' ? 'ok' : 'warn'}>{a.status}</Badge>
                </li>
              )
            })}
            {assignments.length === 0 ? (
              <li className="text-sm text-ink-500">No assignments yet.</li>
            ) : null}
          </ul>
        </section>
        <section className="surface-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">Exchanges</h2>
            <Link to="/exchanges" className="text-sm font-semibold">
              Manage
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {exchanges.slice(0, 5).map((e) => (
              <li key={e.id} className="flex justify-between gap-2">
                <span className="truncate">{e.reason}</span>
                <Badge tone="muted">{e.status}</Badge>
              </li>
            ))}
            {exchanges.length === 0 ? (
              <li className="text-ink-500">No exchange activity.</li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  )
}

export function StaffSchedulePage({ roleLabel }: { roleLabel: string }) {
  const { session } = useAuth()
  const assignments = session
    ? scheduleService.listForStaff(session.userId).sort((a, b) => a.date.localeCompare(b.date))
    : []

  return (
    <div>
      <PageHeader
        title={`My ${roleLabel} schedule`}
        description="Assignments from the demonstration duty roster. Draft items are visible to you but not to the public directory."
      />
      <ul className="space-y-3">
        {assignments.map((a) => {
          const shift = shiftTypeService.getById(a.shiftTypeId)
          return (
            <li key={a.id} className="surface-panel flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{formatDisplayDate(a.date)}</p>
                <p className="text-sm text-ink-500">
                  {shift?.name} {shift?.startTime}–{shift?.endTime}
                  {shift?.overnight ? ' (+1 day)' : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge tone={a.status === 'published' ? 'ok' : 'warn'}>{a.status}</Badge>
                <Badge tone="muted">{a.visibility}</Badge>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
