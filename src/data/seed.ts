import { addDays, format, subHours } from 'date-fns'
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
const hoursAgo = (h: number) => subHours(today, h).toISOString()

export const SEED_VERSION = 'filfilu-phase1-v2'

export const departments: Department[] = [
  {
    id: 'dept-er',
    name: 'Emergency',
    code: 'ER',
    description: 'Emergency department coverage, triage, and resuscitation bays.',
    active: true,
  },
  {
    id: 'dept-im',
    name: 'Internal Medicine',
    code: 'IM',
    description: 'General internal medicine wards and outpatient clinics.',
    active: true,
  },
  {
    id: 'dept-surg',
    name: 'Surgery',
    code: 'SURG',
    description: 'General and trauma surgery teams with peri-operative coverage.',
    active: true,
  },
  {
    id: 'dept-peds',
    name: 'Pediatrics',
    code: 'PEDS',
    description: 'Pediatric inpatient, neonatal, and outpatient duty coverage.',
    active: true,
  },
  {
    id: 'dept-card',
    name: 'Cardiology',
    code: 'CARD',
    description: 'Cardiac care unit, cath lab, and cardiology consults.',
    active: true,
  },
  {
    id: 'dept-obgyn',
    name: 'Obstetrics & Gynecology',
    code: 'OBGYN',
    description: 'Labor & delivery, antenatal clinic, and gynecology theatre.',
    active: true,
  },
  {
    id: 'dept-ortho',
    name: 'Orthopedics',
    code: 'ORTHO',
    description: 'Fracture clinic, orthopedic theatre, and trauma follow-up.',
    active: true,
  },
  {
    id: 'dept-neuro',
    name: 'Neurology',
    code: 'NEURO',
    description: 'Stroke unit, neurology consults, and neurosurgery support.',
    active: true,
  },
  {
    id: 'dept-rad',
    name: 'Radiology',
    code: 'RAD',
    description: 'Imaging services including CT, MRI, and ultrasound reporting.',
    active: true,
  },
  {
    id: 'dept-derm',
    name: 'Dermatology',
    code: 'DERM',
    description: 'Outpatient dermatology clinic (temporarily paused).',
    active: false,
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
    color: '#4338CA',
    active: true,
  },
  {
    id: 'shift-day12',
    name: 'Long Day',
    code: 'LD',
    startTime: '08:00',
    endTime: '20:00',
    overnight: false,
    color: '#7C3AED',
    active: true,
  },
  {
    id: 'shift-oncall',
    name: 'On-call',
    code: 'OC',
    startTime: '20:00',
    endTime: '08:00',
    overnight: true,
    color: '#B45309',
    active: true,
  },
  {
    id: 'shift-weekend',
    name: 'Weekend Clinic',
    code: 'WK',
    startTime: '09:00',
    endTime: '13:00',
    overnight: false,
    color: '#64748B',
    active: false,
  },
]

interface DoctorSeed {
  n: number
  first: string
  last: string
  dept: string
  specialty: string
  years: number
  languages: string[]
  accepting: boolean
  published: boolean
  active?: boolean
  hireDate: string
  bio: string
}

