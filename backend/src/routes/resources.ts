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

/** Admin: update staff role/department/status (deactivate instead of delete). */
router.patch("/staff/:id", requirePermission("staff:write"), async (req: AuthedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const body = z.object({
      role: z.string().min(1).optional(),
      dept: z.string().min(1).optional(),
      ward: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      status: z.enum(["active", "inactive"]).optional(),
      name: z.string().min(1).optional(),
    }).parse(req.body);

    if (req.user!.staffId && req.user!.staffId === id && body.status === "inactive") {
      return res.status(400).json({ error: "You cannot deactivate your own staff account." });
    }

    const existing = await prisma.staff.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Staff not found." });

    const row = await prisma.staff.update({
      where: { id },
      data: {
        ...(body.role ? { role: body.role } : {}),
        ...(body.dept ? { dept: body.dept } : {}),
        ...(body.ward !== undefined ? { ward: body.ward } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.name ? { name: body.name } : {}),
      },
    });

    // Keep linked user role/dept in sync when staff assignment changes.
    if (body.role || body.dept || body.ward !== undefined) {
      await prisma.user.updateMany({
        where: { staffId: id },
        data: {
          ...(body.role ? { role: body.role } : {}),
          ...(body.dept ? { dept: body.dept } : {}),
          ...(body.ward !== undefined ? { ward: body.ward } : {}),
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.sub,
        action: body.status === "inactive" ? "staff.deactivate" : body.status === "active" ? "staff.reactivate" : "staff.update",
        entity: row.id,
        metaJson: JSON.stringify(body),
      },
    });
    res.json({ data: row });
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
    let where: Record<string, unknown> = {};
    if (can(u.role, "schedule:read") || can(u.role, "schedule:write")) {
      // Admin / schedulers see drafts + published.
      where = {};
    } else if (can(u.role, "schedule:read_own")) {
      // Doctors/nurses only see their own published roster (drafts stay hidden).
      where = { staffId: u.staffId ?? "__none__", status: "published" };
    } else {
      return res.status(403).json({ error: "Missing permission." });
    }

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

router.post("/exchanges", requirePermission("exchanges:request"), async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    if (!u.staffId) return res.status(400).json({ error: "Staff profile required." });
    const body = z.object({
      toStaffId: z.string().min(1),
      date: z.string().min(1),
      reason: z.string().optional(),
    }).parse(req.body);
    if (body.toStaffId === u.staffId) {
      return res.status(400).json({ error: "Cannot request a swap with yourself." });
    }
    const [fromStaff, toStaff] = await Promise.all([
      prisma.staff.findUnique({ where: { id: u.staffId } }),
      prisma.staff.findUnique({ where: { id: body.toStaffId } }),
    ]);
    if (!toStaff || toStaff.status !== "active") {
      return res.status(400).json({ error: "Colleague not found or inactive." });
    }
    if (fromStaff && toStaff.role !== fromStaff.role) {
      return res.status(400).json({ error: "Swaps must be with the same role." });
    }
    if (fromStaff?.dept && toStaff.dept && fromStaff.dept !== toStaff.dept) {
      return res.status(400).json({ error: "Swaps must stay within the same department." });
    }
    const row = await prisma.exchange.create({
      data: {
        fromStaffId: u.staffId,
        toStaffId: body.toStaffId,
        date: body.date,
        reason: body.reason,
        status: "pending_peer",
      },
    });
    await prisma.auditLog.create({
      data: { actorId: u.sub, action: "exchange.create", entity: row.id, metaJson: JSON.stringify(body) },
    });
    res.status(201).json({ data: row });
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
    const id = String(req.params.id);
    const existing = await prisma.exchange.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Exchange not found." });

    const isAdmin = can(u.role, "exchanges:approve");
    const isPeer = existing.toStaffId === u.staffId;
    const isRequester = existing.fromStaffId === u.staffId;

    // Doctors cannot approve their own swap / leave — only the peer or admin acts.
    if (isRequester && !isAdmin) {
      return res.status(403).json({ error: "You cannot approve or decide your own swap request." });
    }

    let nextStatus = body.status;
    if (["approved", "denied"].includes(nextStatus)) {
      if (isAdmin) {
        /* final admin decision */
      } else if (isPeer && existing.status === "pending_peer" && nextStatus === "denied") {
        /* peer declines the swap */
      } else {
        return res.status(403).json({ error: "Only admin can give the final approve/deny." });
      }
    } else if (["peer_accepted", "pending_admin"].includes(nextStatus)) {
      if (!isPeer && !isAdmin) {
        return res.status(403).json({ error: "Only the requested colleague can accept this swap." });
      }
      if (existing.status !== "pending_peer" && !isAdmin) {
        return res.status(400).json({ error: "Swap is not waiting on peer response." });
      }
      // Peer accept moves the request to admin review.
      if (nextStatus === "peer_accepted") nextStatus = "pending_admin";
    } else if (!isAdmin) {
      return res.status(403).json({ error: "Missing permission." });
    }

    const row = await prisma.exchange.update({
      where: { id },
      data: { status: nextStatus },
    });
    await prisma.auditLog.create({
      data: {
        actorId: u.sub,
        action: "exchange.update",
        entity: row.id,
        metaJson: JSON.stringify({ ...body, status: nextStatus }),
      },
    });
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

router.post("/exchanges/approve-pending", requirePermission("exchanges:approve"), async (req: AuthedRequest, res, next) => {
  try {
    const pending = await prisma.exchange.findMany({
      where: { status: { in: ["pending_peer", "peer_accepted", "pending_admin"] } },
    });
    const ids = pending.map((e) => e.id);
    if (ids.length) {
      await prisma.exchange.updateMany({
        where: { id: { in: ids } },
        data: { status: "approved" },
      });
      await prisma.auditLog.create({
        data: {
          actorId: req.user!.sub,
          action: "exchange.approve_pending",
          metaJson: JSON.stringify({ count: ids.length, ids }),
        },
      });
    }
    res.json({ data: { approved: ids.length } });
  } catch (err) {
    next(err);
  }
});

router.post("/shifts/publish-drafts", requirePermission("schedule:publish"), async (req: AuthedRequest, res, next) => {
  try {
    const result = await prisma.shift.updateMany({
      where: { status: "draft" },
      data: { status: "published" },
    });
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.sub,
        action: "shift.publish_drafts",
        metaJson: JSON.stringify({ count: result.count }),
      },
    });
    res.json({ data: { published: result.count } });
  } catch (err) {
    next(err);
  }
});

router.patch("/appointments/:id", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    const id = String(req.params.id);
    const body = z.object({
      status: z.enum(["draft", "requested", "confirmed", "cancelled", "completed", "no_show"]).optional(),
      date: z.string().optional(),
      time: z.string().optional(),
      reason: z.string().optional(),
      doctorId: z.string().optional(),
      dept: z.string().optional(),
    }).parse(req.body);

    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Appointment not found." });

    const isAdminOps = can(u.role, "appointments:manage");
    const isDoctorOwner = u.role === "doctor" && existing.doctorId === u.staffId;
    const isPatientCancel =
      u.role === "patient" &&
      existing.patientId === u.patientId &&
      body.status === "cancelled" &&
      !body.date &&
      !body.time &&
      !body.doctorId;
    const allowed = isAdminOps || isDoctorOwner || isPatientCancel;
    if (!allowed) return res.status(403).json({ error: "Missing permission." });

    // Admins run the system: cancel / reassign only — not clinical confirm/complete/no-show.
    if (isAdminOps && !isDoctorOwner && body.status && !["cancelled", "draft"].includes(body.status)) {
      return res.status(403).json({
        error: "Admins cannot change clinical appointment status. Cancel or reassign instead.",
      });
    }

    if (body.doctorId && isAdminOps) {
      const doctor = await prisma.staff.findUnique({ where: { id: body.doctorId } });
      if (!doctor || doctor.role !== "doctor" || doctor.status !== "active") {
        return res.status(400).json({ error: "Reassign target must be an active doctor." });
      }
    }

    const row = await prisma.appointment.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.date ? { date: body.date } : {}),
        ...(body.time ? { time: body.time } : {}),
        ...(body.reason !== undefined ? { reason: body.reason } : {}),
        ...(body.doctorId ? { doctorId: body.doctorId } : {}),
        ...(body.dept ? { dept: body.dept } : {}),
      },
    });
    await prisma.auditLog.create({
      data: { actorId: u.sub, action: "appointment.update", entity: row.id, metaJson: JSON.stringify(body) },
    });
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

