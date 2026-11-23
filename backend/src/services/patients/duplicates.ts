import { prisma } from "../../lib/prisma.js";

export type DuplicateHint = {
  patientId: string;
  patientNumber: string | null;
  name: string;
  phone: string | null;
  dateOfBirth: Date | null;
  matchReasons: string[];
};

export type DuplicateQuery = {
  facilityId: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  dateOfBirth?: Date | null;
  identifierSystem?: string | null;
  identifierValue?: string | null;
  excludePatientId?: string | null;
};

/**
 * Soft duplicate detection — never merges, never blocks registration.
 * Matches: exact identifier, exact phone, or (same DOB + similar name).
 */
export async function findPotentialDuplicates(q: DuplicateQuery): Promise<DuplicateHint[]> {
  const scored = new Map<string, DuplicateHint>();

  const add = (
    row: {
      id: string;
      patientNumber: string | null;
      name: string;
      phone: string | null;
      dateOfBirth: Date | null;
    },
    reason: string,
  ) => {
    if (q.excludePatientId && row.id === q.excludePatientId) return;
    const existing = scored.get(row.id);
    if (existing) {
      if (!existing.matchReasons.includes(reason)) existing.matchReasons.push(reason);
      return;
    }
    scored.set(row.id, {
      patientId: row.id,
      patientNumber: row.patientNumber,
      name: row.name,
      phone: row.phone,
      dateOfBirth: row.dateOfBirth,
      matchReasons: [reason],
    });
  };

  if (q.identifierSystem && q.identifierValue) {
    const ids = await prisma.patientIdentifier.findMany({
      where: {
        facilityId: q.facilityId,
        system: q.identifierSystem,
        value: q.identifierValue.trim(),
      },
      include: {
        patient: {
          select: {
            id: true,
            patientNumber: true,
            name: true,
            phone: true,
            dateOfBirth: true,
            status: true,
          },
        },
      },
      take: 10,
    });
    for (const id of ids) {
      if (id.patient.status === "archived") continue;
      add(id.patient, "identifier");
    }
  }

  if (q.phone?.trim()) {
    const phone = q.phone.trim();
    const byPhone = await prisma.patient.findMany({
      where: {
        facilityId: q.facilityId,
        status: "active",
        OR: [{ phone }, { phoneAlt: phone }],
      },
      select: {
        id: true,
        patientNumber: true,
        name: true,
        phone: true,
        dateOfBirth: true,
      },
      take: 10,
    });
    for (const row of byPhone) add(row, "phone");
  }

  const first = (q.firstName || "").trim();
  const last = (q.lastName || "").trim();
  if (first && last && q.dateOfBirth) {
    const dayStart = new Date(q.dateOfBirth);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const byNameDob = await prisma.patient.findMany({
      where: {
        facilityId: q.facilityId,
        status: "active",
        dateOfBirth: { gte: dayStart, lt: dayEnd },
        OR: [
          {
            firstName: { equals: first, mode: "insensitive" },
            lastName: { equals: last, mode: "insensitive" },
          },
          {
            name: { contains: `${first} ${last}`, mode: "insensitive" },
          },
        ],
      },
      select: {
        id: true,
        patientNumber: true,
        name: true,
        phone: true,
        dateOfBirth: true,
      },
      take: 10,
    });
    for (const row of byNameDob) add(row, "name_dob");
  }

  return [...scored.values()].slice(0, 15);
}