const doctorSeeds: DoctorSeed[] = [
  {
    n: 1,
    first: 'Helen',
    last: 'Tesfaye',
    dept: 'dept-im',
    specialty: 'Internal Medicine',
    years: 8,
    languages: ['English', 'Amharic'],
    accepting: true,
    published: true,
    hireDate: '2020-06-15',
    bio: 'Focuses on adult inpatient medicine and chronic disease coordination, with a special interest in diabetes and hypertension.',
  },
  {
    n: 2,
    first: 'Daniel',
    last: 'Assefa',
    dept: 'dept-er',
    specialty: 'Emergency Medicine',
    years: 12,
    languages: ['English', 'Amharic', 'Afaan Oromo'],
    accepting: true,
    published: true,
    hireDate: '2018-11-02',
    bio: 'Leads emergency coverage and acute care pathways. Trained in trauma resuscitation and point-of-care ultrasound.',
  },
  {
    n: 3,
    first: 'Marta',
    last: 'Gebre',
    dept: 'dept-peds',
    specialty: 'Pediatrics',
    years: 6,
    languages: ['English', 'Amharic'],
    accepting: true,
    published: true,
    hireDate: '2021-01-20',
    bio: 'Pediatric ward and clinic duty coverage, including childhood asthma and nutrition follow-up.',
  },
  {
    n: 4,
    first: 'Yohannes',
    last: 'Hailu',
    dept: 'dept-surg',
    specialty: 'General Surgery',
    years: 14,
    languages: ['English', 'Amharic'],
    accepting: false,
    published: true,
    hireDate: '2017-09-12',
    bio: 'Senior general surgeon covering elective lists, surgical on-call, and peri-operative care.',
  },
  {
    n: 5,
    first: 'Bethlehem',
    last: 'Alemu',
    dept: 'dept-card',
    specialty: 'Cardiology',
    years: 10,
    languages: ['English', 'Amharic', 'French'],
    accepting: true,
    published: true,
    hireDate: '2019-02-11',
    bio: 'Runs the heart failure clinic and cardiac care unit rounds. Interested in echocardiography.',
  },
  {
    n: 6,
    first: 'Abel',
    last: 'Girma',
    dept: 'dept-card',
    specialty: 'Interventional Cardiology',
    years: 9,
    languages: ['English', 'Amharic'],
    accepting: true,
    published: true,
    hireDate: '2020-03-23',
    bio: 'Performs coronary angiography and stenting in the cath lab, and covers chest-pain on-call.',
  },
  {
    n: 7,
    first: 'Tsion',
    last: 'Worku',
    dept: 'dept-obgyn',
    specialty: 'Obstetrics & Gynecology',
    years: 11,
    languages: ['English', 'Amharic', 'Tigrinya'],
    accepting: true,
    published: true,
    hireDate: '2018-05-07',
    bio: 'Covers labor & delivery and the antenatal clinic, with a focus on safe motherhood.',
  },
  {
    n: 8,
    first: 'Kidus',
    last: 'Tadesse',
    dept: 'dept-ortho',
    specialty: 'Orthopedic Surgery',
    years: 7,
    languages: ['English', 'Amharic'],
    accepting: true,
    published: true,
    hireDate: '2021-07-19',
    bio: 'Fracture clinic lead and orthopedic theatre surgeon, specializing in sports injuries.',
  },
  {
    n: 9,
    first: 'Hanna',
    last: 'Desta',
    dept: 'dept-neuro',
    specialty: 'Neurology',
    years: 13,
    languages: ['English', 'Amharic', 'Italian'],
    accepting: true,
    published: true,
    hireDate: '2016-10-03',
    bio: 'Stroke unit consultant and epilepsy clinic lead. Coordinates neurology consults hospital-wide.',
  },
  {
    n: 10,
    first: 'Mikias',
    last: 'Fikre',
    dept: 'dept-rad',
    specialty: 'Radiology',
    years: 5,
    languages: ['English', 'Amharic'],
    accepting: false,
    published: true,
    hireDate: '2022-01-10',
    bio: 'Reports CT, MRI, and ultrasound studies and supports emergency imaging.',
  },
  {
    n: 11,
    first: 'Saron',
    last: 'Lemma',
    dept: 'dept-er',
    specialty: 'Emergency Medicine',
    years: 4,
    languages: ['English', 'Amharic', 'Somali'],
    accepting: true,
    published: true,
    hireDate: '2023-03-01',
    bio: 'Emergency physician covering triage and resuscitation bays, with an interest in toxicology.',
  },
  {
    n: 12,
    first: 'Nahom',
    last: 'Berhanu',
    dept: 'dept-im',
    specialty: 'Endocrinology',
    years: 9,
    languages: ['English', 'Amharic'],
    accepting: true,
    published: true,
    hireDate: '2019-08-26',
    bio: 'Endocrinology consults and thyroid clinic, alongside general medicine ward cover.',
  },
  {
    n: 13,
    first: 'Meron',
    last: 'Yilma',
    dept: 'dept-peds',
    specialty: 'Neonatology',
    years: 8,
    languages: ['English', 'Amharic'],
    accepting: true,
    published: true,
    hireDate: '2020-11-16',
    bio: 'Neonatal intensive care cover and high-risk newborn follow-up clinic.',
  },
  {
    n: 14,
    first: 'Ermias',
    last: 'Kassa',
    dept: 'dept-surg',
    specialty: 'Trauma Surgery',
    years: 10,
    languages: ['English', 'Amharic', 'Afaan Oromo'],
    accepting: true,
    published: true,
    hireDate: '2019-04-29',
    bio: 'Trauma surgery and emergency laparotomy cover; teaches the surgical skills course.',
  },
  {
    n: 15,
    first: 'Eden',
    last: 'Mekonnen',
    dept: 'dept-obgyn',
    specialty: 'Maternal-Fetal Medicine',
    years: 12,
    languages: ['English', 'Amharic'],
    accepting: true,
    published: true,
    hireDate: '2017-12-04',
    bio: 'High-risk pregnancy specialist covering fetal ultrasound and maternal medicine clinic.',
  },
  {
    n: 16,
    first: 'Robel',
    last: 'Haile',
    dept: 'dept-neuro',
    specialty: 'Neurosurgery',
    years: 3,
    languages: ['English', 'Amharic'],
    accepting: false,
    published: false,
    hireDate: '2024-09-02',
    bio: 'Newly joined neurosurgeon. Directory profile pending review.',
  },
  {
    n: 17,
    first: 'Selamawit',
    last: 'Getachew',
    dept: 'dept-derm',
    specialty: 'Dermatology',
    years: 15,
    languages: ['English', 'Amharic'],
    accepting: false,
    published: false,
    active: false,
    hireDate: '2014-06-30',
    bio: 'Dermatology consultant on extended leave while the clinic is paused.',
  },
]

