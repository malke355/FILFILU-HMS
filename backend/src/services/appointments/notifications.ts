import { prisma } from "../../lib/prisma.js";
import { logInfo } from "../../lib/logger.js";

/**
 * Queue a notification job. Does NOT claim delivery.
 * Dev adapter marks as skipped with log; production providers process `queued` jobs later.
 */
export async function enqueueAppointmentNotification(input: {
  facilityId: string;
  template: string;
  channel?: string;
  payload: Record<string, unknown>;
  userId?: string | null;
  role?: string | null;
  inAppText?: string;
}) {
  const job = await prisma.notificationJob.create({
    data: {
      facilityId: input.facilityId,
      channel: input.channel || "in_app",
      template: input.template,
      payloadJson: JSON.stringify(input.payload),
      status: "queued",
    },
  });

  if (input.inAppText) {
    await prisma.notification.create({
      data: {
        facilityId: input.facilityId,
        userId: input.userId || null,
        role: input.role || null,
        text: input.inAppText,
        level: "info",
      },
    });
  }

  // Development adapter: acknowledge queue only — never report SMS/email delivered.
  const adapter = (process.env.NOTIFY_ADAPTER || "dev").toLowerCase();
  if (adapter === "dev") {
    await prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        status: "skipped",
        error: "dev_adapter_no_external_provider",
        processedAt: new Date(),
      },
    });
    logInfo(`[notify] queued ${input.template} job=${job.id} (dev adapter — not delivered externally)`);
  }

  return { jobId: job.id, delivered: false, status: adapter === "dev" ? "skipped" : "queued" };
}
