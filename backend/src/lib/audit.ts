import { prisma } from "./prisma.js";
import { sanitizeAuditMeta } from "./privacy.js";

type AuditInput = {
  actorId?: string | null;
  action: string;
  entity?: string | null;
  meta?: unknown;
};

/** Persist an audit row with redacted metadata (no raw PHI/PII bodies). */
export async function writeAudit(input: AuditInput) {
  const safe = sanitizeAuditMeta(input.meta);
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
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
