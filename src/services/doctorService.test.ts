import { beforeEach, describe, expect, it } from 'vitest'
import { resetStore } from './storage'
import { doctorService } from './doctorService'
import { scheduleService } from './scheduleService'

describe('doctorService directory rules', () => {
  beforeEach(() => {
    resetStore()
  })

  it('lists only published directory profiles', () => {
    const list = doctorService.listPublished()
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((d) => d.publishedInDirectory)).toBe(true)
  })

  it('excludes nurses from on-duty public list', () => {
    const onDuty = doctorService.listOnDuty()
    const nurseAssignments = scheduleService
      .listPublishedPublicDoctors()
      .filter((a) => a.staffId.startsWith('staff-nurse'))
    expect(nurseAssignments.length).toBe(0)
    expect(onDuty.every((d) => d.staffId.startsWith('staff-doc'))).toBe(true)
  })
})
