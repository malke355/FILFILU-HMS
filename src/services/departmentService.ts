import type { Department, ShiftType } from '@/types'
import { loadStore, uid, updateStore } from './storage'

export const departmentService = {
  list(): Department[] {
    return loadStore().departments
  },

  getById(id: string): Department | undefined {
    return loadStore().departments.find((d) => d.id === id)
  },

  create(input: Omit<Department, 'id'>): Department {
    const dept: Department = { ...input, id: uid('dept') }
    updateStore((store) => {
      store.departments.push(dept)
    })
    return dept
  },

  update(id: string, patch: Partial<Omit<Department, 'id'>>): Department | undefined {
    let updated: Department | undefined
    updateStore((store) => {
      const idx = store.departments.findIndex((d) => d.id === id)
      if (idx === -1) return
      store.departments[idx] = { ...store.departments[idx]!, ...patch }
      updated = store.departments[idx]
    })
    return updated
  },
}

export const shiftTypeService = {
  list(): ShiftType[] {
    return loadStore().shiftTypes
  },

  getById(id: string): ShiftType | undefined {
    return loadStore().shiftTypes.find((s) => s.id === id)
  },

  create(input: Omit<ShiftType, 'id'>): ShiftType {
    const shift: ShiftType = { ...input, id: uid('shift') }
    updateStore((store) => {
      store.shiftTypes.push(shift)
    })
    return shift
  },

  update(id: string, patch: Partial<Omit<ShiftType, 'id'>>): ShiftType | undefined {
    let updated: ShiftType | undefined
    updateStore((store) => {
      const idx = store.shiftTypes.findIndex((s) => s.id === id)
      if (idx === -1) return
      store.shiftTypes[idx] = { ...store.shiftTypes[idx]!, ...patch }
      updated = store.shiftTypes[idx]
    })
    return updated
  },
}
