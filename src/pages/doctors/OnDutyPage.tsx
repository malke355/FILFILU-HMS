import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { ScheduleDisclaimer } from '@/components/layout/ScheduleDisclaimer'
import { toISODate } from '@/lib/dates'
import { doctorService } from '@/services/doctorService'
import { shiftTypeService } from '@/services/departmentService'
import { scheduleService } from '@/services/scheduleService'

export function OnDutyPage() {
  const [date, setDate] = useState(toISODate(new Date()))
  const doctors = useMemo(() => doctorService.listOnDuty(date), [date])
  const shifts = shiftTypeService.list()

  return (
    <div>
      <PageHeader
        title="Doctors on Duty"
        description="Shows published, public doctor assignments only. Nurse schedules stay private by default."
      />
      <ScheduleDisclaimer className="mb-6" />
      <div className="mb-6 max-w-xs">
        <label className="mb-1 block text-sm font-medium text-navy-800" htmlFor="duty-date">
          Date
        </label>
        <Input
          id="duty-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {doctors.length === 0 ? (
        <EmptyState
          title="No published doctors on duty"
          description="There are no public published doctor assignments for this date in the demonstration data."
        />
      ) : (
        <ul className="space-y-3">
          {doctors.map((doc) => {
            const assignment = scheduleService
              .listPublishedPublicDoctors(date)
              .find((a) => a.staffId === doc.staffId)
            const shift = shifts.find((s) => s.id === assignment?.shiftTypeId)
            return (
              <li key={doc.id} className="surface-panel flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <Link to={`/doctors/${doc.id}`} className="font-display text-lg text-navy-900 no-underline">
                    {doc.displayName}
                  </Link>
                  <p className="text-sm text-ink-500">
                    {doc.specialty} · {doc.departmentName}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold text-teal-600">
                    {shift?.name ?? 'Shift'}{' '}
                    {shift ? `${shift.startTime}–${shift.endTime}` : ''}
                    {shift?.overnight ? ' (+1 day)' : ''}
                  </p>
                  <p className="text-xs text-ink-500">Published · public visibility</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
