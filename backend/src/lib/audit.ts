import type { Request } from "express";
import { prisma } from "./prisma.js";
import { sanitizeAuditMeta } from "./privacy.js";

type AuditInput = {
  actorId?: string | null;
  facilityId?: string | null;
  action: string;
  entity?: string | null;
  meta?: unknown;
  /** Optional request context — IP/UA/correlation stored in sanitized meta only. */
  req?: Request | null;
};

function requestMeta(req?: Request | null) {
  if (!req) return {};
  const ip =
    (typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
      : null) ||
    req.ip ||
    null;
  const ua = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 200) : null;
  const correlationId =
    (typeof req.headers["x-request-id"] === "string" && req.headers["x-request-id"]) ||
    (typeof req.headers["x-correlation-id"] === "string" && req.headers["x-correlation-id"]) ||
    null;
  return {
    ...(ip ? { ip } : {}),
    ...(ua ? { userAgent: ua } : {}),
    ...(correlationId ? { correlationId } : {}),
  };
}

/** Persist an audit row with redacted metadata (no raw PHI/PII bodies). */
export async function writeAudit(input: AuditInput) {
  const merged =
    input.meta && typeof input.meta === "object" && !Array.isArray(input.meta)
      ? { ...(input.meta as Record<string, unknown>), ...requestMeta(input.req) }
      : { ...(input.meta != null ? { value: input.meta } : {}), ...requestMeta(input.req) };
  const safe = sanitizeAuditMeta(Object.keys(merged).length ? merged : undefined);
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      facilityId: input.facilityId ?? null,
      action: input.action,
      entity: input.entity ?? null,
      metaJson: safe ? JSON.stringify(safe) : null,
    },
  });
}

/** Delete old audit / contact / booking rows per retention env (days). */
export async function applyDataRetention() {
  const auditDays = Number(process.env.AUDIT_RETENTION_DAYS || 90);
  const contactDays = Number(process.env.CONTACT_RETENTION_DAYS || 180);
  const bookingDays = Number(process.env.BOOKING_RETENTION_DAYS || 180);

  const now = Date.now();
  const jobs: Promise<unknown>[] = [];

  if (Number.isFinite(auditDays) && auditDays > 0) {
    jobs.push(
      prisma.auditLog.deleteMany({
        where: { createdAt: { lt: new Date(now - auditDays * 86400000) } },
      }),
    );
  }
  if (Number.isFinite(contactDays) && contactDays > 0) {
    jobs.push(
      prisma.contactMessage.deleteMany({
        where: { createdAt: { lt: new Date(now - contactDays * 86400000) } },
      }),
    );
  }
  if (Number.isFinite(bookingDays) && bookingDays > 0) {
    jobs.push(
      prisma.bookingRequest.deleteMany({
        where: { createdAt: { lt: new Date(now - bookingDays * 86400000) } },
      }),
    );
  }

  await Promise.all(jobs);
}
