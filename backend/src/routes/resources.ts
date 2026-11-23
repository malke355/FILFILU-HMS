import { Router } from "express";
import { z } from "zod";
import { assertActiveDoctor, assertSlotAvailable, assertSlotAvailableExcept, BLOCKING_STATUSES } from "../lib/appointments.js";
import { writeAudit } from "../lib/audit.js";
import { hashPassword } from "../lib/auth.js";
import { dateStringSchema, timeStringSchema } from "../lib/datetime.js";
import { pageMeta, parsePage } from "../lib/pagination.js";
import { prisma } from "../lib/prisma.js";
import { can, canAccessClinicalNotes } from "../lib/rbac.js";
import { ADMIN_CREATABLE_ROLES, assertNotPlatformPrivilegeGrant, isPlatformRole } from "../lib/roles.js";
import { bumpTokenVersionForStaff } from "../lib/session.js";
import { revokeAllUserSessions } from "../lib/authSession.js";
import {
  assertSameFacilityPatient,
  assertSameFacilityStaff,
  requireFacilityId,
} from "../lib/tenant.js";
import { requireAuth, requirePermission, type AuthedRequest } from "../middleware/auth.js";
import { allocateAppointmentNumber } from "../services/appointments/numbering.js";
import { recordStatusEvent } from "../services/appointments/booking.js";

const router = Router();

router.use(requireAuth);

router.get("/staff", requirePermission("staff:read", "schedule:read_own"), async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    const facilityId = requireFacilityId(req);
    const { page, limit, skip } = parsePage(req);
    if (can(u.role, "staff:read")) {
      const where = { facilityId };
      const [total, rows] = await Promise.all([
        prisma.staff.count({ where }),
        prisma.staff.findMany({ where, orderBy: { name: "asc" }, skip, take: limit }),
      ]);
      return res.json({ data: rows, meta: pageMeta(total, page, limit) });
    }
    const rows = u.staffId
      ? await prisma.staff.findMany({ where: { id: u.staffId, facilityId } })
      : [];
    res.json({ data: rows, meta: pageMeta(rows.length, 1, limit) });
  } catch (err) {
    next(err);
  }
});

const createStaffAccountSchema = z
  .object({
    first: z.string().min(1).max(80),
    last: z.string().min(1).max(80),
    email: z.string().email(),
    password: z.string().min(6).max(128),
    role: z.enum(ADMIN_CREATABLE_ROLES),
    dept: z.string().min(1).max(120).optional(),
    /** Nurses must get an explicit ward from the admin — never copied from another nurse. */
    ward: z.string().max(120).nullable().optional(),
    phone: z.string().max(40).nullable().optional(),
    title: z.string().max(120).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.role === "nurse" && !val.ward?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["ward"],
        message: "Ward is required when registering a nurse. Do not leave it blank.",
      });
    }
  });

/**
 * Admin-only: register a doctor or nurse (login credentials).
 * Public signup cannot create these roles.
 * Nurse ward is only what the admin sets — never inherited from seed/other nurses.
 */