/**
 * Admin: cancel duplicate appointment requests (same patient/doctor/date/time/reason),
 * keeping the oldest row in each group.
 */
router.post("/appointments/cleanup-duplicates", requirePermission("appointments:manage"), async (req: AuthedRequest, res, next) => {
  try {
    const rows = await prisma.appointment.findMany({
      where: { status: { in: ["requested", "confirmed"] } },
      orderBy: { createdAt: "asc" },
    });
    const seen = new Map<string, string>();
    const cancelIds: string[] = [];
    for (const row of rows) {
      const key = [row.patientId, row.doctorId, row.date, row.time, row.reason || "", row.status].join("|");
      if (seen.has(key)) cancelIds.push(row.id);
      else seen.set(key, row.id);
    }
    if (cancelIds.length) {
      await prisma.appointment.updateMany({
        where: { id: { in: cancelIds } },
        data: { status: "cancelled" },
      });
      await prisma.auditLog.create({
        data: {
          actorId: req.user!.sub,
          action: "appointment.cleanup_duplicates",
          metaJson: JSON.stringify({ cancelled: cancelIds.length, ids: cancelIds }),
        },
      });
    }
    res.json({ data: { cancelled: cancelIds.length, kept: seen.size } });
  } catch (err) {
    next(err);
  }
});

router.get("/activity", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    const rows = await prisma.auditLog.findMany({
      where: can(u.role, "reports:read") ? undefined : { actorId: u.sub },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json({
      data: rows.map((r) => ({
        id: r.id,
        text: r.action.replaceAll(".", " · "),
        entity: r.entity,
        time: r.createdAt.toISOString(),
        role: u.role,
      })),
    });
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
