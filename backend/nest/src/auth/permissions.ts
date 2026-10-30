import type { Role } from './roles';

export const PERMISSIONS: Record<Role, string[]> = {
  admin: [
    'dashboard:admin', 'staff:read', 'staff:write', 'departments:read', 'departments:write',
    'schedule:read', 'schedule:write', 'schedule:publish', 'patients:read_all',
    'appointments:read_all', 'appointments:manage', 'reports:read', 'exchanges:approve',
    'notifications:read_own', 'roles:assign',
  ],
  doctor: [
    'dashboard:doctor', 'schedule:read_own', 'patients:read_assigned', 'appointments:read_own',
    'appointments:write_own', 'exchanges:request', 'notifications:read_own', 'notes:write_own',
  ],
  nurse: [
    'dashboard:nurse', 'schedule:read_own', 'patients:read_ward', 'appointments:read_ward',
    'exchanges:request', 'notifications:read_own', 'vitals:write_ward',
  ],
  patient: [
    'dashboard:patient', 'appointments:read_own', 'appointments:request', 'doctors:read_public',
    'schedule:read_public', 'profile:read_own', 'profile:write_own', 'notifications:read_own',
  ],
};

export function permissionsFor(role: string): string[] {
  if (role === 'admin' || role === 'doctor' || role === 'nurse' || role === 'patient') {
    return PERMISSIONS[role];
  }
  return [];
}
