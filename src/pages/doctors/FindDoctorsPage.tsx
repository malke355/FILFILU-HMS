import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input, Select } from '@/components/ui/Input'
import { ScheduleDisclaimer } from '@/components/layout/ScheduleDisclaimer'
import { departmentService } from '@/services/departmentService'
import { doctorService, dutyStatusLabel } from '@/services/doctorService'

const statusTone = {
  scheduled_on_duty: 'ok',
  upcoming_duty: 'teal',
  no_published_schedule: 'muted',
  schedule_unavailable: 'warn',
} as const

export function FindDoctorsPage() {
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('all')
  const departments = departmentService.list()
  const doctors = useMemo(() => doctorService.listPublished(), [])

  const filtered = doctors.filter((d) => {
    const matchesQ =
      !q ||
      d.displayName.toLowerCase().includes(q.toLowerCase()) ||
      d.specialty.toLowerCase().includes(q.toLowerCase())
    const matchesDept = dept === 'all' || d.departmentId === dept
    return matchesQ && matchesDept
  })

  return (
    <div>
      <PageHeader
        title="Find a Doctor"
        description="Published directory only. Draft duty schedules are never listed here."
      />
      <ScheduleDisclaimer className="mb-6" />
      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-500" />
          <Input
            className="pl-9"
            placeholder="Search by name or specialty"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search doctors"
          />
        </div>
        <Select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department filter">
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No published doctors match"
          description="Try another specialty or clear filters. Only demonstration profiles marked published appear here."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {filtered.map((doc) => (
            <li key={doc.id}>
              <Link
                to={`/doctors/${doc.id}`}
                className="surface-panel block h-full p-5 text-navy-900 no-underline transition hover:border-teal-600/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-display text-xl">{doc.displayName}</h2>
                    <p className="text-sm text-ink-500">
                      {doc.specialty} · {doc.departmentName}
                    </p>
                  </div>
                  <Badge tone={statusTone[doc.dutyStatus]}>{dutyStatusLabel(doc.dutyStatus)}</Badge>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-ink-700">{doc.bio}</p>
                {doc.nextShiftLabel ? (
                  <p className="mt-3 text-xs font-semibold text-teal-600">{doc.nextShiftLabel}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
