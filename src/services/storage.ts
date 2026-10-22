import {
  SEED_VERSION,
  assignments as seedAssignments,
  departments as seedDepartments,
  doctorProfiles as seedDoctors,
  exchanges as seedExchanges,
  notifications as seedNotifications,
  patients as seedPatients,
  shiftTypes as seedShifts,
  staff as seedStaff,
} from '@/data/seed'
import type {
  Department,
  DoctorProfile,
  DutyAssignment,
  ExchangeRequest,
  Notification,
  PatientProfile,
  ShiftType,
  StaffMember,
} from '@/types'

const KEY = 'filfilu-hms-store'

export interface AppStore {
  version: string
  departments: Department[]
  shiftTypes: ShiftType[]
  staff: StaffMember[]
  doctorProfiles: DoctorProfile[]
  patients: PatientProfile[]
  assignments: DutyAssignment[]
  exchanges: ExchangeRequest[]
  notifications: Notification[]
}

function seedStore(): AppStore {
  return {
    version: SEED_VERSION,
    departments: structuredClone(seedDepartments),
    shiftTypes: structuredClone(seedShifts),
    staff: structuredClone(seedStaff),
    doctorProfiles: structuredClone(seedDoctors),
    patients: structuredClone(seedPatients),
    assignments: structuredClone(seedAssignments),
    exchanges: structuredClone(seedExchanges),
    notifications: structuredClone(seedNotifications),
  }
}

export function loadStore(): AppStore {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      const seeded = seedStore()
      localStorage.setItem(KEY, JSON.stringify(seeded))
      return seeded
    }
    const parsed = JSON.parse(raw) as AppStore
    if (parsed.version !== SEED_VERSION) {
      const seeded = seedStore()
      localStorage.setItem(KEY, JSON.stringify(seeded))
      return seeded
    }
    return parsed
  } catch {
    const seeded = seedStore()
    localStorage.setItem(KEY, JSON.stringify(seeded))
    return seeded
  }
}

export function saveStore(store: AppStore): void {
  localStorage.setItem(KEY, JSON.stringify(store))
  window.dispatchEvent(new Event('filfilu-store'))
}

export function resetStore(): AppStore {
  const seeded = seedStore()
  localStorage.setItem(KEY, JSON.stringify(seeded))
  return seeded
}

export function updateStore(mutator: (store: AppStore) => void): AppStore {
  const store = loadStore()
  mutator(store)
  saveStore(store)
  return store
}

export function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}
