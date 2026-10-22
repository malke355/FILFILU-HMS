import { addDays, format } from 'date-fns'
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

const today = new Date()
const d = (offset: number) => format(addDays(today, offset), 'yyyy-MM-dd')

export const SEED_VERSION = 'filfilu-phase1-v1'

export const departments: Department[] = [
  {
    id: 'dept-er',
    name: 'Emergency',
    code: 'ER',
    description: 'Emergency department coverage and triage support.',
    active: true,
  },
  {
    id: 'dept-im',
    name: 'Internal Medicine',
    code: 'IM',
    description: 'General internal medicine wards and clinics.',
    active: true,
  },
  {
    id: 'dept-surg',
    name: 'Surgery',
    code: 'SURG',
    description: 'Surgical teams and peri-operative coverage.',
    active: true,
  },
  {
    id: 'dept-peds',
    name: 'Pediatrics',
    code: 'PEDS',
    description: 'Pediatric inpatient and outpatient duty coverage.',
    active: true,
  },
]

export const shiftTypes: ShiftType[] = [
  {
    id: 'shift-morning',
    name: 'Morning',
    code: 'AM',
    startTime: '07:00',
    endTime: '15:00',
    overnight: false,
    color: '#0D9488',
    active: true,
  },
  {
    id: 'shift-evening',
    name: 'Evening',
    code: 'PM',
    startTime: '15:00',
    endTime: '23:00',
    overnight: false,
    color: '#0369A1',
    active: true,
  },
  {
    id: 'shift-night',
    name: 'Night',
    code: 'NOC',
    startTime: '23:00',
    endTime: '07:00',
    overnight: true,
    color: '#0B1F3A',
    active: true,
  },
]

export const staff: StaffMember[] = [
  {
    id: 'staff-admin',
    employeeId: 'A-001',
    firstName: 'Selam',
    lastName: 'Bekele',
    email: 'admin@filfilu.demo',
    role: 'admin',
    departmentId: 'dept-im',
    active: true,
    hireDate: '2019-03-01',
  },
  {
    id: 'staff-doc-1',
    employeeId: 'D-101',
    firstName: 'Helen',
    lastName: 'Tesfaye',
    email: 'helen.tesfaye@filfilu.demo',
    role: 'doctor',
    departmentId: 'dept-im',
    specialty: 'Internal Medicine',
    phone: 'Demo only',
    active: true,
    hireDate: '2020-06-15',
  },
  {
    id: 'staff-doc-2',
    employeeId: 'D-102',
    firstName: 'Daniel',
    lastName: 'Assefa',
    email: 'daniel.assefa@filfilu.demo',
    role: 'doctor',
    departmentId: 'dept-er',
    specialty: 'Emergency Medicine',
    active: true,
    hireDate: '2018-11-02',
  },
  {
    id: 'staff-doc-3',
    employeeId: 'D-103',
    firstName: 'Marta',
    lastName: 'Gebre',
    email: 'marta.gebre@filfilu.demo',
    role: 'doctor',
    departmentId: 'dept-peds',
    specialty: 'Pediatrics',
    active: true,
    hireDate: '2021-01-20',
  },
  {
    id: 'staff-doc-4',
    employeeId: 'D-104',
    firstName: 'Yohannes',
    lastName: 'Hailu',
    email: 'yohannes.hailu@filfilu.demo',
    role: 'doctor',
    departmentId: 'dept-surg',
    specialty: 'General Surgery',
    active: true,
    hireDate: '2017-09-12',
  },
  {
    id: 'staff-nurse-1',
    employeeId: 'N-201',
    firstName: 'Rahel',
    lastName: 'Abebe',
    email: 'rahel.abebe@filfilu.demo',
    role: 'nurse',
    departmentId: 'dept-er',
    active: true,
    hireDate: '2022-04-08',
  },
  {
    id: 'staff-nurse-2',
    employeeId: 'N-202',
    firstName: 'Samuel',
    lastName: 'Kebede',
    email: 'samuel.kebede@filfilu.demo',
    role: 'nurse',
    departmentId: 'dept-im',
    active: true,
    hireDate: '2021-08-30',
  },
  {
    id: 'staff-nurse-3',
    employeeId: 'N-203',
    firstName: 'Lidya',
    lastName: 'Mulugeta',
    email: 'lidya.mulugeta@filfilu.demo',
    role: 'nurse',
    departmentId: 'dept-peds',
    active: true,
    hireDate: '2023-02-14',
  },
]

