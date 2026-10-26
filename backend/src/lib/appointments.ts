import { prisma } from "./prisma.js";
import { assertNotTooFarPast, normalizeTime } from "./datetime.js";

const BLOCKING_STATUSES = ["requested", "confirmed"] as const;

export async function assertActiveDoctor(doctorId: string) {
  const doctor = await prisma.staff.findUnique({ where: { id: doctorId } });
  if (!doctor || doctor.role !== "doctor" || doctor.status !== "active") {
    throw Object.assign(new Error("Doctor not found or inactive."), { status: 400 });
  }
  return doctor;
}

/**
 * If the doctor has published schedule rows for that date, the time must be one of the listed slots.
 * Doctors with no schedule rows for the date are allowed (admin/walk-in style) but still pass conflict checks.
 */
export async function assertSlotAvailable(doctorId: string, date: string, time: string) {
  const normalized = normalizeTime(time);
  assertNotTooFarPast(date);

  const schedules = await prisma.doctorSchedule.findMany({
    where: { doctorId, date, status: { not: "full" } },
  });

  if (schedules.length > 0) {
    const allowed = new Set<string>();
    for (const s of schedules) {
      try {
        const slots = JSON.parse(s.slotsJson) as unknown;
        if (Array.isArray(slots)) {
          for (const slot of slots) {
            if (typeof slot === "string") allowed.add(normalizeTime(slot));
          }
        }
      } catch {
        /* ignore bad JSON */
      }
    }
    if (allowed.size > 0 && !allowed.has(normalized)) {
      throw Object.assign(
        new Error("That time is not an open slot for this doctor on the selected date."),
        { status: 409 },
      );
    }
  }

  const conflict = await prisma.appointment.findFirst({
    where: {
      doctorId,
      date,
      time: normalized,
      status: { in: [...BLOCKING_STATUSES] },
    },
    select: { id: true },
  });
  if (conflict) {
    throw Object.assign(new Error("That doctor is already booked at this date and time."), {
      status: 409,
    });
  }

  return normalized;
}

/** Same as assertSlotAvailable but ignore a row being updated. */
export async function assertSlotAvailableExcept(
  doctorId: string,
  date: string,
  time: string,
  exceptAppointmentId: string,
) {
  const normalized = normalizeTime(time);
  assertNotTooFarPast(date);

  const schedules = await prisma.doctorSchedule.findMany({
    where: { doctorId, date, status: { not: "full" } },
  });
  if (schedules.length > 0) {
    const allowed = new Set<string>();
    for (const s of schedules) {
      try {
        const slots = JSON.parse(s.slotsJson) as unknown;
        if (Array.isArray(slots)) {
          for (const slot of slots) {
            if (typeof slot === "string") allowed.add(normalizeTime(slot));
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (allowed.size > 0 && !allowed.has(normalized)) {
      throw Object.assign(
        new Error("That time is not an open slot for this doctor on the selected date."),
        { status: 409 },
      );
    }
  }

  const conflict = await prisma.appointment.findFirst({
    where: {
      doctorId,
      date,
      time: normalized,
      status: { in: [...BLOCKING_STATUSES] },
      NOT: { id: exceptAppointmentId },
    },
    select: { id: true },
  });
  if (conflict) {
    throw Object.assign(new Error("That doctor is already booked at this date and time."), {
      status: 409,
    });
  }
  return normalized;
}
