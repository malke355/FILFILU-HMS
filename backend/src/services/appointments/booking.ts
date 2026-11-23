import { prisma } from "../../lib/prisma.js";
import {
  assertActiveDoctor,
  assertSlotAvailable,
  assertValidTransition,
  addMinutesToTime,
} from "../../lib/appointments.js";
import { allocateAppointmentNumber } from "./numbering.js";
import { enqueueAppointmentNotification } from "./notifications.js";

export async function recordStatusEvent(input: {
  facilityId: string;
  appointmentId: string;
  fromStatus: string | null;
  toStatus: string;
  actorId?: string | null;
  reason?: string | null;
}) {
  await prisma.appointmentStatusEvent.create({
    data: {
      facilityId: input.facilityId,
      appointmentId: input.appointmentId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorId: input.actorId || null,
      reason: input.reason || null,
    },
  });
}

export type BookAppointmentInput = {
  facilityId: string;
  patientId: string;
  doctorId: string;
  date: string;
  time: string;
  dept: string;
  departmentId?: string | null;
  reason?: string | null;
  type?: string;
  bookingSource?: string;
  durationMinutes?: number;
  createdById: string;
  /** Staff booking → confirmed; patient → scheduled/requested */
  initialStatus?: string;
};

export async function bookAppointment(input: BookAppointmentInput) {
  await assertActiveDoctor(input.doctorId);
  const duration = input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : 30;
  const slot = await assertSlotAvailable(input.doctorId, input.date, input.time, {
    facilityId: input.facilityId,
    durationMinutes: duration,
  });
  const appointmentNumber = await allocateAppointmentNumber(input.facilityId);
  const status = input.initialStatus || "scheduled";

  const created = await prisma.$transaction(async (tx) => {
    // Re-check inside transaction for race safety (unique index is final backstop).
    const conflict = await tx.appointment.findFirst({
      where: {
        doctorId: input.doctorId,
        date: input.date,
        time: slot.time,
        status: {
          in: ["requested", "scheduled", "confirmed", "checked_in", "waiting", "in_consultation"],
        },
      },
      select: { id: true },
    });
    if (conflict) {
      throw Object.assign(new Error("That doctor is already booked at this date and time."), {
        status: 409,
      });
    }

    const row = await tx.appointment.create({
      data: {
        facilityId: input.facilityId,
        appointmentNumber,
        patientId: input.patientId,
        doctorId: input.doctorId,
        departmentId: input.departmentId || null,
        date: input.date,
        time: slot.time,
        endTime: slot.endTime,
        durationMinutes: slot.durationMinutes,
        dept: input.dept,
        type: input.type || "general",
        bookingSource: input.bookingSource || "reception",
        reason: input.reason || null,
        status,
        createdById: input.createdById,
      },
    });

    await tx.appointmentStatusEvent.create({
      data: {
        facilityId: input.facilityId,
        appointmentId: row.id,
        fromStatus: null,
        toStatus: status,
        actorId: input.createdById,
      },
    });

    return row;
  });

  await enqueueAppointmentNotification({
    facilityId: input.facilityId,
    template: "appointment.created",
    payload: {
      appointmentId: created.id,
      appointmentNumber: created.appointmentNumber,
      date: created.date,
      time: created.time,
    },
    inAppText: `Appointment ${created.appointmentNumber || created.id} scheduled for ${created.date} ${created.time}.`,
    role: "receptionist",
  });

  return created;
}

export async function transitionAppointment(input: {
  facilityId: string;
  appointmentId: string;
  toStatus: string;
  actorId: string;
  reason?: string | null;
  cancelReason?: string | null;
}) {
  const existing = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, facilityId: input.facilityId },
  });
  if (!existing) return null;
  assertValidTransition(existing.status, input.toStatus);

  const data: Record<string, unknown> = { status: input.toStatus };
  if (input.toStatus === "cancelled") {
    data.cancelledAt = new Date();
    data.cancelledById = input.actorId;
    data.cancelReason = input.cancelReason || input.reason || null;
  }
  if (input.toStatus === "checked_in" || input.toStatus === "waiting") {
    data.checkedInAt = existing.checkedInAt || new Date();
  }

  const updated = await prisma.appointment.update({
    where: { id: existing.id },
    data,
  });
  await recordStatusEvent({
    facilityId: input.facilityId,
    appointmentId: existing.id,
    fromStatus: existing.status,
    toStatus: input.toStatus,
    actorId: input.actorId,
    reason: input.cancelReason || input.reason,
  });

  if (input.toStatus === "cancelled") {
    await enqueueAppointmentNotification({
      facilityId: input.facilityId,
      template: "appointment.cancelled",
      payload: { appointmentId: existing.id },
      inAppText: `Appointment ${existing.appointmentNumber || existing.id} cancelled.`,
      role: "receptionist",
    });
  }

  return updated;
}

export async function rescheduleAppointment(input: {
  facilityId: string;
  appointmentId: string;
  doctorId: string;
  date: string;
  time: string;
  durationMinutes?: number;
  actorId: string;
  reason?: string | null;
}) {
  const existing = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, facilityId: input.facilityId },
  });
  if (!existing) return null;
  if (["completed", "cancelled"].includes(existing.status)) {
    throw Object.assign(new Error("Cannot reschedule a completed or cancelled appointment."), {
      status: 400,
    });
  }

  await assertActiveDoctor(input.doctorId);
  const duration =
    input.durationMinutes || existing.durationMinutes || 30;
  const slot = await assertSlotAvailable(input.doctorId, input.date, input.time, {
    facilityId: input.facilityId,
    durationMinutes: duration,
    exceptAppointmentId: existing.id,
  });

  // Mark old as rescheduled history marker, then update in place (preserve id for queue links).
  const previous = {
    date: existing.date,
    time: existing.time,
    doctorId: existing.doctorId,
    status: existing.status,
  };

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.appointment.update({
      where: { id: existing.id },
      data: {
        doctorId: input.doctorId,
        date: input.date,
        time: slot.time,
        endTime: slot.endTime || addMinutesToTime(slot.time, duration),
        durationMinutes: duration,
        status: existing.status === "requested" ? "scheduled" : "confirmed",
        rescheduledFromId: existing.rescheduledFromId || existing.id,
      },
    });
    await tx.appointmentStatusEvent.create({
      data: {
        facilityId: input.facilityId,
        appointmentId: existing.id,
        fromStatus: previous.status,
        toStatus: row.status,
        actorId: input.actorId,
        reason:
          input.reason ||
          `Rescheduled from ${previous.date} ${previous.time} (doctor ${previous.doctorId})`,
      },
    });
    return row;
  });

  await enqueueAppointmentNotification({
    facilityId: input.facilityId,
    template: "appointment.rescheduled",
    payload: { appointmentId: existing.id, previous, next: { date: input.date, time: slot.time } },
    inAppText: `Appointment ${existing.appointmentNumber || existing.id} rescheduled to ${input.date} ${slot.time}.`,
    role: "receptionist",
  });

  return updated;
}
