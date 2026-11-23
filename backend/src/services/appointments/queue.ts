import { prisma } from "../../lib/prisma.js";
import { transitionAppointment } from "./booking.js";
import { allocateQueueNumber } from "./numbering.js";
import { enqueueAppointmentNotification } from "./notifications.js";

const QUEUE_TRANSITIONS: Record<string, string[]> = {
  waiting: ["called", "skipped", "cancelled", "in_service"],
  called: ["in_service", "skipped", "waiting", "cancelled"],
  in_service: ["completed", "cancelled"],
  skipped: ["waiting", "cancelled"],
  completed: [],
  cancelled: [],
};

export function assertQueueTransition(from: string, to: string) {
  if (from === to) return;
  const allowed = QUEUE_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw Object.assign(new Error(`Invalid queue transition: ${from} → ${to}.`), { status: 400 });
  }
}

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  follow_up: 1,
  normal: 2,
};

export async function createQueueEntry(input: {
  facilityId: string;
  patientId: string;
  appointmentId?: string | null;
  departmentKey: string;
  doctorId?: string | null;
  serviceDate: string;
  priority?: string;
  createdById: string;
}) {
  // Prevent duplicate active queue for same appointment
  if (input.appointmentId) {
    const existing = await prisma.queueEntry.findFirst({
      where: {
        facilityId: input.facilityId,
        appointmentId: input.appointmentId,
        status: { in: ["waiting", "called", "in_service"] },
      },
    });
    if (existing) {
      throw Object.assign(new Error("This appointment already has an active queue entry."), {
        status: 409,
      });
    }
  }

  const queueNumber = await allocateQueueNumber(
    input.facilityId,
    input.departmentKey,
    input.serviceDate,
  );

  const entry = await prisma.queueEntry.create({
    data: {
      facilityId: input.facilityId,
      queueNumber,
      patientId: input.patientId,
      appointmentId: input.appointmentId || null,
      departmentKey: input.departmentKey.trim().toUpperCase().replace(/\s+/g, "_").slice(0, 24) || "GENERAL",
      doctorId: input.doctorId || null,
      serviceDate: input.serviceDate,
      priority: input.priority || "normal",
      status: "waiting",
      createdById: input.createdById,
    },
  });

  return entry;
}

export async function checkInAppointment(input: {
  facilityId: string;
  appointmentId: string;
  actorId: string;
  priority?: string;
}) {
  const appt = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, facilityId: input.facilityId },
  });
  if (!appt) return null;

  const activeQueue = await prisma.queueEntry.findFirst({
    where: {
      facilityId: input.facilityId,
      appointmentId: appt.id,
      status: { in: ["waiting", "called", "in_service"] },
    },
  });
  if (activeQueue) {
    return { appointment: appt, queue: activeQueue, duplicate: true as const };
  }

  const updated =
    (await transitionAppointment({
      facilityId: input.facilityId,
      appointmentId: appt.id,
      toStatus: appt.status === "scheduled" || appt.status === "requested" ? "checked_in" : "waiting",
      actorId: input.actorId,
    })) || appt;

  // Prefer waiting after check-in for queue board
  let finalAppt = updated;
  if (updated.status === "checked_in") {
    finalAppt =
      (await transitionAppointment({
        facilityId: input.facilityId,
        appointmentId: appt.id,
        toStatus: "waiting",
        actorId: input.actorId,
      })) || updated;
  }

  const queue = await createQueueEntry({
    facilityId: input.facilityId,
    patientId: appt.patientId,
    appointmentId: appt.id,
    departmentKey: appt.dept || "GENERAL",
    doctorId: appt.doctorId,
    serviceDate: appt.date,
    priority: input.priority || "normal",
    createdById: input.actorId,
  });

  return { appointment: finalAppt, queue, duplicate: false as const };
}

export async function listQueue(input: {
  facilityId: string;
  serviceDate: string;
  departmentKey?: string | null;
  doctorId?: string | null;
}) {
  const rows = await prisma.queueEntry.findMany({
    where: {
      facilityId: input.facilityId,
      serviceDate: input.serviceDate,
      ...(input.departmentKey
        ? { departmentKey: input.departmentKey.toUpperCase().replace(/\s+/g, "_") }
        : {}),
      ...(input.doctorId ? { doctorId: input.doctorId } : {}),
    },
    orderBy: [{ status: "asc" }, { arrivalTime: "asc" }],
  });

  // Priority-aware ordering for waiting/called
  const rank = (p: string) => PRIORITY_RANK[p] ?? 9;
  return rows.sort((a, b) => {
    const active = ["waiting", "called"].includes(a.status) && ["waiting", "called"].includes(b.status);
    if (active) {
      const pr = rank(a.priority) - rank(b.priority);
      if (pr !== 0) return pr;
      return a.arrivalTime.getTime() - b.arrivalTime.getTime();
    }
    return 0;
  });
}

export async function transitionQueue(input: {
  facilityId: string;
  queueId: string;
  toStatus: string;
  actorId: string;
  skipReason?: string | null;
}) {
  const entry = await prisma.queueEntry.findFirst({
    where: { id: input.queueId, facilityId: input.facilityId },
  });
  if (!entry) return null;
  assertQueueTransition(entry.status, input.toStatus);

  const data: Record<string, unknown> = { status: input.toStatus };
  if (input.toStatus === "called") data.calledAt = new Date();
  if (input.toStatus === "in_service") data.serviceStartedAt = new Date();
  if (input.toStatus === "completed") data.completedAt = new Date();
  if (input.toStatus === "skipped") data.skipReason = input.skipReason || null;

  const updated = await prisma.queueEntry.update({ where: { id: entry.id }, data });

  if (input.toStatus === "called") {
    await enqueueAppointmentNotification({
      facilityId: input.facilityId,
      template: "queue.called",
      payload: { queueId: entry.id, queueNumber: entry.queueNumber },
      inAppText: `Queue ${entry.queueNumber} called.`,
      role: "receptionist",
    });
  }

  if (entry.appointmentId && input.toStatus === "in_service") {
    await transitionAppointment({
      facilityId: input.facilityId,
      appointmentId: entry.appointmentId,
      toStatus: "in_consultation",
      actorId: input.actorId,
    }).catch(() => null);
  }
  if (entry.appointmentId && input.toStatus === "completed") {
    await transitionAppointment({
      facilityId: input.facilityId,
      appointmentId: entry.appointmentId,
      toStatus: "completed",
      actorId: input.actorId,
    }).catch(() => null);
  }

  return updated;
}

export async function callNext(input: {
  facilityId: string;
  serviceDate: string;
  departmentKey: string;
  doctorId?: string | null;
  actorId: string;
}) {
  const waiting = await listQueue({
    facilityId: input.facilityId,
    serviceDate: input.serviceDate,
    departmentKey: input.departmentKey,
    doctorId: input.doctorId,
  });
  const next = waiting.find((q) => q.status === "waiting");
  if (!next) return null;
  return transitionQueue({
    facilityId: input.facilityId,
    queueId: next.id,
    toStatus: "called",
    actorId: input.actorId,
  });
}
