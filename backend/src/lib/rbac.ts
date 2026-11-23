import { normalizeFacilityRole, type FacilityRole, type Role } from "./roles.js";

/**
 * Canonical permission catalog (dotted style) plus legacy colon aliases used by existing routes.
 * `can()` accepts either form.
 */
export const PERMISSION_ALIASES: Record<string, string> = {
  // legacy → canonical
  "dashboard:admin": "dashboard.admin",
  "dashboard:doctor": "dashboard.clinical",
  "dashboard:nurse": "dashboard.clinical",
  "dashboard:patient": "dashboard.patient",
  "staff:read": "staff.read",
  "staff:write": "staff.manage",
  "departments:read": "departments.read",
  "departments:write": "facility.settings.manage",
  "schedule:read": "schedule.read",
  "schedule:write": "schedule.manage",
  "schedule:publish": "schedule.publish",
  "schedule:read_own": "schedule.read_own",
  "schedule:read_public": "schedule.read_public",
  "patients:read_all": "patients.read",
  "patients:read_assigned": "patients.read_assigned",
  "patients:read_ward": "patients.read_ward",
  "appointments:read_all": "appointments.read",
  "appointments:manage": "appointments.manage",
  "appointments:read_own": "appointments.read_own",
  "appointments:write_own": "appointments.write_own",
  "appointments:read_ward": "appointments.read_ward",
  "appointments:request": "appointments.request",
  "reports:read": "reports.read",
  "exchanges:approve": "exchanges.approve",
  "exchanges:request": "exchanges.request",
  "notifications:read_own": "notifications.read",
  "roles:assign": "roles.manage",
  "notes:write_own": "clinical.write",
  "vitals:write_ward": "clinical.vitals_ward",
  "doctors:read_public": "doctors.read_public",
  "profile:read_own": "profile.read",
  "profile:write_own": "profile.write",
};

function canonical(permission: string) {
  return PERMISSION_ALIASES[permission] || permission;
}

/** Role → canonical permissions (least privilege). */
export const ROLE_PERMISSIONS: Record<FacilityRole, string[]> = {
  admin: [
    "dashboard.admin",
    "staff.read", "staff.manage", "users.manage", "roles.manage",
    "departments.read", "facility.settings.manage",
    "schedule.read", "schedule.manage", "schedule.publish",
    "patients.read", "patients.create", "patients.update", "patients.archive",
    "patients.medical_history.read", "patients.medical_history.manage",
    "patients.documents.read", "patients.documents.upload", "patients.documents.delete",
    "encounters.read", "encounters.create", "encounters.update",
    "appointments.read", "appointments.create", "appointments.update",
    "appointments.manage", "appointments.cancel", "appointments.reschedule",
    "schedules.read", "schedules.manage",
    "queue.read", "queue.manage", "queue.checkin", "queue.call_next", "queue.manage_priority",
    "reports.read", "exchanges.approve", "exchanges.request",
    "notifications.read", "billing.read", "billing.manage",
    "inventory.manage", "lab.orders.manage", "pharmacy.dispense",
  ],
  facility_owner: [], // normalized to admin
  facility_admin: [], // normalized to admin
  doctor: [
    "dashboard.clinical",
    "schedule.read_own", "schedules.read",
    "patients.read_assigned",
    "patients.medical_history.read", "patients.medical_history.manage",
    "patients.documents.read", "patients.documents.upload",
    "encounters.read", "encounters.create", "encounters.update",
    "appointments.read_own", "appointments.write_own", "appointments.reschedule",
    "queue.read",
    "exchanges.request", "notifications.read",
    "clinical.read", "clinical.write",
    "lab.orders.manage",
  ],
  nurse: [
    "dashboard.clinical",
    "schedule.read_own", "schedules.read",
    "patients.read_ward",
    "patients.medical_history.read",
    "patients.documents.read",
    "encounters.read", "encounters.create",
    "appointments.read_ward",
    "queue.read", "queue.checkin",
    "exchanges.request",
    "notifications.read", "clinical.read", "clinical.vitals_ward",
  ],
  receptionist: [
    "dashboard.admin",
    "patients.read", "patients.create", "patients.update",
    "patients.documents.read", "patients.documents.upload",
    "encounters.read", "encounters.create",
    "appointments.read", "appointments.create", "appointments.update",
    "appointments.manage", "appointments.cancel", "appointments.reschedule",
    "schedules.read", "schedule.read_public", "doctors.read_public",
    "queue.read", "queue.manage", "queue.checkin", "queue.call_next", "queue.manage_priority",
    "notifications.read",
  ],
  lab_technician: [
    "dashboard.clinical",
    "patients.read_assigned",
    "patients.documents.read",
    "encounters.read",
    "lab.orders.manage", "lab.results.validate",
    "notifications.read",
  ],
  pharmacist: [
    "dashboard.clinical",
    "patients.read_assigned",
    "pharmacy.dispense", "inventory.manage",
    "notifications.read",
  ],
  cashier: [
    "dashboard.admin",
    "billing.read", "billing.manage",
    "appointments.read", "notifications.read",
  ],
  inventory_manager: [
    "dashboard.admin",
    "inventory.manage", "notifications.read",
  ],
  accountant: [
    "dashboard.admin",
    "billing.read", "reports.read", "notifications.read",
  ],
  patient: [
    "dashboard.patient",
    "appointments.read_own", "appointments.request",
    "doctors.read_public", "schedule.read_public",
    "profile.read", "profile.write", "notifications.read",
  ],
};

/** Legacy export shape used across the codebase. */
export const PERMISSIONS: Record<string, string[]> = Object.fromEntries(
  (Object.keys(ROLE_PERMISSIONS) as FacilityRole[]).map((role) => {
    const canon = ROLE_PERMISSIONS[role];
    // Also expose legacy colon codes that map into this role's canonical set
    const legacy = Object.entries(PERMISSION_ALIASES)
      .filter(([, c]) => canon.includes(c))
      .map(([legacyCode]) => legacyCode);
    return [role, [...new Set([...canon, ...legacy])]];
  }),
);

export function permissionsForRole(role: string): string[] {
  const normalized = normalizeFacilityRole(role);
  if (!normalized) return [];
  if (normalized === "admin") return PERMISSIONS.admin || [];
  return PERMISSIONS[normalized] || ROLE_PERMISSIONS[normalized] || [];
}

export function can(role: Role | string, permission: string) {
  const normalized = normalizeFacilityRole(String(role));
  if (!normalized) return false;
  const perms = permissionsForRole(normalized);
  const c = canonical(permission);
  return perms.includes(permission) || perms.includes(c);
}

export function requireAny(role: Role | string, permissions: string[]) {
  return permissions.some((p) => can(role, p));
}

/** Clinical notes — not granted to receptionist/cashier/pharmacist by default. */
export function canAccessClinicalNotes(role: string) {
  return can(role, "clinical.read") || can(role, "clinical.write") || can(role, "notes:write_own");
}
