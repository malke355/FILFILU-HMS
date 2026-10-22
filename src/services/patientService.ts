import type { PatientProfile } from '@/types'
import { loadStore, updateStore } from './storage'

export const patientService = {
  list(): PatientProfile[] {
    return loadStore().patients
  },

  getById(id: string): PatientProfile | undefined {
    return loadStore().patients.find((p) => p.id === id)
  },

  update(id: string, patch: Partial<Omit<PatientProfile, 'id'>>): PatientProfile | undefined {
    let updated: PatientProfile | undefined
    updateStore((store) => {
      const idx = store.patients.findIndex((p) => p.id === id)
      if (idx === -1) return
      store.patients[idx] = { ...store.patients[idx]!, ...patch }
      updated = store.patients[idx]
    })
    return updated
  },
}
