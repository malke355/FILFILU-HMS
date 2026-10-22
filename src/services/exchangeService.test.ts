import { beforeEach, describe, expect, it } from 'vitest'
import { resetStore } from './storage'
import { exchangeService } from './exchangeService'
import { scheduleService } from './scheduleService'
import { notificationService } from './notificationService'

describe('exchangeService approval path', () => {
  beforeEach(() => {
    resetStore()
  })

  it('runs request → accept → admin approve and reassigns duty', () => {
    const assignment = scheduleService.listForStaff('staff-nurse-1').find((a) => a.status === 'published')
    expect(assignment).toBeTruthy()

    const request = exchangeService.create({
      requesterId: 'staff-nurse-1',
      targetStaffId: 'staff-nurse-2',
      assignmentId: assignment!.id,
      reason: 'Need coverage for family appointment today.',
    })
    expect(request.status).toBe('pending')
    expect(notificationService.listForUser('staff-nurse-2').length).toBeGreaterThan(0)

    exchangeService.respond(request.id, true)
    expect(exchangeService.getById(request.id)?.status).toBe('accepted')

    exchangeService.adminDecide(request.id, true)
    expect(exchangeService.getById(request.id)?.status).toBe('approved')
    expect(scheduleService.getById(assignment!.id)?.staffId).toBe('staff-nurse-2')
  })
})
