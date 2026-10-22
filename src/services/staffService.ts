import type { StaffMember } from '@/types'
import { loadStore, uid, updateStore } from './storage'

export const staffService = {
  list(): StaffMember[] {
    return loadStore().staff
  },

  getById(id: string): StaffMember | undefined {
    return loadStore().staff.find((s) => s.id === id)
  },

  create(input: Omit<StaffMember, 'id'>): StaffMember {
    const member: StaffMember = { ...input, id: uid('staff') }
    updateStore((store) => {
      store.staff.push(member)
    })
    return member
  },

  update(id: string, patch: Partial<Omit<StaffMember, 'id'>>): StaffMember | undefined {
    let updated: StaffMember | undefined
    updateStore((store) => {
      const idx = store.staff.findIndex((s) => s.id === id)
      if (idx === -1) return
      store.staff[idx] = { ...store.staff[idx]!, ...patch }
      updated = store.staff[idx]
    })
    return updated
  },

  deactivate(id: string): void {
    this.update(id, { active: false })
  },
}