interface NurseSeed {
  n: number
  first: string
  last: string
  dept: string
  hireDate: string
  active?: boolean
}

const nurseSeeds: NurseSeed[] = [
  { n: 1, first: 'Rahel', last: 'Abebe', dept: 'dept-er', hireDate: '2022-04-08' },
  { n: 2, first: 'Samuel', last: 'Kebede', dept: 'dept-im', hireDate: '2021-08-30' },
  { n: 3, first: 'Lidya', last: 'Mulugeta', dept: 'dept-peds', hireDate: '2023-02-14' },
  { n: 4, first: 'Hiwot', last: 'Tsegaye', dept: 'dept-im', hireDate: '2020-10-05' },
  { n: 5, first: 'Dawit', last: 'Negash', dept: 'dept-surg', hireDate: '2019-07-22' },
  { n: 6, first: 'Mahlet', last: 'Asfaw', dept: 'dept-peds', hireDate: '2022-12-12' },
  { n: 7, first: 'Biruk', last: 'Shiferaw', dept: 'dept-er', hireDate: '2021-05-17' },
  { n: 8, first: 'Feven', last: 'Ayele', dept: 'dept-card', hireDate: '2023-06-26' },
  { n: 9, first: 'Yonas', last: 'Demissie', dept: 'dept-neuro', hireDate: '2020-02-03' },
  { n: 10, first: 'Bezawit', last: 'Tilahun', dept: 'dept-obgyn', hireDate: '2021-11-08' },
  { n: 11, first: 'Kalkidan', last: 'Wolde', dept: 'dept-ortho', hireDate: '2018-09-24' },
  { n: 12, first: 'Abenezer', last: 'Gizaw', dept: 'dept-im', hireDate: '2019-03-18', active: false },
]

const slug = (first: string, last: string) => `${first}.${last}`.toLowerCase()

