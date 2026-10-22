export type UserRole = 'admin' | 'doctor' | 'nurse' | 'patient'

export type ScheduleStatus = 'draft' | 'published'

export type ExchangeStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'approved'
  | 'denied'

export type DutyVisibility = 'public' | 'staff' | 'private'

export type DoctorDutyStatus =
  | 'scheduled_on_duty'
  | 'upcoming_duty'
  | 'no_published_schedule'
  | 'schedule_unavailable'

export interface Department {
  id: string
  name: string
  code: string
  description: string
  active: boolean
}

export interface ShiftType {
  id: string
  name: string
  code: string
  startTime: string
  endTime: string
  /** True when endTime is on the next calendar day */
  overnight: boolean
  color: string
  active: boolean
}

export interface StaffMember {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  role: Extract<UserRole, 'admin' | 'doctor' | 'nurse'>
  departmentId: string
  specialty?: string
  phone?: string
  active: boolean
  hireDate: string
}

export interface DoctorProfile {
  id: string
  staffId: string
  displayName: string
  specialty: string
  departmentId: string
  bio: string
  languages: string[]
  yearsExperience: number
  acceptingPatients: boolean
  /** When false, public directory hides this profile */
  publishedInDirectory: boolean
}

export interface PatientProfile {
  id: string
  firstName: string
  lastName: string
  email: string
  preferredLanguage?: string
  savedDoctorIds: string[]
}

export interface DutyAssignment {
  id: string
  staffId: string
  departmentId: string
  shiftTypeId: string
  date: string
  status: ScheduleStatus
  notes?: string
  /** Public directory visibility; nurses default private */
  visibility: DutyVisibility
  createdAt: string
  updatedAt: string
}

export interface ExchangeRequest {
  id: string
  requesterId: string
  targetStaffId: string
  assignmentId: string
  proposedAssignmentId?: string
  reason: string
  status: ExchangeStatus
  createdAt: string
  updatedAt: string
  adminNote?: string
}

export interface Notification {
  id: string
  userId: string
  title: string
  body: string
  read: boolean
  createdAt: string
  href?: string
}

export interface DemoSession {
  role: UserRole
  userId: string
  displayName: string
}

export interface ConflictWarning {
  type: 'double_booking' | 'overlap' | 'same_shift_slot'
  message: string
  assignmentIds: string[]
  staffId: string
  date: string
}
