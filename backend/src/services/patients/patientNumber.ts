import crypto from "crypto";
import { prisma } from "../../lib/prisma.js";

export type NumberConfig = {
  prefix: string;
  facilityCode: string;
  padWidth: number;
};

const DEFAULTS: NumberConfig = { prefix: "FIL", facilityCode: "001", padWidth: 6 };

function parseFeatures(featuresJson: string | null | undefined): Partial<NumberConfig> {
  try {
    const raw = JSON.parse(featuresJson || "{}") as {
      patientNumber?: Partial<NumberConfig>;
    };
    return raw.patientNumber || {};
  } catch {
    return {};
  }
}

export function formatPatientNumber(cfg: NumberConfig, value: number) {
  const pad = Math.min(Math.max(cfg.padWidth || 6, 3), 12);
  return `${cfg.prefix}-${cfg.facilityCode}-${String(value).padStart(pad, "0")}`;
}

/**
 * Allocate next facility-scoped patient number atomically.
 * Uses INSERT … ON CONFLICT DO UPDATE … RETURNING so concurrent registrations cannot collide.
 * Format example: FIL-001-000001 (configurable via FacilitySettings.featuresJson.patientNumber
 * and PatientNumberSequence row).
 */
export async function allocatePatientNumber(facilityId: string): Promise<string> {
  const settings = await prisma.facilitySettings.findUnique({ where: { facilityId } });
  const fromSettings = parseFeatures(settings?.featuresJson);
  const prefix = (fromSettings.prefix || DEFAULTS.prefix).slice(0, 12).toUpperCase();
  const facilityCode = (fromSettings.facilityCode || DEFAULTS.facilityCode).slice(0, 12);
  const padWidth = fromSettings.padWidth || DEFAULTS.padWidth;
  const id = `pns_${facilityId}`;

  // Atomic allocate: on first insert nextValue becomes 2 and we return 1;
  // on conflict, nextValue increments and we return previous value.
  const rows = await prisma.$queryRaw<
    Array<{ prefix: string; facilityCode: string; padWidth: number; allocated: number }>
  >`
    INSERT INTO "PatientNumberSequence" ("id", "facilityId", "prefix", "facilityCode", "nextValue", "padWidth", "updatedAt")
    VALUES (${id}, ${facilityId}, ${prefix}, ${facilityCode}, 2, ${padWidth}, NOW())
    ON CONFLICT ("facilityId") DO UPDATE
    SET
      "nextValue" = "PatientNumberSequence"."nextValue" + 1,
      "updatedAt" = NOW()
    RETURNING
      "prefix",
      "facilityCode",
      "padWidth",
      ("nextValue" - 1) AS "allocated"
  `;

  const row = rows[0];
  if (!row) throw new Error("Failed to allocate patient number.");
  return formatPatientNumber(
    {
      prefix: row.prefix || prefix,
      facilityCode: row.facilityCode || facilityCode,
      padWidth: row.padWidth || padWidth,
    },
    Number(row.allocated),
  );
}

export async function allocateEncounterNumber(facilityId: string): Promise<string> {
  // Encounter numbers: ENC-YYYYMMDD-<random6> with unique constraint retry.
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  for (let i = 0; i < 8; i++) {
    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    const candidate = `ENC-${day}-${suffix}`;
    const exists = await prisma.encounter.findUnique({
      where: { facilityId_encounterNumber: { facilityId, encounterNumber: candidate } },
    });
    if (!exists) return candidate;
  }
  throw new Error("Failed to allocate encounter number.");
}
