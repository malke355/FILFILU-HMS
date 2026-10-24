import {
  ArrowLeftRight,
  Bell,
  BookUser,
  Building2,
  CalendarClock,
  CalendarDays,
  FileBarChart,
  Heart,
  Home,
  LayoutDashboard,
  Search,
  Stethoscope,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import type { UserRole } from '@/types'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
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
          end
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-700 no-underline transition hover:bg-navy-900/5 hover:text-navy-900',
              isActive &&
                'bg-teal-50 text-teal-600 hover:bg-teal-50 hover:text-teal-600 dark:bg-brand-500/10',
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon
                className={cn(
                  'h-[18px] w-[18px] shrink-0 transition',
                  isActive ? 'text-teal-600' : 'text-ink-500 group-hover:text-navy-900',
                )}
                aria-hidden
              />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export const publicNav: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, roles: 'public' },
  { to: '/doctors', label: 'Find a Doctor', icon: Search, roles: 'public' },
  { to: '/doctors/on-duty', label: 'Doctors on Duty', icon: Stethoscope, roles: 'public' },
]

export const patientNav: NavItem[] = [
  { to: '/patient', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/doctors', label: 'Find a Doctor', icon: Search },
  { to: '/doctors/on-duty', label: 'Doctors on Duty', icon: Stethoscope },
  { to: '/patient/saved', label: 'Saved Doctors', icon: Heart },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/patient/profile', label: 'My Profile', icon: UserRound },
]

export const adminNav: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/staff', label: 'Staff', icon: Users },
  { to: '/admin/departments', label: 'Departments & Shifts', icon: Building2 },
  { to: '/admin/schedule', label: 'Duty Schedule', icon: CalendarDays },
  { to: '/exchanges', label: 'Shift Exchanges', icon: ArrowLeftRight },
  { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/doctors', label: 'Public Directory', icon: BookUser },
]

export const doctorNav: NavItem[] = [
  { to: '/doctor', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/doctor/schedule', label: 'My Schedule', icon: CalendarClock },
  { to: '/exchanges', label: 'Shift Exchanges', icon: ArrowLeftRight },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/doctors', label: 'Doctor Directory', icon: BookUser },
]

export const nurseNav: NavItem[] = [
  { to: '/nurse', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/nurse/schedule', label: 'My Schedule', icon: CalendarClock },
  { to: '/exchanges', label: 'Shift Exchanges', icon: ArrowLeftRight },
  { to: '/notifications', label: 'Notifications', icon: Bell },
]
