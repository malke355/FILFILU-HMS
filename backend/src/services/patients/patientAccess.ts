import type { JwtPayload } from "../../lib/auth.js";
import { can, canAccessClinicalNotes } from "../../lib/rbac.js";
import { prisma } from "../../lib/prisma.js";

export type PatientScopeWhere = Record<string, unknown>;

/** Build Prisma where for listing patients under the caller's role scope. */
export function patientListWhere(facilityId: string, user: JwtPayload): PatientScopeWhere | null {
  const base: PatientScopeWhere = { facilityId, status: { not: "deleted" } };
  if (can(user.role, "patients.read") || can(user.role, "patients:read_all")) {
    return base;
  }
  if (can(user.role, "patients.read_assigned") || can(user.role, "patients:read_assigned")) {
    return { ...base, doctorId: user.staffId ?? "__none__" };
  }
  if (can(user.role, "patients.read_ward") || can(user.role, "patients:read_ward")) {
    return { ...base, ward: user.ward ?? "__none__" };
  }
  if (can(user.role, "profile.read") || can(user.role, "profile:read_own")) {
    return { ...base, id: user.patientId ?? "__none__" };
  }
  return null;
}

/** True if the user may view this specific patient row (already facility-matched). */
export function canViewPatientRow(
  user: JwtPayload,
  patient: { id: string; doctorId: string | null; ward: string | null },
) {
  if (can(user.role, "patients.read") || can(user.role, "patients:read_all")) return true;
  if (
    (can(user.role, "patients.read_assigned") || can(user.role, "patients:read_assigned")) &&
    patient.doctorId &&
    patient.doctorId === user.staffId
  ) {
    return true;
  }
  if (
    (can(user.role, "patients.read_ward") || can(user.role, "patients:read_ward")) &&
    patient.ward &&
    patient.ward === user.ward
  ) {
    return true;
  }
  if (
    (can(user.role, "profile.read") || can(user.role, "profile:read_own")) &&
    user.patientId === patient.id
  ) {
    return true;
  }
  return false;
}

export function redactPatientForRole<T extends Record<string, unknown>>(row: T, role: string): T {
  if (canAccessClinicalNotes(role)) return row;
  const next = { ...row } as T;
  if ("condition" in next) (next as Record<string, unknown>).condition = "[restricted]";
  if ("registrationNotes" in next) (next as Record<string, unknown>).registrationNotes = null;
  return next;
}

export async function loadFacilityPatient(facilityId: string, patientId: string) {
  return prisma.patient.findFirst({
    where: { id: patientId, facilityId },
  });
}

export function canManageMedicalHistory(role: string) {
  return (
    can(role, "patients.medical_history.manage") ||
    can(role, "clinical.write") ||
    can(role, "clinical.read")
  );
}

export function canReadMedicalHistory(role: string) {
  return (
    can(role, "patients.medical_history.read") ||
    can(role, "patients.medical_history.manage") ||
    canAccessClinicalNotes(role)
  );
}

export function canManageDocuments(role: string, action: "read" | "upload" | "delete") {
  if (action === "read") {
    return (
      can(role, "patients.documents.read") ||
      can(role, "patients.documents.upload") ||
      can(role, "patients.read") ||
      canAccessClinicalNotes(role)
    );
  }
  if (action === "upload") {
    return (
      can(role, "patients.documents.upload") ||
      can(role, "patients.update") ||
      can(role, "patients.create")
    );
  }
  return (
    can(role, "patients.documents.delete") ||
    can(role, "patients.archive") ||
    can(role, "staff.manage")
  );
}

export function canManageEncounters(role: string, action: "read" | "create" | "update") {
  if (action === "read") {
    return (
      can(role, "encounters.read") ||
      can(role, "patients.read") ||
      can(role, "patients.read_assigned") ||
      can(role, "patients.read_ward") ||
      can(role, "appointments.read") ||
      can(role, "appointments.manage")
    );
  }
  if (action === "create") {
    return (
      can(role, "encounters.create") ||
      can(role, "patients.create") ||
      can(role, "appointments.manage") ||
      can(role, "clinical.write")
    );
  }
  return can(role, "encounters.update") || can(role, "clinical.write") || can(role, "appointments.manage");
}
