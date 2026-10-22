import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import type { UserRole } from '@/types'

export interface NavItem {
  to: string
  label: string
  roles?: UserRole[] | 'public' | 'any'
}

export function NavLinks({
  items,
  onNavigate,
  className,
}: {
  items: NavItem[]
  onNavigate?: () => void
  className?: string
}) {
  return (
    <nav className={cn('flex flex-col gap-1', className)}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'rounded-xl px-3 py-2 text-sm font-medium text-navy-800/80 transition hover:bg-teal-50 hover:text-navy-900',
              isActive && 'bg-navy-900 text-white hover:bg-navy-800 hover:text-white',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export const publicNav: NavItem[] = [
  { to: '/', label: 'Home', roles: 'public' },
  { to: '/doctors', label: 'Find a Doctor', roles: 'public' },
  { to: '/doctors/on-duty', label: 'Doctors on Duty', roles: 'public' },
]

export const patientNav: NavItem[] = [
  { to: '/', label: 'Home' },
  { to: '/doctors', label: 'Find a Doctor' },
  { to: '/doctors/on-duty', label: 'Doctors on Duty' },
  { to: '/patient', label: 'My Dashboard' },
  { to: '/patient/saved', label: 'Saved Doctors' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/patient/profile', label: 'My Profile' },
]

export const adminNav: NavItem[] = [
  { to: '/admin', label: 'Admin Dashboard' },
  { to: '/admin/staff', label: 'Staff' },
  { to: '/admin/departments', label: 'Departments & Shifts' },
  { to: '/admin/schedule', label: 'Duty Schedule' },
  { to: '/exchanges', label: 'Shift Exchanges' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/doctors', label: 'Public Directory' },
]

export const doctorNav: NavItem[] = [
  { to: '/doctor', label: 'My Dashboard' },
  { to: '/doctor/schedule', label: 'My Schedule' },
  { to: '/exchanges', label: 'Shift Exchanges' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/doctors', label: 'Doctor Directory' },
]

export const nurseNav: NavItem[] = [
  { to: '/nurse', label: 'My Dashboard' },
  { to: '/nurse/schedule', label: 'My Schedule' },
  { to: '/exchanges', label: 'Shift Exchanges' },
  { to: '/notifications', label: 'Notifications' },
]
