import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/features/auth/AuthContext'
import { exchangeService } from '@/services/exchangeService'
import { scheduleService } from '@/services/scheduleService'
import { shiftTypeService } from '@/services/departmentService'
import { formatDisplayDate } from '@/lib/dates'

export function NurseDashboardPage() {
  const { session } = useAuth()
  const assignments = session
    ? scheduleService.listForStaff(session.userId).sort((a, b) => a.date.localeCompare(b.date))
    : []
  const exchanges = session ? exchangeService.listForUser(session.userId) : []

  return (
    <div>
      <PageHeader
        title="Nurse dashboard"
        description={`Welcome${session ? `, ${session.displayName}` : ''}. Your duty visibility defaults to private in public views.`}
        actions={
          <Link to="/nurse/schedule">
            <Button variant="outline">Full schedule</Button>
          </Link>
        }
      />
      <Alert tone="info" className="mb-6">
        Nurse schedules are private by default and do not appear in the public Doctors on Duty
        directory.
      </Alert>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface-panel p-5">
          <h2 className="font-display text-xl">My duties</h2>
          <ul className="mt-3 space-y-2">
            {assignments.slice(0, 5).map((a) => {
              const shift = shiftTypeService.getById(a.shiftTypeId)
              return (
                <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {formatDisplayDate(a.date)} · {shift?.name}
                  </span>
                  <Badge tone={a.status === 'published' ? 'ok' : 'warn'}>{a.status}</Badge>
                </li>
              )
            })}
          </ul>
        </section>
        <section className="surface-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">Exchanges</h2>
            <Link to="/exchanges" className="text-sm font-semibold">
              Open
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {exchanges.slice(0, 5).map((e) => (
              <li key={e.id} className="flex justify-between gap-2">
                <span className="truncate">{e.reason}</span>
                <Badge tone="muted">{e.status}</Badge>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
