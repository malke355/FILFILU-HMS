import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { can } from "../lib/rbac.js";
import { requireAuth, requirePermission, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/staff", requirePermission("staff:read", "schedule:read_own"), async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    if (can(u.role, "staff:read")) {
      const rows = await prisma.staff.findMany({ orderBy: { name: "asc" } });
      return res.json({ data: rows });
    }
    const rows = u.staffId
      ? await prisma.staff.findMany({ where: { id: u.staffId } })
      : [];
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.get("/patients", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    let where = {};
    if (can(u.role, "patients:read_all")) where = {};
    else if (can(u.role, "patients:read_assigned")) where = { doctorId: u.staffId ?? "__none__" };
    else if (can(u.role, "patients:read_ward")) where = { ward: u.ward ?? "__none__" };
    else if (can(u.role, "profile:read_own")) where = { id: u.patientId ?? "__none__" };
    else return res.status(403).json({ error: "Missing permission." });

    const rows = await prisma.patient.findMany({
      where,
      include: { doctor: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.get("/appointments", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    let where = {};
    if (can(u.role, "appointments:read_all")) where = {};
    else if (u.role === "doctor") where = { doctorId: u.staffId ?? "__none__" };
    else if (u.role === "nurse") {
      const wardPatients = await prisma.patient.findMany({
        where: { ward: u.ward ?? "__none__" },
        select: { id: true },
      });
      where = { patientId: { in: wardPatients.map((p) => p.id) } };
    } else if (u.role === "patient") where = { patientId: u.patientId ?? "__none__" };
    else return res.status(403).json({ error: "Missing permission." });

    const rows = await prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true } },
        doctor: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/appointments", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    if (!can(u.role, "appointments:request") && !can(u.role, "appointments:manage") && !can(u.role, "appointments:write_own")) {
      return res.status(403).json({ error: "Missing permission." });
    }
    const body = z.object({
      patientId: z.string().optional(),
      doctorId: z.string(),
      date: z.string(),
      time: z.string(),
      dept: z.string(),
      reason: z.string().optional(),
    }).parse(req.body);

    const patientId = u.role === "patient" ? u.patientId : body.patientId;
    if (!patientId) return res.status(400).json({ error: "patientId required." });

    const row = await prisma.appointment.create({
      data: {
        patientId,
        doctorId: body.doctorId,
        date: body.date,
        time: body.time,
        dept: body.dept,
        reason: body.reason,
        status: u.role === "patient" ? "requested" : "confirmed",
      },
    });
    await prisma.auditLog.create({
      data: { actorId: u.sub, action: "appointment.create", entity: row.id },
    });
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

router.get("/shifts", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    let where = {};
    if (can(u.role, "schedule:read") || can(u.role, "schedule:write")) where = {};
    else if (can(u.role, "schedule:read_own")) where = { staffId: u.staffId ?? "__none__" };
    else return res.status(403).json({ error: "Missing permission." });

    const rows = await prisma.shift.findMany({
      where,
      include: { staff: { select: { id: true, name: true } } },
      orderBy: [{ date: "asc" }, { slot: "asc" }],
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.patch("/shifts/:id/publish", requirePermission("schedule:publish"), async (req: AuthedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const row = await prisma.shift.update({
      where: { id },
      data: { status: "published" },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, action: "shift.publish", entity: row.id },
    });
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

router.get("/exchanges", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    let where = {};
    if (can(u.role, "exchanges:approve")) where = {};
    else if (can(u.role, "exchanges:request")) {
      where = {
        OR: [{ fromStaffId: u.staffId ?? "__none__" }, { toStaffId: u.staffId ?? "__none__" }],
      };
    } else return res.status(403).json({ error: "Missing permission." });

    const rows = await prisma.exchange.findMany({
      where,
      include: {
        fromStaff: { select: { id: true, name: true } },
        toStaff: { select: { id: true, name: true } },
      },
      orderBy: { date: "asc" },
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.patch("/exchanges/:id", requirePermission("exchanges:approve", "exchanges:request"), async (req: AuthedRequest, res, next) => {
  try {
    const body = z.object({
      status: z.enum(["pending_peer", "peer_accepted", "pending_admin", "approved", "denied"]),
    }).parse(req.body);
    const u = req.user!;
    if (["approved", "denied"].includes(body.status) && !can(u.role, "exchanges:approve")) {
      return res.status(403).json({ error: "Only admin can approve/deny." });
    }
    const id = String(req.params.id);
    const row = await prisma.exchange.update({
      where: { id },
      data: { status: body.status },
    });
    await prisma.auditLog.create({
      data: { actorId: u.sub, action: "exchange.update", entity: row.id, metaJson: JSON.stringify(body) },
    });
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

router.get("/notifications", requirePermission("notifications:read_own"), async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    const rows = await prisma.notification.findMany({
      where: {
        OR: [{ userId: u.sub }, { role: u.role }],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.get("/reports/summary", requirePermission("reports:read"), async (_req, res, next) => {
  try {
    const [staff, publishedShifts, openAppointments, pendingExchanges, patients] = await Promise.all([
      prisma.staff.count({ where: { status: "active" } }),
      prisma.shift.count({ where: { status: "published" } }),
      prisma.appointment.count({ where: { status: { not: "draft" } } }),
      prisma.exchange.count({ where: { status: { not: "approved" } } }),
      prisma.patient.count(),
    ]);
    res.json({
      data: {
        activeStaff: staff,
        publishedShifts,
        openAppointments,
        pendingExchanges,
        patients,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/dashboard/stats", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    if (u.role === "admin") {
      const [activeStaff, publishedShifts, openAppointments, pendingExchanges] = await Promise.all([
        prisma.staff.count({ where: { status: "active" } }),
        prisma.shift.count({ where: { status: "published" } }),
        prisma.appointment.count({ where: { status: { not: "draft" } } }),
        prisma.exchange.count({ where: { status: { not: "approved" } } }),
      ]);
      return res.json({
        data: [
          { label: "Active staff", value: activeStaff, hint: "Across all units" },
          { label: "Published shifts", value: publishedShifts, hint: "This roster cycle" },
          { label: "Open visits", value: openAppointments, hint: "Hospital-wide" },
          { label: "Pending approvals", value: pendingExchanges, hint: "Needs admin action" },
        ],
      });
    }

    if (u.role === "doctor") {
      const [patients, shifts, confirmed, notes] = await Promise.all([
        prisma.patient.count({ where: { doctorId: u.staffId ?? "__none__" } }),
        prisma.shift.count({ where: { staffId: u.staffId ?? "__none__" } }),
        prisma.appointment.count({ where: { doctorId: u.staffId ?? "__none__", status: "confirmed" } }),
        prisma.notification.count({ where: { OR: [{ userId: u.sub }, { role: "doctor" }] } }),
      ]);
      return res.json({
        data: [
          { label: "Assigned patients", value: patients, hint: "Under your care" },
          { label: "Shifts this week", value: shifts, hint: "Your roster" },
          { label: "Confirmed visits", value: confirmed, hint: "Clinic load" },
          { label: "Unread alerts", value: notes, hint: "Action items" },
        ],
      });
    }

    if (u.role === "nurse") {
      const [patients, shifts, appts, notes] = await Promise.all([
        prisma.patient.count({ where: { ward: u.ward ?? "__none__" } }),
        prisma.shift.count({ where: { staffId: u.staffId ?? "__none__" } }),
        prisma.appointment.count({
          where: { patient: { ward: u.ward ?? "__none__" } },
        }),
        prisma.notification.count({ where: { OR: [{ userId: u.sub }, { role: "nurse" }] } }),
      ]);
      return res.json({
        data: [
          { label: "Ward patients", value: patients, hint: u.ward || "Your ward" },
          { label: "My shifts", value: shifts, hint: "Published + draft" },
          { label: "Clinic list", value: appts, hint: "Ward-linked visits" },
          { label: "Handoffs", value: notes, hint: "Nursing alerts" },
        ],
      });
    }

    const [visits, confirmed, requested, specialties] = await Promise.all([
      prisma.appointment.count({ where: { patientId: u.patientId ?? "__none__" } }),
      prisma.appointment.count({ where: { patientId: u.patientId ?? "__none__", status: "confirmed" } }),
      prisma.appointment.count({ where: { patientId: u.patientId ?? "__none__", status: "requested" } }),
      prisma.doctorSchedule.findMany({ select: { specialty: true }, distinct: ["specialty"] }),
    ]);
    const openSlots = await prisma.doctorSchedule.findMany({ where: { status: { not: "full" } } });
    const slotCount = openSlots.reduce((n, s) => n + (JSON.parse(s.slotsJson) as string[]).length, 0);
    res.json({
      data: [
        { label: "My visits", value: visits, hint: "All statuses" },
        { label: "Confirmed", value: confirmed, hint: "Ready to attend" },
        { label: "Specialties", value: specialties.length, hint: "With open clinics" },
        { label: "Open slots", value: slotCount, hint: "Bookable this week" },
      ],
    });
  } catch (err) {
    next(err);
  }
});

export default router;
