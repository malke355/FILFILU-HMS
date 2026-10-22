import { toCsv } from '@/lib/csv'
import { departmentService, shiftTypeService } from './departmentService'
import { scheduleService } from './scheduleService'
import { staffService } from './staffService'
import { exchangeService } from './exchangeService'

export const reportService = {
  dutyAssignmentsCsv(): string {
    const staff = staffService.list()
    const depts = departmentService.list()
    const shifts = shiftTypeService.list()
    const rows = scheduleService.list().map((a) => {
      const member = staff.find((s) => s.id === a.staffId)
      return {
        date: a.date,
        staff: member ? `${member.firstName} ${member.lastName}` : a.staffId,
        role: member?.role ?? '',
        department: depts.find((d) => d.id === a.departmentId)?.name ?? '',
        shift: shifts.find((s) => s.id === a.shiftTypeId)?.name ?? '',
        status: a.status,
        visibility: a.visibility,
      }
    })
    return toCsv(rows)
  },

  staffRosterCsv(): string {
    const depts = departmentService.list()
    const rows = staffService.list().map((s) => ({
      employeeId: s.employeeId,
      name: `${s.firstName} ${s.lastName}`,
      role: s.role,
      department: depts.find((d) => d.id === s.departmentId)?.name ?? '',
      email: s.email,
      active: s.active,
    }))
    return toCsv(rows)
  },

  exchangesCsv(): string {
    const staff = staffService.list()
    const name = (id: string) => {
      const s = staff.find((x) => x.id === id)
      return s ? `${s.firstName} ${s.lastName}` : id
    }
    const rows = exchangeService.list().map((e) => ({
      id: e.id,
      requester: name(e.requesterId),
      target: name(e.targetStaffId),
      assignmentId: e.assignmentId,
      status: e.status,
      reason: e.reason,
      createdAt: e.createdAt,
    }))
    return toCsv(rows)
  },
}