export const staff: StaffMember[] = [
  {
    id: 'staff-admin',
    employeeId: 'A-001',
    firstName: 'Selam',
    lastName: 'Bekele',
    email: 'admin@filfilu.demo',
    role: 'admin',
    departmentId: 'dept-im',
    phone: '+251 11 000 0001',
    active: true,
    hireDate: '2019-03-01',
  },
  {
    id: 'staff-admin-2',
    employeeId: 'A-002',
    firstName: 'Tewodros',
    lastName: 'Mengistu',
    email: 'tewodros.mengistu@filfilu.demo',
    role: 'admin',
    departmentId: 'dept-er',
    phone: '+251 11 000 0002',
    active: true,
    hireDate: '2021-09-13',
  },
  ...doctorSeeds.map(
    (doc): StaffMember => ({
      id: `staff-doc-${doc.n}`,
      employeeId: `D-${100 + doc.n}`,
      firstName: doc.first,
      lastName: doc.last,
      email: `${slug(doc.first, doc.last)}@filfilu.demo`,
      role: 'doctor',
      departmentId: doc.dept,
      specialty: doc.specialty,
      phone: `+251 91 ${String(100000 + doc.n * 7919).slice(-6)}`,
      active: doc.active ?? true,
      hireDate: doc.hireDate,
    }),
  ),
  ...nurseSeeds.map(
    (nurse): StaffMember => ({
      id: `staff-nurse-${nurse.n}`,
      employeeId: `N-${200 + nurse.n}`,
      firstName: nurse.first,
      lastName: nurse.last,
      email: `${slug(nurse.first, nurse.last)}@filfilu.demo`,
      role: 'nurse',
      departmentId: nurse.dept,
      phone: `+251 92 ${String(100000 + nurse.n * 6007).slice(-6)}`,
      active: nurse.active ?? true,
      hireDate: nurse.hireDate,
    }),
  ),
]

export const doctorProfiles: DoctorProfile[] = doctorSeeds.map((doc) => ({
  id: `doc-prof-${doc.n}`,
  staffId: `staff-doc-${doc.n}`,
  displayName: `Dr. ${doc.first} ${doc.last}`,
  specialty: doc.specialty,
  departmentId: doc.dept,
  bio: doc.bio,
  languages: doc.languages,
  yearsExperience: doc.years,
  acceptingPatients: doc.accepting,
  publishedInDirectory: doc.published,
}))

export const patients: PatientProfile[] = [
  {
    id: 'patient-1',
    firstName: 'Amina',
    lastName: 'Mohammed',
    email: 'amina@filfilu.demo',
    preferredLanguage: 'English',
    savedDoctorIds: ['doc-prof-1', 'doc-prof-3', 'doc-prof-5', 'doc-prof-9'],
  },
  {
    id: 'patient-2',
    firstName: 'Yared',
    lastName: 'Solomon',
    email: 'yared.solomon@filfilu.demo',
    preferredLanguage: 'Amharic',
    savedDoctorIds: ['doc-prof-2', 'doc-prof-8'],
  },
  {
    id: 'patient-3',
    firstName: 'Ruth',
    lastName: 'Alemayehu',
    email: 'ruth.alemayehu@filfilu.demo',
    preferredLanguage: 'English',
    savedDoctorIds: ['doc-prof-7', 'doc-prof-15'],
  },
  {
    id: 'patient-4',
    firstName: 'Abdi',
    lastName: 'Hussein',
    email: 'abdi.hussein@filfilu.demo',
    preferredLanguage: 'Afaan Oromo',
    savedDoctorIds: [],
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
  notes?: string,
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
    notes,
    createdAt: now,
    updatedAt: now,
  }
}

const FIRST_DAY = -14
const LAST_DAY = 13
const PUBLISHED_THROUGH = 6

