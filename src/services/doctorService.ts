import { isInNextDays, isToday, toISODate } from '@/lib/dates'
import type { DoctorDutyStatus, DoctorProfile, DutyAssignment } from '@/types'
import { scheduleService } from './scheduleService'
import { loadStore, updateStore } from './storage'
import { departmentService, shiftTypeService } from './departmentService'

export interface DoctorDirectoryItem extends DoctorProfile {
  departmentName: string
  dutyStatus: DoctorDutyStatus
  nextAssignment?: DutyAssignment
  nextShiftLabel?: string
}

function resolveDutyStatus(staffId: string): {
  status: DoctorDutyStatus
  nextAssignment?: DutyAssignment
  nextShiftLabel?: string
} {
  const published = scheduleService
    .list()
    .filter(
      (a) =>
        a.staffId === staffId &&
        a.status === 'published' &&
        a.visibility === 'public',
    )
    .sort((a, b) => a.date.localeCompare(b.date))

  if (published.length === 0) {
    const anyDraftOnly = scheduleService
      .list()
      .some((a) => a.staffId === staffId && a.status === 'draft')
    return {
      status: anyDraftOnly ? 'schedule_unavailable' : 'no_published_schedule',
    }
  }

  const todayAsg = published.find((a) => isToday(a.date))
  if (todayAsg) {
    const shift = shiftTypeService.getById(todayAsg.shiftTypeId)
    return {
      status: 'scheduled_on_duty',
      nextAssignment: todayAsg,
      nextShiftLabel: shift
        ? `${shift.name} ${shift.startTime}–${shift.endTime}${shift.overnight ? ' (+1 day)' : ''}`
        : undefined,
    }
  }

  const upcoming = published.find((a) => a.date >= toISODate(new Date()) || isInNextDays(a.date, 14))
  if (upcoming) {
    const shift = shiftTypeService.getById(upcoming.shiftTypeId)
    return {
      status: 'upcoming_duty',
      nextAssignment: upcoming,
      nextShiftLabel: shift
        ? `${upcoming.date} · ${shift.name} ${shift.startTime}–${shift.endTime}`
        : upcoming.date,
    }
  }

  return { status: 'no_published_schedule' }
}

export const doctorService = {
  listPublished(): DoctorDirectoryItem[] {
    const depts = departmentService.list()
    return loadStore()
      .doctorProfiles.filter((d) => d.publishedInDirectory)
      .map((profile) => {
        const duty = resolveDutyStatus(profile.staffId)
        return {
          ...profile,
          departmentName: depts.find((d) => d.id === profile.departmentId)?.name ?? '—',
          dutyStatus: duty.status,
          nextAssignment: duty.nextAssignment,
          nextShiftLabel: duty.nextShiftLabel,
        }
      })
  },

  getPublishedById(id: string): DoctorDirectoryItem | undefined {
    return this.listPublished().find((d) => d.id === id)
  },

  listOnDuty(date: string = toISODate(new Date())): DoctorDirectoryItem[] {
    const onDutyStaffIds = new Set(
      scheduleService.listPublishedPublicDoctors(date).map((a) => a.staffId),
    )
    return this.listPublished().filter((d) => onDutyStaffIds.has(d.staffId))
  },

  toggleSaved(patientId: string, doctorProfileId: string): string[] {
    let saved: string[] = []
    updateStore((store) => {
      const patient = store.patients.find((p) => p.id === patientId)
      if (!patient) return
      if (patient.savedDoctorIds.includes(doctorProfileId)) {
        patient.savedDoctorIds = patient.savedDoctorIds.filter((id) => id !== doctorProfileId)
      } else {
        patient.savedDoctorIds = [...patient.savedDoctorIds, doctorProfileId]
      }
      saved = [...patient.savedDoctorIds]
    })
    return saved
  },
}

export function dutyStatusLabel(status: DoctorDutyStatus): string {
  switch (status) {
    case 'scheduled_on_duty':
      return 'Scheduled on duty'
    case 'upcoming_duty':
      return 'Upcoming duty'
    case 'no_published_schedule':
      return 'No published schedule'
    case 'schedule_unavailable':
      return 'Schedule unavailable'
  }
}
