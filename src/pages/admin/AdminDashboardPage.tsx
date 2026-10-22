import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { toISODate } from '@/lib/dates'
import { exchangeService } from '@/services/exchangeService'
import { scheduleService } from '@/services/scheduleService'
import { staffService } from '@/services/staffService'
import { departmentService } from '@/services/departmentService'

export function AdminDashboardPage() {
  const today = toISODate(new Date())
  const summary = scheduleService.summarizeForDate(today)
  const staff = staffService.list()
  const pendingExchanges = exchangeService.list().filter((e) =>
    ['pending', 'accepted'].includes(e.status),
  )
  const depts = departmentService.list().filter((d) => d.active)

  const stats = [
    { label: 'Active staff', value: staff.filter((s) => s.active).length },
    { label: 'Departments', value: depts.length },
    { label: 'Today published', value: summary.published },
    { label: 'Today drafts', value: summary.draft },
    { label: 'Open exchanges', value: pendingExchanges.length },
  ]

  return (
    <div>
      <PageHeader
        title="Admin dashboard"
        description="Demonstration overview of staffing, published duties, and exchange queue."
      />
      <div className="mb-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="surface-panel p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{s.label}</p>
            <p className="mt-1 font-display text-3xl text-navy-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface-panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl">Today by department</h2>
            <Link to="/admin/schedule" className="text-sm font-semibold">
              Open schedule
            </Link>
          </div>
          <ul className="space-y-2">
            {summary.departments.map((d) => (
              <li key={d.id} className="flex items-center justify-between text-sm">
                <span>{d.name}</span>
                <Badge tone={d.count ? 'teal' : 'muted'}>{d.count} assigned</Badge>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl">Exchange queue</h2>
            <Link to="/exchanges" className="text-sm font-semibold">
              Review all
            </Link>
          </div>
          {pendingExchanges.length === 0 ? (
            <p className="text-sm text-ink-500">No pending exchanges.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {pendingExchanges.slice(0, 5).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{e.reason}</span>
                  <Badge tone={e.status === 'accepted' ? 'ok' : 'warn'}>{e.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