function doctorShiftPool(dept: string): string[] {
  switch (dept) {
    case 'dept-er':
      return ['shift-morning', 'shift-evening', 'shift-night']
    case 'dept-surg':
    case 'dept-ortho':
    case 'dept-neuro':
      return ['shift-morning', 'shift-day12', 'shift-oncall']
    case 'dept-obgyn':
    case 'dept-card':
      return ['shift-day12', 'shift-evening', 'shift-oncall']
    default:
      return ['shift-morning', 'shift-evening', 'shift-day12']
  }
}

const nurseShiftPool = ['shift-morning', 'shift-evening', 'shift-night']

const shiftNotes: Record<string, string> = {
  'shift-oncall': 'Reachable by pager; on site within 30 minutes.',
  'shift-night': 'Hand over at 07:00 in the ward station.',
}

/**
 * Deterministic rotation: each person works 5 of every 7 days (staggered so
 * days off differ), and keeps the same shift for a whole week. Shifts up to
 * PUBLISHED_THROUGH days ahead are published; later weeks stay draft.
 */
function generateAssignments(): DutyAssignment[] {
  const result: DutyAssignment[] = []
  let seq = 1
  const rotation: { staffId: string; dept: string; pool: string[]; nurse: boolean }[] = [
    ...doctorSeeds
      .filter((doc) => doc.active !== false)
      .map((doc) => ({
        staffId: `staff-doc-${doc.n}`,
        dept: doc.dept,
        pool: doctorShiftPool(doc.dept),
        nurse: false,
      })),
    ...nurseSeeds
      .filter((nurse) => nurse.active !== false)
      .map((nurse) => ({
        staffId: `staff-nurse-${nurse.n}`,
        dept: nurse.dept,
        pool: nurseShiftPool,
        nurse: true,
      })),
  ]

  rotation.forEach((person, index) => {
    const stagger = (index * 3) % 7
    for (let day = FIRST_DAY; day <= LAST_DAY; day++) {
      const cycle = (((day + stagger) % 7) + 7) % 7
      if (cycle >= 5) continue
      const week = Math.floor((day - FIRST_DAY) / 7)
      const shiftTypeId = person.pool[(index + week) % person.pool.length]!
      const status = day <= PUBLISHED_THROUGH ? 'published' : 'draft'
      const visibility = person.nurse
        ? 'private'
        : shiftTypeId === 'shift-oncall'
          ? 'staff'
          : 'public'
      result.push(
        duty(
          `asg-${seq++}`,
          person.staffId,
          person.dept,
          shiftTypeId,
          day,
          status,
          visibility,
          shiftNotes[shiftTypeId],
        ),
      )
    }
  })

  return result
}

export const assignments: DutyAssignment[] = generateAssignments()

/** Finds a requester's shift in [minDay, maxDay] on a date the target is free. */
function swappable(requesterId: string, targetId: string, minDay: number, maxDay: number) {
  const targetDates = new Set(assignments.filter((a) => a.staffId === targetId).map((a) => a.date))
  const window = new Set(Array.from({ length: maxDay - minDay + 1 }, (_, i) => d(minDay + i)))
  const match = assignments.find(
    (a) =>
      a.staffId === requesterId &&
      a.status === 'published' &&
      window.has(a.date) &&
      !targetDates.has(a.date),
  )
  if (!match) throw new Error(`No swappable seed shift for ${requesterId} → ${targetId}`)
  return match
}

function exchange(
  id: string,
  requesterId: string,
  targetStaffId: string,
  window: [number, number],
  reason: string,
  status: ExchangeRequest['status'],
  createdHoursAgo: number,
  adminNote?: string,
): ExchangeRequest {
  const assignment = swappable(requesterId, targetStaffId, window[0], window[1])
  if (status === 'approved') assignment.staffId = targetStaffId
  return {
    id,
    requesterId,
    targetStaffId,
    assignmentId: assignment.id,
    reason,
    status,
    adminNote,
    createdAt: hoursAgo(createdHoursAgo),
    updatedAt: hoursAgo(Math.max(0, createdHoursAgo - 6)),
  }
}

