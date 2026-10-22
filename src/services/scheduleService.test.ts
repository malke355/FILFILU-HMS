import { beforeEach, describe, expect, it } from 'vitest'
import { resetStore } from './storage'
import { scheduleService } from './scheduleService'

describe('scheduleService', () => {
  beforeEach(() => {
    resetStore()
  })

  it('never returns draft assignments in public doctor listings', () => {
    const publicList = scheduleService.listPublishedPublicDoctors()
    expect(publicList.every((a) => a.status === 'published')).toBe(true)
    expect(publicList.every((a) => a.visibility === 'public')).toBe(true)
  })

  it('detects same-slot conflicts for a staff member', () => {
    const existing = scheduleService.list().find((a) => a.staffId === 'staff-doc-1')
    expect(existing).toBeTruthy()
    const warnings = scheduleService.detectConflicts({
      staffId: existing!.staffId,
      date: existing!.date,
      shiftTypeId: existing!.shiftTypeId,
    })
    expect(warnings.some((w) => w.type === 'same_shift_slot')).toBe(true)
  })

  it('publishes draft assignments', () => {
    const draft = scheduleService.list().find((a) => a.status === 'draft')
    expect(draft).toBeTruthy()
    scheduleService.setStatus(draft!.id, 'published')
    expect(scheduleService.getById(draft!.id)?.status).toBe('published')
  })
})
