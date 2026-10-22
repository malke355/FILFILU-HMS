import { rangesOverlap, shiftWindow, toISODate } from '@/lib/dates'
import type { ConflictWarning, DutyAssignment, ScheduleStatus } from '@/types'
import { departmentService, shiftTypeService } from './departmentService'
import { staffService } from './staffService'
import { loadStore, uid, updateStore } from './storage'

export type AssignmentInput = Omit<DutyAssignment, 'id' | 'createdAt' | 'updatedAt'>

function withMeta(input: AssignmentInput, id?: string): DutyAssignment {
  const now = new Date().toISOString()
  return {
    ...input,
    id: id ?? uid('asg'),
    createdAt: now,
    updatedAt: now,
  }
}

export const scheduleService = {
  list(): DutyAssignment[] {
    return loadStore().assignments
  },

  getById(id: string): DutyAssignment | undefined {
    return loadStore().assignments.find((a) => a.id === id)
  },

  listForStaff(staffId: string): DutyAssignment[] {
    return this.list().filter((a) => a.staffId === staffId)
  },

  listByDate(date: string): DutyAssignment[] {
    return this.list().filter((a) => a.date === date)
  },

  listPublishedPublicDoctors(date?: string): DutyAssignment[] {
    const staff = staffService.list()
    return this.list().filter((a) => {
      if (a.status !== 'published') return false
      if (a.visibility !== 'public') return false
      if (date && a.date !== date) return false
      const member = staff.find((s) => s.id === a.staffId)
      return member?.role === 'doctor' && member.active
    })
  },

  create(input: AssignmentInput): { assignment: DutyAssignment; warnings: ConflictWarning[] } {
    const warnings = this.detectConflicts(input)
    const assignment = withMeta(input)
    updateStore((store) => {
      store.assignments.push(assignment)
    })
    return { assignment, warnings }
  },

  update(
    id: string,
    patch: Partial<AssignmentInput>,
  ): { assignment: DutyAssignment | undefined; warnings: ConflictWarning[] } {
    const existing = this.getById(id)
    if (!existing) return { assignment: undefined, warnings: [] }
    const next = { ...existing, ...patch, updatedAt: new Date().toISOString() }
    const warnings = this.detectConflicts(next, id)
    updateStore((store) => {
      const idx = store.assignments.findIndex((a) => a.id === id)
      if (idx !== -1) store.assignments[idx] = next
    })
    return { assignment: next, warnings }
  },

  setStatus(id: string, status: ScheduleStatus): DutyAssignment | undefined {
    return this.update(id, { status }).assignment
  },

  publishMany(ids: string[]): number {
    let count = 0
    updateStore((store) => {
      for (const id of ids) {
        const idx = store.assignments.findIndex((a) => a.id === id)
        if (idx === -1) continue
        store.assignments[idx] = {
          ...store.assignments[idx]!,
          status: 'published',
          updatedAt: new Date().toISOString(),
        }
        count += 1
      }
    })
    return count
  },

  remove(id: string): void {
    updateStore((store) => {
      store.assignments = store.assignments.filter((a) => a.id !== id)
    })
  },

  detectConflicts(
    candidate: Pick<DutyAssignment, 'staffId' | 'date' | 'shiftTypeId'> & { id?: string },
    excludeId?: string,
  ): ConflictWarning[] {
    const shifts = shiftTypeService.list()
    const candidateShift = shifts.find((s) => s.id === candidate.shiftTypeId)
    if (!candidateShift) return []

    const candidateWindow = shiftWindow(
      candidate.date,
      candidateShift.startTime,
      candidateShift.endTime,
      candidateShift.overnight,
    )

    const warnings: ConflictWarning[] = []
    const others = this.list().filter(
      (a) =>
        a.staffId === candidate.staffId &&
        a.id !== excludeId &&
        a.id !== candidate.id,
    )

    for (const other of others) {
      const otherShift = shifts.find((s) => s.id === other.shiftTypeId)
      if (!otherShift) continue
      if (other.date === candidate.date && other.shiftTypeId === candidate.shiftTypeId) {
        warnings.push({
          type: 'same_shift_slot',
          message: `${staffService.getById(candidate.staffId)?.firstName ?? 'Staff'} is already assigned to ${otherShift.name} on ${candidate.date}.`,
          assignmentIds: [other.id],
          staffId: candidate.staffId,
          date: candidate.date,
        })
        continue
      }
      const otherWindow = shiftWindow(
        other.date,
        otherShift.startTime,
        otherShift.endTime,
        otherShift.overnight,
      )
      if (rangesOverlap(candidateWindow, otherWindow)) {
        warnings.push({
          type: 'overlap',
          message: `Overlaps ${otherShift.name} on ${other.date} (${otherShift.startTime}–${otherShift.endTime}${otherShift.overnight ? ' +1' : ''}).`,
          assignmentIds: [other.id],
          staffId: candidate.staffId,
          date: candidate.date,
        })
      }
    }

    return warnings
  },

  summarizeForDate(date: string = toISODate(new Date())) {
    const all = this.listByDate(date)
    return {
      date,
      total: all.length,
      published: all.filter((a) => a.status === 'published').length,
      draft: all.filter((a) => a.status === 'draft').length,
      departments: departmentService.list().map((dept) => ({
        ...dept,
        count: all.filter((a) => a.departmentId === dept.id).length,
      })),
    }
  },
}