export const exchanges: ExchangeRequest[] = [
  exchange(
    'ex-1',
    'staff-nurse-1',
    'staff-nurse-7',
    [1, 6],
    'Family commitment — requesting cover for this shift.',
    'pending',
    3,
  ),
  exchange(
    'ex-2',
    'staff-doc-2',
    'staff-doc-11',
    [2, 6],
    'Presenting at the regional emergency medicine conference.',
    'accepted',
    20,
  ),
  exchange(
    'ex-3',
    'staff-doc-5',
    'staff-doc-6',
    [1, 6],
    'Echo training course in the morning — happy to swap for any evening.',
    'pending',
    8,
  ),
  exchange(
    'ex-4',
    'staff-doc-3',
    'staff-doc-13',
    [-6, -1],
    'Child’s school event; Dr. Meron kindly offered to cover.',
    'approved',
    140,
    'Approved — pediatric cover confirmed.',
  ),
  exchange(
    'ex-5',
    'staff-nurse-2',
    'staff-nurse-4',
    [1, 6],
    'Medical appointment that cannot be rescheduled.',
    'rejected',
    30,
  ),
  exchange(
    'ex-6',
    'staff-doc-4',
    'staff-doc-14',
    [2, 6],
    'Would like to attend a family wedding out of town.',
    'denied',
    52,
    'Denied — insufficient senior surgical cover that day.',
  ),
  exchange(
    'ex-7',
    'staff-nurse-3',
    'staff-nurse-6',
    [1, 6],
    'Swap no longer needed — plans changed.',
    'cancelled',
    70,
  ),
  exchange(
    'ex-8',
    'staff-doc-1',
    'staff-doc-12',
    [1, 6],
    'Teaching session for medical interns overlaps with this shift.',
    'pending',
    5,
  ),
  exchange(
    'ex-9',
    'staff-nurse-9',
    'staff-nurse-8',
    [-10, -2],
    'Covered a colleague’s family emergency.',
    'approved',
    220,
    'Approved — thank you both.',
  ),
]

