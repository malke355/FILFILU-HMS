import { prisma } from "../../lib/prisma.js";

export async function allocateAppointmentNumber(facilityId: string): Promise<string> {
  const id = `ans_${facilityId}`;
  const rows = await prisma.$queryRaw<
    Array<{ prefix: string; facilityCode: string; padWidth: number; allocated: number }>
  >`
    INSERT INTO "AppointmentNumberSequence" ("id", "facilityId", "prefix", "facilityCode", "nextValue", "padWidth", "updatedAt")
    VALUES (${id}, ${facilityId}, 'APT', '001', 2, 6, NOW())
    ON CONFLICT ("facilityId") DO UPDATE
    SET "nextValue" = "AppointmentNumberSequence"."nextValue" + 1, "updatedAt" = NOW()
    RETURNING "prefix", "facilityCode", "padWidth", ("nextValue" - 1) AS "allocated"
  `;
  const row = rows[0];
  if (!row) throw new Error("Failed to allocate appointment number.");
  const pad = Math.min(Math.max(Number(row.padWidth) || 6, 3), 12);
  return `${row.prefix}-${row.facilityCode}-${String(Number(row.allocated)).padStart(pad, "0")}`;
}

export async function allocateQueueNumber(
  facilityId: string,
  departmentKey: string,
  serviceDate: string,
): Promise<string> {
  const dept = departmentKey.trim().toUpperCase().replace(/\s+/g, "_").slice(0, 24) || "GENERAL";
  const id = `qns_${facilityId}_${dept}_${serviceDate}`;
  const rows = await prisma.$queryRaw<Array<{ allocated: number }>>`
    INSERT INTO "QueueNumberSequence" ("id", "facilityId", "departmentKey", "serviceDate", "nextValue", "updatedAt")
    VALUES (${id}, ${facilityId}, ${dept}, ${serviceDate}, 2, NOW())
    ON CONFLICT ("facilityId", "departmentKey", "serviceDate") DO UPDATE
    SET "nextValue" = "QueueNumberSequence"."nextValue" + 1, "updatedAt" = NOW()
    RETURNING ("nextValue" - 1) AS "allocated"
  `;
  const allocated = Number(rows[0]?.allocated);
  if (!Number.isFinite(allocated)) throw new Error("Failed to allocate queue number.");
  return `Q-${dept}-${String(allocated).padStart(4, "0")}`;
}
