/** Facility-scoped roles (membership.role). Legacy aliases kept for API compatibility. */
export const FACILITY_ROLES = [
  "admin", // alias: facility administrator / owner
  "facility_owner",
  "facility_admin",
  "doctor",
  "nurse",
  "receptionist",
  "lab_technician",
  "pharmacist",
  "cashier",
  "inventory_manager",
  "accountant",
  "patient",
] as const;

export type FacilityRole = (typeof FACILITY_ROLES)[number];

/** @deprecated Prefer FacilityRole — kept so existing imports/types compile. */
export type Role = FacilityRole;

export const ROLES = FACILITY_ROLES;

export const PLATFORM_ROLES = ["super_admin", "support"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/** Public self-registration is patient-only. */
export const PUBLIC_SIGNUP_ROLE = "patient" as const satisfies FacilityRole;

/** Roles a facility admin may create login accounts for. */
export const ADMIN_CREATABLE_ROLES = [
  "doctor",
  "nurse",
  "receptionist",
  "lab_technician",
  "pharmacist",
  "cashier",
  "inventory_manager",
  "accountant",
] as const;
export type AdminCreatableRole = (typeof ADMIN_CREATABLE_ROLES)[number];

/** Normalize legacy/admin aliases to a canonical facility role for permission lookup. */
export function normalizeFacilityRole(value: string): FacilityRole | null {
  const r = String(value || "").trim().toLowerCase();
  if (r === "facility_owner" || r === "facility_admin" || r === "owner") return "admin";
  if ((FACILITY_ROLES as readonly string[]).includes(r)) return r as FacilityRole;
  return null;
}

export function isRole(value: unknown): value is FacilityRole {
  return typeof value === "string" && normalizeFacilityRole(value) !== null;
}

export function isAdminCreatableRole(value: unknown): value is AdminCreatableRole {
  return typeof value === "string" && (ADMIN_CREATABLE_ROLES as readonly string[]).includes(value);
}

export function isPlatformRole(value: unknown): value is PlatformRole {
  return typeof value === "string" && (PLATFORM_ROLES as readonly string[]).includes(value);
}

/** Facility admins cannot assign platform privileges. */
export function assertNotPlatformPrivilegeGrant(roleOrPlatform: string) {
  if (isPlatformRole(roleOrPlatform) || roleOrPlatform === "super_admin" || roleOrPlatform === "support") {
    const err = new Error("Facility administrators cannot grant platform-level privileges.");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
}
