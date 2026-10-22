import type { ExchangeRequest, ExchangeStatus } from '@/types'
import { notificationService } from './notificationService'
import { scheduleService } from './scheduleService'
import { staffService } from './staffService'
import { loadStore, uid, updateStore } from './storage'

export const exchangeService = {
  list(): ExchangeRequest[] {
    return loadStore().exchanges
  },

  getById(id: string): ExchangeRequest | undefined {
    return this.list().find((e) => e.id === id)
  },

  listForUser(userId: string): ExchangeRequest[] {
    return this.list().filter(
      (e) => e.requesterId === userId || e.targetStaffId === userId,
    )
  },

  create(input: {
    requesterId: string
    targetStaffId: string
    assignmentId: string
    proposedAssignmentId?: string
    reason: string
  }): ExchangeRequest {
    const request: ExchangeRequest = {
      id: uid('ex'),
      ...input,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    updateStore((store) => {
      store.exchanges.push(request)
    })
    const requester = staffService.getById(input.requesterId)
    notificationService.create({
      userId: input.targetStaffId,
      title: 'Shift exchange request',
      body: `${requester?.firstName ?? 'A colleague'} ${requester?.lastName ?? ''} requested a shift exchange.`,
      href: '/exchanges',
    })
    notificationService.create({
      userId: 'staff-admin',
      title: 'New exchange pending',
      body: 'A shift exchange request was submitted and needs review after peer response.',
      href: '/exchanges',
    })
    return request
  },

  respond(id: string, accept: boolean): ExchangeRequest | undefined {
    const nextStatus: ExchangeStatus = accept ? 'accepted' : 'rejected'
    let updated: ExchangeRequest | undefined
    updateStore((store) => {
      const idx = store.exchanges.findIndex((e) => e.id === id)
      if (idx === -1) return
      store.exchanges[idx] = {
        ...store.exchanges[idx]!,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      }
      updated = store.exchanges[idx]
    })
    if (updated) {
      notificationService.create({
        userId: updated.requesterId,
        title: accept ? 'Exchange accepted' : 'Exchange declined',
        body: accept
          ? 'Your peer accepted the request. Waiting for admin approval.'
          : 'Your peer declined the shift exchange request.',
        href: '/exchanges',
      })
      if (accept) {
        notificationService.create({
          userId: 'staff-admin',
          title: 'Exchange ready for approval',
          body: 'A peer-accepted exchange is waiting for admin decision.',
          href: '/exchanges',
        })
      }
    }
    return updated
  },

  adminDecide(id: string, approve: boolean, adminNote?: string): ExchangeRequest | undefined {
    let updated: ExchangeRequest | undefined
    updateStore((store) => {
      const idx = store.exchanges.findIndex((e) => e.id === id)
      if (idx === -1) return
      const current = store.exchanges[idx]!
      if (current.status !== 'accepted' && current.status !== 'pending') return
      store.exchanges[idx] = {
        ...current,
        status: approve ? 'approved' : 'denied',
        adminNote,
        updatedAt: new Date().toISOString(),
      }
      updated = store.exchanges[idx]
    })

    if (updated && approve) {
      const assignment = scheduleService.getById(updated.assignmentId)
      if (assignment) {
        scheduleService.update(assignment.id, { staffId: updated.targetStaffId })
      }
    }

    if (updated) {
      for (const userId of [updated.requesterId, updated.targetStaffId]) {
        notificationService.create({
          userId,
          title: approve ? 'Exchange approved' : 'Exchange denied',
          body: approve
            ? 'Admin approved the shift exchange. Schedules were updated (demo).'
            : `Admin denied the exchange${adminNote ? `: ${adminNote}` : '.'}`,
          href: '/exchanges',
        })
      }
    }
    return updated
  },

  cancel(id: string): ExchangeRequest | undefined {
    let updated: ExchangeRequest | undefined
    updateStore((store) => {
      const idx = store.exchanges.findIndex((e) => e.id === id)
      if (idx === -1) return
      store.exchanges[idx] = {
        ...store.exchanges[idx]!,
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
      }
      updated = store.exchanges[idx]
    })
    return updated
  },
}