const notificationSeeds: Omit<Notification, 'id'>[] = [
  // Admin
  {
    userId: 'staff-admin',
    title: 'Exchange ready for approval',
    body: 'Dr. Daniel Assefa ↔ Dr. Saron Lemma swap was accepted and needs your decision.',
    read: false,
    createdAt: hoursAgo(1),
    href: '/exchanges',
  },
  {
    userId: 'staff-admin',
    title: 'New exchange pending',
    body: 'Rahel Abebe requested cover from Biruk Shiferaw (Emergency).',
    read: false,
    createdAt: hoursAgo(3),
    href: '/exchanges',
  },
  {
    userId: 'staff-admin',
    title: 'Next week still in draft',
    body: 'Duty schedules from next week onward are drafts. Review and publish when ready.',
    read: false,
    createdAt: hoursAgo(6),
    href: '/admin/schedule',
  },
  {
    userId: 'staff-admin',
    title: 'New staff profile',
    body: 'Dr. Robel Haile (Neurosurgery) was added. Directory profile is unpublished.',
    read: true,
    createdAt: hoursAgo(26),
    href: '/admin/staff',
  },
  {
    userId: 'staff-admin',
    title: 'Monthly report available',
    body: 'Last month’s coverage report is ready to export as CSV.',
    read: true,
    createdAt: hoursAgo(72),
    href: '/admin/reports',
  },
  // Doctor (default demo doctor)
  {
    userId: 'staff-doc-1',
    title: 'Schedule published',
    body: 'Your duties for this week were published. Check your schedule for details.',
    read: false,
    createdAt: hoursAgo(2),
    href: '/doctor/schedule',
  },
  {
    userId: 'staff-doc-1',
    title: 'Exchange request sent',
    body: 'Your swap request to Dr. Nahom Berhanu is waiting for a response.',
    read: false,
    createdAt: hoursAgo(5),
    href: '/exchanges',
  },
  {
    userId: 'staff-doc-1',
    title: 'Ward round reminder',
    body: 'Internal Medicine grand round tomorrow at 08:00 in Conference Room B.',
    read: true,
    createdAt: hoursAgo(28),
  },
  {
    userId: 'staff-doc-12',
    title: 'Shift exchange request',
    body: 'Dr. Helen Tesfaye asked you to cover one of her shifts.',
    read: false,
    createdAt: hoursAgo(5),
    href: '/exchanges',
  },
  {
    userId: 'staff-doc-6',
    title: 'Shift exchange request',
    body: 'Dr. Bethlehem Alemu asked to swap a shift with you.',
    read: false,
    createdAt: hoursAgo(8),
    href: '/exchanges',
  },
  {
    userId: 'staff-doc-2',
    title: 'Exchange accepted',
    body: 'Dr. Saron Lemma accepted your request. Waiting for admin approval.',
    read: false,
    createdAt: hoursAgo(14),
    href: '/exchanges',
  },
  {
    userId: 'staff-doc-4',
    title: 'Exchange denied',
    body: 'Admin denied the exchange: insufficient senior surgical cover that day.',
    read: true,
    createdAt: hoursAgo(46),
    href: '/exchanges',
  },
  // Nurse (default demo nurse)
  {
    userId: 'staff-nurse-1',
    title: 'Exchange request sent',
    body: 'Your request to Biruk Shiferaw is pending.',
    read: false,
    createdAt: hoursAgo(3),
    href: '/exchanges',
  },
  {
    userId: 'staff-nurse-1',
    title: 'Schedule published',
    body: 'Emergency nursing duties for this week are now published.',
    read: false,
    createdAt: hoursAgo(9),
    href: '/nurse/schedule',
  },
  {
    userId: 'staff-nurse-1',
    title: 'Training reminder',
    body: 'BLS refresher training on Friday at 14:00 in the Skills Lab.',
    read: true,
    createdAt: hoursAgo(50),
  },
  {
    userId: 'staff-nurse-7',
    title: 'Shift exchange request',
    body: 'Rahel Abebe asked you to cover one of her shifts.',
    read: false,
    createdAt: hoursAgo(3),
    href: '/exchanges',
  },
  {
    userId: 'staff-nurse-2',
    title: 'Exchange declined',
    body: 'Hiwot Tsegaye declined your shift exchange request.',
    read: true,
    createdAt: hoursAgo(24),
    href: '/exchanges',
  },
  // Patient (default demo patient)
  {
    userId: 'patient-1',
    title: 'Saved doctor on duty',
    body: 'Dr. Helen Tesfaye has a published duty this week.',
    read: false,
    createdAt: hoursAgo(1),
    href: '/doctors/on-duty',
  },
  {
    userId: 'patient-1',
    title: 'Saved doctor on duty',
    body: 'Dr. Bethlehem Alemu (Cardiology) has upcoming published duties.',
    read: false,
    createdAt: hoursAgo(10),
    href: '/doctors/on-duty',
  },
  {
    userId: 'patient-1',
    title: 'New doctor in directory',
    body: 'Dr. Eden Mekonnen (Maternal-Fetal Medicine) is now listed in the directory.',
    read: true,
    createdAt: hoursAgo(40),
    href: '/doctors',
  },
  {
    userId: 'patient-1',
    title: 'Welcome to Filfilu',
    body: 'Save doctors to get updates when their duties are published.',
    read: true,
    createdAt: hoursAgo(160),
    href: '/patient/saved',
  },
  {
    userId: 'patient-2',
    title: 'Saved doctor on duty',
    body: 'Dr. Daniel Assefa has a published Emergency duty this week.',
    read: false,
    createdAt: hoursAgo(4),
    href: '/doctors/on-duty',
  },
]

export const notifications: Notification[] = notificationSeeds.map((n, i) => ({
  id: `ntf-${i + 1}`,
  ...n,
}))
