import type { AuthedRequest } from "../middleware/auth.js";
import { prisma } from "./prisma.js";
import { normalizeFacilityRole, type Role } from "./roles.js";

/** Stable id used by the Section 2 backfill migration for existing rows. */
export const DEFAULT_FACILITY_ID = "fac_filfilu_default";
export const DEFAULT_FACILITY_SLUG = "filfilu-default";

export type MembershipRow = {
  id: string;
  facilityId: string;
  role: string;
  status: string;
  staffId: string | null;
  title: string | null;
  ward: string | null;
  dept: string | null;
  facility: { id: string; slug: string; name: string; status: string };
};

/**
 * Resolve which facility a request should operate in.
 * Never trusts a client facility id without an active membership (or platform super_admin).
 */
export async function resolveFacilityContext(
  userId: string,
  opts: {
    requestedFacilityId?: string | null;
    defaultFacilityId?: string | null;
    platformRole?: string | null;
    jwtFacilityId?: string | null;
  },
): Promise<{ facilityId: string; membership: MembershipRow | null; role: Role } | null> {
  const memberships = await prisma.facilityMembership.findMany({
    where: { userId, status: "active" },
    include: {
      facility: { select: { id: true, slug: true, name: true, status: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const activeMemberships = memberships.filter((m) => m.facility.status === "active");
  const isSuper = opts.platformRole === "super_admin";

  const pick =
    (opts.requestedFacilityId &&
      activeMemberships.find((m) => m.facilityId === opts.requestedFacilityId)) ||
    (opts.jwtFacilityId && activeMemberships.find((m) => m.facilityId === opts.jwtFacilityId)) ||
    (opts.defaultFacilityId &&
      activeMemberships.find((m) => m.facilityId === opts.defaultFacilityId)) ||
    activeMemberships[0] ||
    null;

  if (pick) {
    const role = normalizeFacilityRole(pick.role);
    if (!role) return null;
    return { facilityId: pick.facilityId, membership: pick, role };
  }

  // Platform super_admin may operate on a requested facility without membership (ops).
  if (isSuper && opts.requestedFacilityId) {
    const fac = await prisma.facility.findFirst({
      where: { id: opts.requestedFacilityId, status: "active" },
    });
    if (!fac) return null;
    return {
      facilityId: fac.id,
      membership: null,
      role: "admin",
    };
  }

  if (isSuper) {
    return {
      facilityId: DEFAULT_FACILITY_ID,
      membership: null,
      role: "admin",
    };
  }

  return null;
}

export function facilityIdFromRequest(req: AuthedRequest): string | null {
  const header = req.header("x-facility-id")?.trim();
  if (header) return header;
  return req.user?.facilityId ?? null;
}

export function requireFacilityId(req: AuthedRequest): string {
  const id = req.user?.facilityId;
  if (!id) {
    const err = new Error("Active facility context is required.");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return id;
}

/** Reject client attempts to set / override facilityId on create payloads. */
export function stripClientFacilityId<T extends Record<string, unknown>>(body: T): Omit<T, "facilityId"> {
  const { facilityId: _ignored, ...rest } = body;
  return rest;
}

export async function assertSameFacilityStaff(facilityId: string, staffId: string) {
  const row = await prisma.staff.findFirst({ where: { id: staffId, facilityId } });
  if (!row) {
    const err = new Error("Staff does not belong to the active facility.");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  return row;
}

export async function assertSameFacilityPatient(facilityId: string, patientId: string) {
  const row = await prisma.patient.findFirst({ where: { id: patientId, facilityId } });
  if (!row) {
    const err = new Error("Patient does not belong to the active facility.");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  return row;
}

export async function listUserFacilities(userId: string) {
  const rows = await prisma.facilityMembership.findMany({
    where: { userId, status: "active", facility: { status: "active" } },
    include: { facility: { select: { id: true, slug: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((m) => ({
    facilityId: m.facilityId,
    slug: m.facility.slug,
    name: m.facility.name,
    role: m.role,
  }));
}
