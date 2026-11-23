import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../lib/audit.js";
import { dateStringSchema, timeStringSchema } from "../lib/datetime.js";
import { can } from "../lib/rbac.js";
import { prisma } from "../lib/prisma.js";
import {
  assertSameFacilityPatient,
  assertSameFacilityStaff,
  requireFacilityId,
} from "../lib/tenant.js";
import { requireAuth, requirePermission, type AuthedRequest } from "../middleware/auth.js";
import { addMinutesToTime, assertSlotAvailable } from "../lib/appointments.js";
import {
  bookAppointment,
  rescheduleAppointment,
  transitionAppointment,
} from "../services/appointments/booking.js";
import {
  callNext,
  checkInAppointment,
  createQueueEntry,
  listQueue,
  transitionQueue,
} from "../services/appointments/queue.js";

const router = Router();
router.use(requireAuth);

function canManageAppointments(role: string) {
  return can(role, "appointments.manage") || can(role, "appointments.create") || can(role, "appointments:manage");
}

function canQueueManage(role: string) {
  return (
    can(role, "queue.manage") ||
    can(role, "queue.call_next") ||
    can(role, "appointments.manage") ||
    can(role, "appointments:manage")
  );
}

/** Dashboard stats for today */
router.get("/appointments/stats", async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    if (!can(req.user!.role, "appointments.read") && !can(req.user!.role, "appointments:read_all") && !can(req.user!.role, "appointments.manage") && !can(req.user!.role, "appointments:manage") && !can(req.user!.role, "appointments:read_own")) {
      return res.status(403).json({ error: "Missing permission." });
    }
    const today = new Date().toISOString().slice(0, 10);
    const base = { facilityId, date: today };
    const [scheduled, confirmed, completed, cancelled, noShow, waiting] = await Promise.all([
      prisma.appointment.count({ where: { ...base, status: { in: ["scheduled", "requested"] } } }),
      prisma.appointment.count({ where: { ...base, status: "confirmed" } }),
      prisma.appointment.count({ where: { ...base, status: "completed" } }),
      prisma.appointment.count({ where: { ...base, status: "cancelled" } }),
      prisma.appointment.count({ where: { ...base, status: "no_show" } }),
      prisma.queueEntry.count({
        where: { facilityId, serviceDate: today, status: { in: ["waiting", "called"] } },
      }),
    ]);
    res.json({
      data: {
        date: today,
        scheduled,
        confirmed,
        completed,
        cancelled,
        noShow,
        queueWaiting: waiting,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Available slots for a doctor/date (respects bookings + unavailability). */
router.get("/appointments/availability", async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const doctorId = String(req.query.doctorId || "");
    const date = String(req.query.date || "");
    const duration = Number(req.query.durationMinutes || 30);
    if (!doctorId || !date) return res.status(400).json({ error: "doctorId and date are required." });
    await assertSameFacilityStaff(facilityId, doctorId);

    const schedules = await prisma.doctorSchedule.findMany({
      where: { facilityId, doctorId, date, status: { not: "full" } },
    });
    const candidate = new Set<string>();
    for (const s of schedules) {
      try {
        const slots = JSON.parse(s.slotsJson) as unknown;
        if (Array.isArray(slots)) {
          for (const t of slots) if (typeof t === "string") candidate.add(t);
        }
      } catch {
        /* ignore */
      }
    }
    // Default grid when no published schedule
    if (candidate.size === 0) {
      for (let h = 8; h < 17; h++) {
        candidate.add(`${String(h).padStart(2, "0")}:00`);
        candidate.add(`${String(h).padStart(2, "0")}:30`);
      }
    }

    const available: string[] = [];
    for (const time of [...candidate].sort()) {
      try {
        await assertSlotAvailable(doctorId, date, time, {
          facilityId,
          durationMinutes: Number.isFinite(duration) ? duration : 30,
        });
        available.push(time);
      } catch {
        /* occupied / unavailable */
      }
    }
    res.json({ data: { doctorId, date, durationMinutes: duration, slots: available } });
  } catch (err) {
    next(err);
  }
});

/** Calendar feed */
router.get("/appointments/calendar", async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    const doctorId = typeof req.query.doctorId === "string" ? req.query.doctorId : null;
    const dept = typeof req.query.dept === "string" ? req.query.dept : null;
    if (!from || !to) return res.status(400).json({ error: "from and to (YYYY-MM-DD) are required." });

    const rows = await prisma.appointment.findMany({
      where: {
        facilityId,
        date: { gte: from, lte: to },
        ...(doctorId ? { doctorId } : {}),
        ...(dept ? { dept } : {}),
      },
      include: {
        patient: { select: { id: true, name: true, patientNumber: true } },
        doctor: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "asc" }, { time: "asc" }],
      take: 500,
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

const bookSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  date: dateStringSchema,
  time: timeStringSchema,
  dept: z.string().min(1).max(120),
  departmentId: z.string().optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
  type: z.enum(["general", "follow_up", "specialist", "laboratory", "other"]).optional(),
  bookingSource: z.enum(["reception", "admin", "patient_portal", "walk_in", "system"]).optional(),
  durationMinutes: z.number().int().min(5).max(240).optional(),
});

router.post("/appointments/book", requirePermission("appointments.manage", "appointments.create", "appointments:manage"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const body = bookSchema.parse(req.body);
    await assertSameFacilityPatient(facilityId, body.patientId);
    await assertSameFacilityStaff(facilityId, body.doctorId);

    const row = await bookAppointment({
      facilityId,
      patientId: body.patientId,
      doctorId: body.doctorId,
      date: body.date,
      time: body.time,
      dept: body.dept,
      departmentId: body.departmentId,
      reason: body.reason,
      type: body.type,
      bookingSource: body.bookingSource || "reception",
      durationMinutes: body.durationMinutes,
      createdById: req.user!.sub,
      initialStatus: "confirmed",
    });

    await writeAudit({
      actorId: req.user!.sub,
      facilityId,
      action: "appointment.book",
      entity: row.id,
      meta: { appointmentNumber: row.appointmentNumber, date: row.date, time: row.time },
      req,
    });

    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

router.post("/appointments/:id/reschedule", requirePermission("appointments.manage", "appointments.reschedule", "appointments:manage", "appointments:write_own"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const id = String(req.params.id);
    const body = z
      .object({
        doctorId: z.string().min(1),
        date: dateStringSchema,
        time: timeStringSchema,
        durationMinutes: z.number().int().min(5).max(240).optional(),
        reason: z.string().max(500).optional().nullable(),
      })
      .parse(req.body);
    await assertSameFacilityStaff(facilityId, body.doctorId);

    const existing = await prisma.appointment.findFirst({ where: { id, facilityId } });
    if (!existing) return res.status(404).json({ error: "Appointment not found." });
    if (
      req.user!.role === "doctor" &&
      existing.doctorId !== req.user!.staffId &&
      !canManageAppointments(req.user!.role)
    ) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const row = await rescheduleAppointment({
      facilityId,
      appointmentId: id,
      doctorId: body.doctorId,
      date: body.date,
      time: body.time,
      durationMinutes: body.durationMinutes,
      actorId: req.user!.sub,
      reason: body.reason,
    });
    await writeAudit({
      actorId: req.user!.sub,
      facilityId,
      action: "appointment.reschedule",
      entity: id,
      req,
    });
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

router.post("/appointments/:id/cancel", requirePermission("appointments.manage", "appointments.cancel", "appointments:manage", "appointments:write_own", "appointments:request"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const id = String(req.params.id);
    const body = z.object({ reason: z.string().max(500).optional().nullable() }).parse(req.body || {});
    const existing = await prisma.appointment.findFirst({ where: { id, facilityId } });
    if (!existing) return res.status(404).json({ error: "Appointment not found." });

    const row = await transitionAppointment({
      facilityId,
      appointmentId: id,
      toStatus: "cancelled",
      actorId: req.user!.sub,
      cancelReason: body.reason,
    });
    await writeAudit({
      actorId: req.user!.sub,
      facilityId,
      action: "appointment.cancel",
      entity: id,
      req,
    });
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

router.post("/appointments/:id/check-in", requirePermission("queue.checkin", "queue.manage", "appointments.manage", "appointments:manage"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const id = String(req.params.id);
    const body = z.object({ priority: z.enum(["normal", "urgent", "follow_up"]).optional() }).parse(req.body || {});
    const result = await checkInAppointment({
      facilityId,
      appointmentId: id,
      actorId: req.user!.sub,
      priority: body.priority,
    });
    if (!result) return res.status(404).json({ error: "Appointment not found." });
    await writeAudit({
      actorId: req.user!.sub,
      facilityId,
      action: "appointment.check_in",
      entity: id,
      meta: { duplicate: result.duplicate },
      req,
    });
    res.status(result.duplicate ? 200 : 201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

router.get("/appointments/:id/history", async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const id = String(req.params.id);
    const appt = await prisma.appointment.findFirst({ where: { id, facilityId } });
    if (!appt) return res.status(404).json({ error: "Appointment not found." });
    const events = await prisma.appointmentStatusEvent.findMany({
      where: { appointmentId: id, facilityId },
      orderBy: { createdAt: "asc" },
    });
    res.json({ data: events });
  } catch (err) {
    next(err);
  }
});

/** Walk-in: create appointment + queue in one flow */
router.post("/walk-ins", requirePermission("appointments.manage", "appointments:manage", "queue.manage"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const body = z
      .object({
        patientId: z.string().min(1),
        doctorId: z.string().min(1),
        dept: z.string().min(1).max(120),
        reason: z.string().max(500).optional().nullable(),
        priority: z.enum(["normal", "urgent", "follow_up"]).optional(),
        durationMinutes: z.number().int().min(5).max(240).optional(),
      })
      .parse(req.body);

    await assertSameFacilityPatient(facilityId, body.patientId);
    await assertSameFacilityStaff(facilityId, body.doctorId);

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    // Snap to next 5-minute boundary for walk-in start
    const mins = now.getHours() * 60 + now.getMinutes();
    const snapped = Math.ceil(mins / 5) * 5;
    const time = `${String(Math.floor(snapped / 60) % 24).padStart(2, "0")}:${String(snapped % 60).padStart(2, "0")}`;

    const appt = await bookAppointment({
      facilityId,
      patientId: body.patientId,
      doctorId: body.doctorId,
      date,
      time,
      dept: body.dept,
      reason: body.reason,
      type: "general",
      bookingSource: "walk_in",
      durationMinutes: body.durationMinutes || 20,
      createdById: req.user!.sub,
      initialStatus: "checked_in",
    });

    await transitionAppointment({
      facilityId,
      appointmentId: appt.id,
      toStatus: "waiting",
      actorId: req.user!.sub,
    }).catch(() => null);

    const queue = await createQueueEntry({
      facilityId,
      patientId: body.patientId,
      appointmentId: appt.id,
      departmentKey: body.dept,
      doctorId: body.doctorId,
      serviceDate: date,
      priority: body.priority || "normal",
      createdById: req.user!.sub,
    });

    await writeAudit({
      actorId: req.user!.sub,
      facilityId,
      action: "walk_in.create",
      entity: appt.id,
      meta: { queueNumber: queue.queueNumber },
      req,
    });

    res.status(201).json({ data: { appointment: appt, queue } });
  } catch (err) {
    next(err);
  }
});

/** Queue board */
router.get("/queue", async (req: AuthedRequest, res, next) => {
  try {
    if (!can(req.user!.role, "queue.read") && !canQueueManage(req.user!.role) && !can(req.user!.role, "appointments.read")) {
      return res.status(403).json({ error: "Missing queue permission." });
    }
    const facilityId = requireFacilityId(req);
    const serviceDate = String(req.query.date || new Date().toISOString().slice(0, 10));
    const departmentKey = typeof req.query.dept === "string" ? req.query.dept : null;
    const doctorId = typeof req.query.doctorId === "string" ? req.query.doctorId : null;
    const rows = await listQueue({ facilityId, serviceDate, departmentKey, doctorId });

    // Public-safe projection: no clinical notes
    const patients = await prisma.patient.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.patientId))] }, facilityId },
      select: { id: true, name: true, patientNumber: true },
    });
    const byId = Object.fromEntries(patients.map((p) => [p.id, p]));
    const data = rows.map((r) => ({
      ...r,
      patient: byId[r.patientId] || { id: r.patientId, name: "Patient", patientNumber: null },
      waitingMinutes: Math.max(0, Math.round((Date.now() - r.arrivalTime.getTime()) / 60000)),
    }));
    res.json({ data, meta: { serviceDate, since: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

router.post("/queue/call-next", requirePermission("queue.call_next", "queue.manage", "appointments.manage", "appointments:manage"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const body = z
      .object({
        dept: z.string().min(1),
        date: dateStringSchema.optional(),
        doctorId: z.string().optional().nullable(),
      })
      .parse(req.body);
    const entry = await callNext({
      facilityId,
      serviceDate: body.date || new Date().toISOString().slice(0, 10),
      departmentKey: body.dept,
      doctorId: body.doctorId,
      actorId: req.user!.sub,
    });
    if (!entry) return res.status(404).json({ error: "No waiting patients in this queue." });
    await writeAudit({
      actorId: req.user!.sub,
      facilityId,
      action: "queue.call_next",
      entity: entry.id,
      req,
    });
    res.json({ data: entry });
  } catch (err) {
    next(err);
  }
});

router.post("/queue/:id/transition", requirePermission("queue.manage", "queue.call_next", "appointments.manage", "appointments:manage"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const id = String(req.params.id);
    const body = z
      .object({
        status: z.enum(["waiting", "called", "in_service", "completed", "skipped", "cancelled"]),
        skipReason: z.string().max(400).optional().nullable(),
      })
      .parse(req.body);
    const row = await transitionQueue({
      facilityId,
      queueId: id,
      toStatus: body.status,
      actorId: req.user!.sub,
      skipReason: body.skipReason,
    });
    if (!row) return res.status(404).json({ error: "Queue entry not found." });
    await writeAudit({
      actorId: req.user!.sub,
      facilityId,
      action: "queue.transition",
      entity: id,
      meta: { status: body.status },
      req,
    });
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

/** Provider unavailability CRUD */
router.get("/schedules/unavailability", requirePermission("schedules.read", "schedule.read", "schedule:read", "schedules.manage", "schedule.manage", "schedule:write"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const staffId = typeof req.query.staffId === "string" ? req.query.staffId : null;
    const rows = await prisma.providerUnavailability.findMany({
      where: { facilityId, ...(staffId ? { staffId } : {}) },
      orderBy: { startDate: "desc" },
      take: 200,
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/schedules/unavailability", requirePermission("schedules.manage", "schedule.manage", "schedule:write"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const body = z
      .object({
        staffId: z.string().min(1),
        startDate: dateStringSchema,
        endDate: dateStringSchema,
        startTime: timeStringSchema.optional().nullable(),
        endTime: timeStringSchema.optional().nullable(),
        allDay: z.boolean().optional(),
        reason: z.string().max(400).optional().nullable(),
      })
      .parse(req.body);
    await assertSameFacilityStaff(facilityId, body.staffId);
    const row = await prisma.providerUnavailability.create({
      data: {
        facilityId,
        staffId: body.staffId,
        startDate: body.startDate,
        endDate: body.endDate,
        startTime: body.startTime || null,
        endTime: body.endTime || null,
        allDay: body.allDay ?? !(body.startTime && body.endTime),
        reason: body.reason || null,
        createdById: req.user!.sub,
      },
    });
    await writeAudit({
      actorId: req.user!.sub,
      facilityId,
      action: "schedule.unavailability_create",
      entity: row.id,
      req,
    });
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

/** Upsert doctor day slots (schedule.manage) */
router.put("/schedules/doctor-day", requirePermission("schedules.manage", "schedule.manage", "schedule:write", "schedule.publish"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const body = z
      .object({
        doctorId: z.string().min(1),
        date: dateStringSchema,
        day: z.string().min(1).max(20),
        specialty: z.string().min(1).max(120),
        room: z.string().min(1).max(80),
        slots: z.array(timeStringSchema).min(1).max(48),
        status: z.enum(["open", "limited", "full"]).optional(),
      })
      .parse(req.body);
    await assertSameFacilityStaff(facilityId, body.doctorId);

    const existing = await prisma.doctorSchedule.findFirst({
      where: { facilityId, doctorId: body.doctorId, date: body.date },
    });
    const slotsJson = JSON.stringify(body.slots.map((t) => t));
    const row = existing
      ? await prisma.doctorSchedule.update({
          where: { id: existing.id },
          data: {
            day: body.day,
            specialty: body.specialty,
            room: body.room,
            slotsJson,
            status: body.status || "open",
          },
        })
      : await prisma.doctorSchedule.create({
          data: {
            facilityId,
            doctorId: body.doctorId,
            date: body.date,
            day: body.day,
            specialty: body.specialty,
            room: body.room,
            slotsJson,
            status: body.status || "open",
          },
        });

    await writeAudit({
      actorId: req.user!.sub,
      facilityId,
      action: "schedule.doctor_day_upsert",
      entity: row.id,
      req,
    });
    res.json({
      data: {
        ...row,
        slots: body.slots,
        endHint: body.slots.map((t) => addMinutesToTime(t, 30)),
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Lightweight poll channel for queue (realtime fallback). */
router.get("/queue/events", async (req: AuthedRequest, res, next) => {
  try {
    if (!can(req.user!.role, "queue.read") && !canQueueManage(req.user!.role)) {
      return res.status(403).json({ error: "Missing queue permission." });
    }
    const facilityId = requireFacilityId(req);
    const since = typeof req.query.since === "string" ? new Date(req.query.since) : new Date(Date.now() - 60000);
    const serviceDate = String(req.query.date || new Date().toISOString().slice(0, 10));
    const rows = await prisma.queueEntry.findMany({
      where: {
        facilityId,
        serviceDate,
        updatedAt: { gt: since },
      },
      orderBy: { updatedAt: "asc" },
      take: 100,
      select: {
        id: true,
        queueNumber: true,
        status: true,
        departmentKey: true,
        priority: true,
        updatedAt: true,
        patientId: true,
      },
    });
    res.json({
      data: rows,
      meta: {
        mode: "polling",
        note: "No WebSocket server in this monolith yet — poll this endpoint.",
        serverTime: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
