export const ROLES = ["admin", "doctor", "nurse", "patient"] as const;
export type Role = (typeof ROLES)[number];

/** Public self-registration is patient-only. Admin creates doctor/nurse accounts. */
export const PUBLIC_SIGNUP_ROLE = "patient" as const satisfies Role;
export const ADMIN_CREATABLE_ROLES = ["doctor", "nurse"] as const;
export type AdminCreatableRole = (typeof ADMIN_CREATABLE_ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isAdminCreatableRole(value: unknown): value is AdminCreatableRole {
  return typeof value === "string" && (ADMIN_CREATABLE_ROLES as readonly string[]).includes(value);
}