router.post("/staff/accounts", requirePermission("staff:write", "roles:assign"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    // Reject mass-assignment of platform privileges from facility admins.
    const raw = req.body as Record<string, unknown>;
    if (raw?.platformRole || isPlatformRole(raw?.role) || isPlatformRole(String(raw?.platformRole || ""))) {
      assertNotPlatformPrivilegeGrant(String(raw?.platformRole || raw?.role || "super_admin"));
    }
    const body = createStaffAccountSchema.parse(req.body);
    assertNotPlatformPrivilegeGrant(body.role);
    const email = body.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: "An account with this email already exists." });

    const name = `${body.first} ${body.last}`.trim();
    const dept =
      body.dept?.trim() ||
      (body.role === "doctor" ? "General Medicine" : "Nursing");
    // Explicit assignment only — doctors have no ward; nurses require admin-provided ward.
    const ward = body.role === "nurse" ? body.ward!.trim() : null;
    const title = body.title?.trim() || (body.role === "doctor" ? "Doctor" : "Nurse");

    const staff = await prisma.staff.create({
      data: {
        facilityId,
        name,
        role: body.role,
        dept,
        ward,
        phone: body.phone ?? null,
        status: "active",
      },
    });

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: body.role,
        title,
        defaultFacilityId: facilityId,
        staffId: staff.id,
        patientId: null,
        ward,
        dept,
      },
    });

    await prisma.facilityMembership.create({
      data: {
        userId: user.id,
        facilityId,
        role: body.role,
        status: "active",
        staffId: staff.id,
        title,
        ward,
        dept,
      },
    });

    await writeAudit({
      actorId: req.user!.sub,
      facilityId,
      action: "staff.create_account",
      entity: staff.id,
      meta: { email, role: body.role, dept, ward },
    });

    res.status(201).json({
      data: {
        staff,
        user: {
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          title: user.title,
          staffId: user.staffId,
          dept: user.dept,
          ward: user.ward,
          facilityId,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Admin: update staff role/department/status (deactivate instead of delete). */
router.patch("/staff/:id", requirePermission("staff:write"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const id = String(req.params.id);
    const body = z.object({
      role: z.enum(ADMIN_CREATABLE_ROLES).optional(),
      dept: z.string().min(1).optional(),
      ward: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      status: z.enum(["active", "inactive"]).optional(),
      name: z.string().min(1).optional(),
    }).parse(req.body);

    if (req.user!.staffId && req.user!.staffId === id && body.status === "inactive") {
      return res.status(400).json({ error: "You cannot deactivate your own staff account." });
    }
    if (req.user!.staffId && req.user!.staffId === id && body.role) {
      return res.status(403).json({ error: "You cannot change your own role." });
    }
    if (body.role) assertNotPlatformPrivilegeGrant(body.role);

    const existing = await prisma.staff.findFirst({ where: { id, facilityId } });
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

    // Keep linked user claims in sync; revoke JWTs when role/status/assignment changes.
    const claimChanged =
      Boolean(body.role) ||
      Boolean(body.status) ||
      body.dept !== undefined ||
      body.ward !== undefined;

    if (body.role || body.dept || body.ward !== undefined) {
      await prisma.user.updateMany({
        where: { staffId: id },
        data: {
          ...(body.role ? { role: body.role } : {}),
          ...(body.dept ? { dept: body.dept } : {}),
          ...(body.ward !== undefined ? { ward: body.ward } : {}),
          ...(body.status === "inactive" ? { status: "inactive" } : {}),
          ...(body.status === "active" ? { status: "active" } : {}),
          ...(claimChanged ? { tokenVersion: { increment: 1 } } : {}),
        },
      });
      if (body.status === "inactive") {
        const linked = await prisma.user.findFirst({ where: { staffId: id }, select: { id: true } });
        if (linked) await revokeAllUserSessions(linked.id);
      }
    } else if (body.status) {
      await prisma.user.updateMany({
        where: { staffId: id },
        data: {
          status: body.status === "inactive" ? "inactive" : "active",
          tokenVersion: { increment: 1 },
        },
      });
      if (body.status === "inactive") {
        const linked = await prisma.user.findFirst({ where: { staffId: id }, select: { id: true } });
        if (linked) await revokeAllUserSessions(linked.id);
      } else {
        await bumpTokenVersionForStaff(id);
      }
    }

    await prisma.facilityMembership.updateMany({
      where: { staffId: id, facilityId },
      data: {
        ...(body.role ? { role: body.role } : {}),
        ...(body.dept ? { dept: body.dept } : {}),
        ...(body.ward !== undefined ? { ward: body.ward } : {}),
        ...(body.status === "inactive" ? { status: "suspended" } : {}),
        ...(body.status === "active" ? { status: "active" } : {}),
      },
    });

    await writeAudit({
      actorId: req.user!.sub,
      facilityId,
      action: body.status === "inactive" ? "staff.deactivate" : body.status === "active" ? "staff.reactivate" : "staff.update",
      entity: row.id,
      meta: { role: body.role, status: body.status, dept: body.dept, ward: body.ward },
    });
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

/** Clinical notes — list/register live in routes/patients.ts (Section 4). */
router.get("/patients/:id/clinical", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    const facilityId = requireFacilityId(req);
    if (!canAccessClinicalNotes(u.role)) {
      return res.status(403).json({ error: "Clinical notes are restricted for your role." });
    }
    const id = String(req.params.id);
    const patient = await prisma.patient.findFirst({ where: { id, facilityId } });
    if (!patient) return res.status(404).json({ error: "Patient not found." });

    // Scope: doctors assigned; nurses ward; admins all clinical.
    if (can(u.role, "patients:read_assigned") && patient.doctorId !== u.staffId && !can(u.role, "patients:read_all")) {
      return res.status(403).json({ error: "Not assigned to this patient." });
    }
    if (can(u.role, "patients:read_ward") && !can(u.role, "patients:read_all") && patient.ward !== u.ward) {
      return res.status(403).json({ error: "Patient is outside your ward." });
    }

    await writeAudit({
      actorId: u.sub,
      facilityId,
      action: "patients.clinical_access",
      entity: id,
      meta: { role: u.role },
      req,
    });
    res.json({
      data: {
        patientId: patient.id,
        condition: patient.condition,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Activate / deactivate a facility user (admin). Cannot target self or grant platform roles. */
router.patch(
  "/users/:userId/status",
  requirePermission("users.manage", "staff:write"),
  async (req: AuthedRequest, res, next) => {
    try {
      const facilityId = requireFacilityId(req);
      const userId = String(req.params.userId);
      const body = z.object({ status: z.enum(["active", "inactive"]) }).parse(req.body);
      if (userId === req.user!.sub) {
        return res.status(400).json({ error: "You cannot change your own account status." });
      }
      const membership = await prisma.facilityMembership.findFirst({
        where: { userId, facilityId },
      });
      if (!membership) return res.status(404).json({ error: "User is not a member of this facility." });

      const target = await prisma.user.findUnique({ where: { id: userId } });
      if (!target) return res.status(404).json({ error: "User not found." });
      if (target.platformRole) {
        return res.status(403).json({ error: "Facility administrators cannot modify platform accounts." });
      }

      await prisma.user.update({
        where: { id: userId },
        data: { status: body.status, tokenVersion: { increment: 1 } },
      });
      if (body.status === "inactive") {
        await revokeAllUserSessions(userId);
        await prisma.facilityMembership.updateMany({
          where: { userId, facilityId },
          data: { status: "suspended" },
        });
      } else {
        await prisma.facilityMembership.updateMany({
          where: { userId, facilityId },
          data: { status: "active" },
        });
      }

      await writeAudit({
        actorId: req.user!.sub,
        facilityId,
        action: body.status === "inactive" ? "user.deactivate" : "user.activate",
        entity: userId,
        req,
      });
      res.json({ ok: true, userId, status: body.status });
    } catch (err) {
      next(err);
    }
  },
);

router.get("/appointments", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    const facilityId = requireFacilityId(req);
    let where: Record<string, unknown> = { facilityId };
    if (can(u.role, "appointments:read_all") || can(u.role, "appointments.manage")) {
      where = { facilityId };
    } else if (u.role === "doctor") {
      where = { facilityId, doctorId: u.staffId ?? "__none__" };
    } else if (u.role === "nurse") {
      const wardPatients = await prisma.patient.findMany({
        where: { facilityId, ward: u.ward ?? "__none__" },
        select: { id: true },
      });
      where = { facilityId, patientId: { in: wardPatients.map((p) => p.id) } };
    } else if (u.role === "patient") {
      where = { facilityId, patientId: u.patientId ?? "__none__" };
    } else if (can(u.role, "appointments.read") || can(u.role, "billing.read")) {
      // Receptionist / cashier: facility appointment list without clinical ownership filters.
      where = { facilityId };
    } else return res.status(403).json({ error: "Missing permission." });

    const { page, limit, skip } = parsePage(req);
    const [total, rows] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.findMany({
        where,
        include: {
          patient: { select: { id: true, name: true } },
          doctor: { select: { id: true, name: true } },
        },
        orderBy: [{ date: "asc" }, { time: "asc" }],
        skip,
        take: limit,
      }),
    ]);
    res.json({ data: rows, meta: pageMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
});

router.post("/appointments", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    const facilityId = requireFacilityId(req);
    if (!can(u.role, "appointments:request") && !can(u.role, "appointments:manage") && !can(u.role, "appointments:write_own")) {
      return res.status(403).json({ error: "Missing permission." });
    }
    const body = z.object({
      patientId: z.string().optional(),
      doctorId: z.string().min(1),
      date: dateStringSchema,
      time: timeStringSchema,
      dept: z.string().min(1).max(120),
      reason: z.string().max(500).optional(),
      facilityId: z.string().optional(),
    }).parse(req.body);

    const patientId = u.role === "patient" ? u.patientId : body.patientId;
    if (!patientId) return res.status(400).json({ error: "patientId required." });

    await assertSameFacilityPatient(facilityId, patientId);
    await assertSameFacilityStaff(facilityId, body.doctorId);
    await assertActiveDoctor(body.doctorId);
    const appointmentNumber = await allocateAppointmentNumber(facilityId);
    const status = u.role === "patient" ? "requested" : "confirmed";
    // Slot check + create in one transaction; DB partial unique index also blocks races (P2002 → 409).
    const row = await prisma.$transaction(async (tx) => {
      const slot = await assertSlotAvailable(body.doctorId, body.date, body.time, {
        facilityId,
        durationMinutes: 30,
      });
      const conflict = await tx.appointment.findFirst({
        where: {
          facilityId,
          doctorId: body.doctorId,
          date: body.date,
          time: slot.time,
          status: { in: [...BLOCKING_STATUSES] },
        },
        select: { id: true },
      });
      if (conflict) {
        throw Object.assign(new Error("That doctor is already booked at this date and time."), {
          status: 409,
        });
      }
      return tx.appointment.create({
        data: {
          facilityId,
          appointmentNumber,
          patientId,
          doctorId: body.doctorId,
          date: body.date,
          time: slot.time,
          endTime: slot.endTime,
          durationMinutes: slot.durationMinutes,
          dept: body.dept,
          reason: body.reason,
          status,
          type: "general",
          bookingSource: u.role === "patient" ? "patient_portal" : "reception",
          createdById: u.sub,
        },
      });
    });
    await recordStatusEvent({
      facilityId,
      appointmentId: row.id,
      fromStatus: null,
      toStatus: status,
      actorId: u.sub,
    });
    await writeAudit({ actorId: u.sub, facilityId, action: "appointment.create", entity: row.id });
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

router.get("/shifts", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    const facilityId = requireFacilityId(req);
    let where: Record<string, unknown> = { facilityId };
    if (can(u.role, "schedule:read") || can(u.role, "schedule:write")) {
      where = { facilityId };
    } else if (can(u.role, "schedule:read_own")) {
      where = { facilityId, staffId: u.staffId ?? "__none__", status: "published" };
    } else {
      return res.status(403).json({ error: "Missing permission." });
    }

    const { page, limit, skip } = parsePage(req);
    const [total, rows] = await Promise.all([
      prisma.shift.count({ where }),
      prisma.shift.findMany({
        where,
        include: { staff: { select: { id: true, name: true } } },
        orderBy: [{ date: "asc" }, { slot: "asc" }],
        skip,
        take: limit,
      }),
    ]);
    res.json({ data: rows, meta: pageMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
});

router.patch("/shifts/:id/publish", requirePermission("schedule:publish"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const id = String(req.params.id);
    const existing = await prisma.shift.findFirst({ where: { id, facilityId } });
    if (!existing) return res.status(404).json({ error: "Shift not found." });
    const row = await prisma.shift.update({
      where: { id },
      data: { status: "published" },
    });
    await writeAudit({ actorId: req.user!.sub, facilityId, action: "shift.publish", entity: row.id });
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

router.get("/exchanges", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    const facilityId = requireFacilityId(req);
    let where: Record<string, unknown> = { facilityId };
    if (can(u.role, "exchanges:approve")) where = { facilityId };
    else if (can(u.role, "exchanges:request")) {
      where = {
        facilityId,
        OR: [{ fromStaffId: u.staffId ?? "__none__" }, { toStaffId: u.staffId ?? "__none__" }],
      };
    } else return res.status(403).json({ error: "Missing permission." });

    const { page, limit, skip } = parsePage(req);
    const [total, rows] = await Promise.all([
      prisma.exchange.count({ where }),
      prisma.exchange.findMany({
        where,
        include: {
          fromStaff: { select: { id: true, name: true } },
          toStaff: { select: { id: true, name: true } },
        },
        orderBy: { date: "asc" },
        skip,
        take: limit,
      }),
    ]);
    res.json({ data: rows, meta: pageMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
});

router.post("/exchanges", requirePermission("exchanges:request"), async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    const facilityId = requireFacilityId(req);
    if (!u.staffId) return res.status(400).json({ error: "Staff profile required." });
    const body = z.object({
      toStaffId: z.string().min(1),
      date: dateStringSchema,
      reason: z.string().max(500).optional(),
    }).parse(req.body);
    if (body.toStaffId === u.staffId) {
      return res.status(400).json({ error: "Cannot request a swap with yourself." });
    }
    const [fromStaff, toStaff] = await Promise.all([
      prisma.staff.findFirst({ where: { id: u.staffId, facilityId } }),
      prisma.staff.findFirst({ where: { id: body.toStaffId, facilityId } }),
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
        facilityId,
        fromStaffId: u.staffId,
        toStaffId: body.toStaffId,
        date: body.date,
        reason: body.reason,
        status: "pending_peer",
      },
    });
    await writeAudit({
      actorId: u.sub,
      facilityId,
      action: "exchange.create",
      entity: row.id,
      meta: { toStaffId: body.toStaffId, date: body.date, reason: body.reason },
    });
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

router.patch("/exchanges/:id", requirePermission("exchanges:approve", "exchanges:request"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const body = z.object({
      status: z.enum(["pending_peer", "peer_accepted", "pending_admin", "approved", "denied"]),
    }).parse(req.body);
    const u = req.user!;
    const id = String(req.params.id);
    const existing = await prisma.exchange.findFirst({ where: { id, facilityId } });
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
    await writeAudit({
      actorId: u.sub,
      facilityId,
      action: "exchange.update",
      entity: row.id,
      meta: { status: nextStatus },
    });
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

router.post("/exchanges/approve-pending", requirePermission("exchanges:approve"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const pending = await prisma.exchange.findMany({
      where: { facilityId, status: { in: ["pending_peer", "peer_accepted", "pending_admin"] } },
    });
    const ids = pending.map((e) => e.id);
    if (ids.length) {
      await prisma.exchange.updateMany({
        where: { id: { in: ids }, facilityId },
        data: { status: "approved" },
      });
      await writeAudit({
        actorId: req.user!.sub,
        facilityId,
        action: "exchange.approve_pending",
        meta: { count: ids.length },
      });
    }
    res.json({ data: { approved: ids.length } });
  } catch (err) {
    next(err);
  }
});

router.post("/shifts/publish-drafts", requirePermission("schedule:publish"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const result = await prisma.shift.updateMany({
      where: { facilityId, status: "draft" },
      data: { status: "published" },
    });
    await writeAudit({
      actorId: req.user!.sub,
      facilityId,
      action: "shift.publish_drafts",
      meta: { count: result.count },
    });
    res.json({ data: { published: result.count } });
  } catch (err) {
    next(err);
  }
});

router.patch("/appointments/:id", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    const facilityId = requireFacilityId(req);
    const id = String(req.params.id);
    const body = z.object({
      status: z
        .enum([
          "draft",
          "requested",
          "scheduled",
          "confirmed",
          "checked_in",
          "waiting",
          "in_consultation",
          "cancelled",
          "completed",
          "no_show",
          "rescheduled",
        ])
        .optional(),
      date: dateStringSchema.optional(),
      time: timeStringSchema.optional(),
      reason: z.string().max(500).optional(),
      doctorId: z.string().min(1).optional(),
      dept: z.string().min(1).max(120).optional(),
    }).parse(req.body);

    const existing = await prisma.appointment.findFirst({ where: { id, facilityId } });
    if (!existing) return res.status(404).json({ error: "Appointment not found." });

    const isAdminOps = can(u.role, "appointments:manage") || can(u.role, "appointments.manage");
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
    if (
      isAdminOps &&
      !isDoctorOwner &&
      body.status &&
      !["cancelled", "draft", "scheduled", "confirmed"].includes(body.status)
    ) {
      return res.status(403).json({
        error: "Admins cannot change clinical appointment status. Cancel or reassign instead.",
      });
    }

    if (body.doctorId && isAdminOps) {
      await assertSameFacilityStaff(facilityId, body.doctorId);
      await assertActiveDoctor(body.doctorId);
    }

    const nextDoctorId = body.doctorId || existing.doctorId;
    const nextDate = body.date || existing.date;
    const nextTime = body.time || existing.time;
    const slotChanging = Boolean(body.doctorId || body.date || body.time);
    const nextStatus = body.status ?? existing.status;
    const staysBlocking = (BLOCKING_STATUSES as readonly string[]).includes(nextStatus);
    let normalizedTime = nextTime;
    let endTime = existing.endTime;
    let durationMinutes = existing.durationMinutes || 30;
    if (slotChanging && staysBlocking) {
      const slot = await assertSlotAvailableExcept(nextDoctorId, nextDate, nextTime, id, {
        facilityId,
        durationMinutes,
      });
      normalizedTime = slot.time;
      endTime = slot.endTime;
      durationMinutes = slot.durationMinutes;
    }

    const row = await prisma.appointment.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.date ? { date: body.date } : {}),
        ...(slotChanging
          ? { time: normalizedTime, endTime, durationMinutes }
          : body.time
            ? { time: body.time }
            : {}),
        ...(body.reason !== undefined ? { reason: body.reason } : {}),
        ...(body.doctorId ? { doctorId: body.doctorId } : {}),
        ...(body.dept ? { dept: body.dept } : {}),
        ...(body.status === "cancelled"
          ? { cancelledAt: new Date(), cancelledById: u.sub, cancelReason: body.reason || null }
          : {}),
      },
    });
    if (body.status && body.status !== existing.status) {
      await recordStatusEvent({
        facilityId,
        appointmentId: id,
        fromStatus: existing.status,
        toStatus: body.status,
        actorId: u.sub,
        reason: body.reason,
      });
    }
    await writeAudit({
      actorId: u.sub,
      facilityId,
      action: "appointment.update",
      entity: row.id,
      meta: { status: body.status, doctorId: body.doctorId, date: body.date, time: body.time },
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
    const facilityId = requireFacilityId(req);
    const rows = await prisma.appointment.findMany({
      where: { facilityId, status: { in: ["requested", "confirmed"] } },
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
        where: { id: { in: cancelIds }, facilityId },
        data: { status: "cancelled" },
      });
      await writeAudit({
        actorId: req.user!.sub,
        facilityId,
        action: "appointment.cleanup_duplicates",
        meta: { cancelled: cancelIds.length },
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
    const facilityId = requireFacilityId(req);
    const rows = await prisma.auditLog.findMany({
      where: can(u.role, "reports:read")
        ? { facilityId }
        : { facilityId, actorId: u.sub },
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
    const facilityId = requireFacilityId(req);
    const rows = await prisma.notification.findMany({
      where: {
        facilityId,
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

router.get("/reports/summary", requirePermission("reports:read"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const [staff, publishedShifts, openAppointments, pendingExchanges, patients] = await Promise.all([
      prisma.staff.count({ where: { facilityId, status: "active" } }),
      prisma.shift.count({ where: { facilityId, status: "published" } }),
      prisma.appointment.count({ where: { facilityId, status: { not: "draft" } } }),
      prisma.exchange.count({ where: { facilityId, status: { not: "approved" } } }),
      prisma.patient.count({ where: { facilityId } }),
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
    const facilityId = requireFacilityId(req);
    if (u.role === "admin") {
      const [activeStaff, publishedShifts, openAppointments, pendingExchanges] = await Promise.all([
        prisma.staff.count({ where: { facilityId, status: "active" } }),
        prisma.shift.count({ where: { facilityId, status: "published" } }),
        prisma.appointment.count({ where: { facilityId, status: { not: "draft" } } }),
        prisma.exchange.count({ where: { facilityId, status: { not: "approved" } } }),
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
        prisma.patient.count({ where: { facilityId, doctorId: u.staffId ?? "__none__" } }),
        prisma.shift.count({ where: { facilityId, staffId: u.staffId ?? "__none__" } }),
        prisma.appointment.count({ where: { facilityId, doctorId: u.staffId ?? "__none__", status: "confirmed" } }),
        prisma.notification.count({ where: { facilityId, OR: [{ userId: u.sub }, { role: "doctor" }] } }),
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
        prisma.patient.count({ where: { facilityId, ward: u.ward ?? "__none__" } }),
        prisma.shift.count({ where: { facilityId, staffId: u.staffId ?? "__none__" } }),
        prisma.appointment.count({
          where: { facilityId, patient: { ward: u.ward ?? "__none__" } },
        }),
        prisma.notification.count({ where: { facilityId, OR: [{ userId: u.sub }, { role: "nurse" }] } }),
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
      prisma.appointment.count({ where: { facilityId, patientId: u.patientId ?? "__none__" } }),
      prisma.appointment.count({ where: { facilityId, patientId: u.patientId ?? "__none__", status: "confirmed" } }),
      prisma.appointment.count({ where: { facilityId, patientId: u.patientId ?? "__none__", status: "requested" } }),
      prisma.doctorSchedule.findMany({ where: { facilityId }, select: { specialty: true }, distinct: ["specialty"] }),
    ]);
    const openSlots = await prisma.doctorSchedule.findMany({ where: { facilityId, status: { not: "full" } } });
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