export const doctorProfiles: DoctorProfile[] = [
  {
    id: 'doc-prof-1',
    staffId: 'staff-doc-1',
    displayName: 'Dr. Helen Tesfaye',
    specialty: 'Internal Medicine',
    departmentId: 'dept-im',
    bio: 'Focuses on adult inpatient medicine and chronic disease coordination. Demonstration profile only.',
    languages: ['English', 'Amharic'],
    yearsExperience: 8,
    acceptingPatients: true,
    publishedInDirectory: true,
  },
  {
    id: 'doc-prof-2',
    staffId: 'staff-doc-2',
    displayName: 'Dr. Daniel Assefa',
    specialty: 'Emergency Medicine',
    departmentId: 'dept-er',
    bio: 'Emergency coverage and acute care pathways. Demonstration profile only.',
    languages: ['English', 'Amharic', 'Oromo'],
    yearsExperience: 12,
    acceptingPatients: true,
    publishedInDirectory: true,
  },
  {
    id: 'doc-prof-3',
    staffId: 'staff-doc-3',
    displayName: 'Dr. Marta Gebre',
    specialty: 'Pediatrics',
    departmentId: 'dept-peds',
    bio: 'Pediatric ward and clinic duty coverage. Demonstration profile only.',
    languages: ['English', 'Amharic'],
    yearsExperience: 6,
    acceptingPatients: true,
    publishedInDirectory: true,
  },
  {
    id: 'doc-prof-4',
    staffId: 'staff-doc-4',
    displayName: 'Dr. Yohannes Hailu',
    specialty: 'General Surgery',
    departmentId: 'dept-surg',
    bio: 'Surgical on-call and peri-operative duty. Demonstration profile only.',
    languages: ['English', 'Amharic'],
    yearsExperience: 14,
    acceptingPatients: false,
    publishedInDirectory: true,
  },
]

export const patients: PatientProfile[] = [
  {
    id: 'patient-1',
    firstName: 'Amina',
    lastName: 'Mohammed',
    email: 'amina@filfilu.demo',
    preferredLanguage: 'English',
    savedDoctorIds: ['doc-prof-1', 'doc-prof-3'],
  },
]

function duty(
  id: string,
  staffId: string,
  departmentId: string,
  shiftTypeId: string,
  dateOffset: number,
  status: DutyAssignment['status'],
  visibility: DutyAssignment['visibility'] = 'public',
): DutyAssignment {
  const now = new Date().toISOString()
  return {
    id,
    staffId,
    departmentId,
    shiftTypeId,
    date: d(dateOffset),
    status,
    visibility,
    createdAt: now,
    updatedAt: now,
  }
}

export const assignments: DutyAssignment[] = [
  duty('asg-1', 'staff-doc-1', 'dept-im', 'shift-morning', 0, 'published', 'public'),
  duty('asg-2', 'staff-doc-2', 'dept-er', 'shift-evening', 0, 'published', 'public'),
  duty('asg-3', 'staff-doc-3', 'dept-peds', 'shift-morning', 1, 'published', 'public'),
  duty('asg-4', 'staff-doc-4', 'dept-surg', 'shift-night', 1, 'published', 'public'),
  duty('asg-5', 'staff-nurse-1', 'dept-er', 'shift-night', 0, 'published', 'private'),
  duty('asg-6', 'staff-nurse-2', 'dept-im', 'shift-morning', 0, 'published', 'private'),
  duty('asg-7', 'staff-doc-1', 'dept-im', 'shift-evening', 2, 'published', 'public'),
  duty('asg-8', 'staff-doc-2', 'dept-er', 'shift-morning', 3, 'draft', 'public'),
  duty('asg-9', 'staff-doc-3', 'dept-peds', 'shift-evening', 4, 'draft', 'staff'),
  duty('asg-10', 'staff-nurse-3', 'dept-peds', 'shift-morning', 1, 'published', 'private'),
  duty('asg-11', 'staff-doc-4', 'dept-surg', 'shift-morning', 5, 'published', 'public'),
  duty('asg-12', 'staff-nurse-1', 'dept-er', 'shift-evening', 2, 'draft', 'private'),
]

export const exchanges: ExchangeRequest[] = [
  {
    id: 'ex-1',
    requesterId: 'staff-nurse-1',
    targetStaffId: 'staff-nurse-2',
    assignmentId: 'asg-5',
    reason: 'Family commitment — requesting cover for tonight.',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export const notifications: Notification[] = [
  {
    id: 'ntf-1',
    userId: 'staff-nurse-2',
    title: 'Shift exchange request',
    body: 'Rahel Abebe asked you to cover a Night shift.',
    read: false,
    createdAt: new Date().toISOString(),
    href: '/exchanges',
  },
  {
    id: 'ntf-2',
    userId: 'patient-1',
    title: 'Saved doctor on duty',
    body: 'Dr. Helen Tesfaye is scheduled on duty today (demonstration data).',
    read: false,
    createdAt: new Date().toISOString(),
    href: '/doctors/on-duty',
  },
  {
    id: 'ntf-3',
    userId: 'staff-admin',
    title: 'Pending exchange',
    body: 'One shift exchange is awaiting review.',
    read: true,
    createdAt: new Date().toISOString(),
    href: '/exchanges',
  },
]
