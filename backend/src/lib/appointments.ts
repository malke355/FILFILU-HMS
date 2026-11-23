import { prisma } from "./prisma.js";
import { assertNotTooFarPast, normalizeTime } from "./datetime.js";

/** Statuses that occupy a provider slot. */
export const BLOCKING_STATUSES = [
  "requested",
  "scheduled",
  "confirmed",
  "checked_in",
  "waiting",
  "in_consultation",
] as const;

export type BlockingStatus = (typeof BLOCKING_STATUSES)[number];

export const APPOINTMENT_TRANSITIONS: Record<string, string[]> = {
  requested: ["confirmed", "cancelled", "scheduled", "rescheduled"],
  scheduled: ["confirmed", "checked_in", "cancelled", "no_show", "rescheduled"],
  confirmed: ["checked_in", "waiting", "cancelled", "no_show", "rescheduled", "in_consultation"],
  checked_in: ["waiting", "in_consultation", "cancelled", "no_show"],
  waiting: ["in_consultation", "cancelled", "no_show", "checked_in"],
  in_consultation: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  no_show: [],
  rescheduled: [],
};

export function assertValidTransition(from: string, to: string) {
  if (from === to) return;
  const allowed = APPOINTMENT_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw Object.assign(new Error(`Invalid status transition: ${from} → ${to}.`), { status: 400 });
  }
}

export function minutesToTime(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function timeToMinutes(time: string) {
  const n = normalizeTime(time);
  const [h, m] = n.split(":").map(Number);
  return h * 60 + m;
}

export function addMinutesToTime(time: string, minutes: number) {
  return minutesToTime(timeToMinutes(time) + minutes);
}

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export async function assertActiveDoctor(doctorId: string) {
  const doctor = await prisma.staff.findUnique({ where: { id: doctorId } });
  if (!doctor || doctor.role !== "doctor" || doctor.status !== "active") {
    throw Object.assign(new Error("Doctor not found or inactive."), { status: 400 });
  }
  return doctor;
}

async function assertNotUnavailable(
  facilityId: string,
  doctorId: string,
  date: string,
  startMin: number,
  endMin: number,
) {
  const rows = await prisma.providerUnavailability.findMany({
    where: {
      facilityId,
      staffId: doctorId,
      startDate: { lte: date },
      endDate: { gte: date },
    },
  });
  for (const row of rows) {
    if (row.allDay || !row.startTime || !row.endTime) {
      throw Object.assign(new Error("Provider is unavailable on this date (leave/block)."), {
        status: 409,
      });
    }
    const uStart = timeToMinutes(row.startTime);
    const uEnd = timeToMinutes(row.endTime);
    if (rangesOverlap(startMin, endMin, uStart, uEnd)) {
      throw Object.assign(new Error("Provider is unavailable during this time (break/leave)."), {
        status: 409,
      });
    }
  }
}

async function assertWithinPublishedSlots(doctorId: string, date: string, time: string) {
  const schedules = await prisma.doctorSchedule.findMany({
    where: { doctorId, date, status: { not: "full" } },
  });
  if (schedules.length === 0) return; // walk-in / admin style when no published day

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
  if (allowed.size > 0 && !allowed.has(normalizeTime(time))) {
    throw Object.assign(
      new Error("That time is not an open slot for this doctor on the selected date."),
      { status: 409 },
    );
  }
}

/**
 * Conflict detection: exact-slot unique index + duration overlap + unavailability + published slots.
 */
export async function assertSlotAvailable(
  doctorId: string,
  date: string,
  time: string,
  opts?: { facilityId?: string; durationMinutes?: number; exceptAppointmentId?: string },
) {
  const normalized = normalizeTime(time);
  assertNotTooFarPast(date);
  const duration = opts?.durationMinutes && opts.durationMinutes > 0 ? opts.durationMinutes : 30;
  const startMin = timeToMinutes(normalized);
  const endMin = startMin + duration;

  await assertWithinPublishedSlots(doctorId, date, normalized);

  if (opts?.facilityId) {
    await assertNotUnavailable(opts.facilityId, doctorId, date, startMin, endMin);
  }

  const active = await prisma.appointment.findMany({
    where: {
      doctorId,
      date,
      status: { in: [...BLOCKING_STATUSES] },
      ...(opts?.exceptAppointmentId ? { NOT: { id: opts.exceptAppointmentId } } : {}),
    },
    select: { id: true, time: true, durationMinutes: true, endTime: true },
  });

  for (const row of active) {
    const bStart = timeToMinutes(row.time);
    const bDur = row.durationMinutes && row.durationMinutes > 0 ? row.durationMinutes : 30;
    const bEnd = row.endTime ? timeToMinutes(row.endTime) : bStart + bDur;
    if (rangesOverlap(startMin, endMin, bStart, bEnd)) {
      throw Object.assign(new Error("That doctor is already booked during this time window."), {
        status: 409,
      });
    }
  }

  return { time: normalized, endTime: minutesToTime(endMin), durationMinutes: duration };
}

export async function assertSlotAvailableExcept(
  doctorId: string,
  date: string,
  time: string,
  exceptAppointmentId: string,
  opts?: { facilityId?: string; durationMinutes?: number },
) {
  return assertSlotAvailable(doctorId, date, time, {
    ...opts,
    exceptAppointmentId,
  });
}
