import { Router } from "express";
import { pool } from "../db/pool.js";
import { prisma } from "../lib/prisma.js";
import { can } from "../lib/rbac.js";
import { optionalAuth, requireAuth, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

router.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      ok: true,
      service: "filfilu-api",
      database: "up",
      host: process.env.PGHOST || "from DATABASE_URL",
      port: process.env.PGPORT || "from DATABASE_URL",
      name: process.env.PGDATABASE || "from DATABASE_URL",
      time: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      ok: false,
      service: "filfilu-api",
      database: "down",
      error:
        "Database unreachable. Check PostgreSQL is running and .env (PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD).",
      time: new Date().toISOString(),
    });
  }
});

router.get("/departments", async (_req, res, next) => {
  try {
    const rows = await prisma.department.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

/** Public doctor directory (patients + anonymous landing). */
router.get("/doctors", optionalAuth, async (_req, res, next) => {
  try {
    const rows = await prisma.doctorPublic.findMany({
      include: { doctor: { select: { id: true, name: true, status: true } } },
      orderBy: { specialty: "asc" },
    });
    res.json({
      data: rows.map((r) => ({
        id: r.doctorId,
        name: r.doctor.name,
        specialty: r.specialty,
        onDuty: r.onDuty,
        nextSlot: r.nextSlot,
        rating: r.rating,
        status: r.doctor.status,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/** Public clinic schedules by specialty — patients (and admin) can read all. */
router.get("/doctor-schedules", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    if (!can(u.role, "schedule:read_public") && !can(u.role, "appointments:read_all")) {
      return res.status(403).json({ error: "Missing permission." });
    }
    const specialty = typeof req.query.specialty === "string" ? req.query.specialty : undefined;
    const rows = await prisma.doctorSchedule.findMany({
      where: specialty ? { specialty } : undefined,
      include: { doctor: { select: { id: true, name: true } } },
      orderBy: [{ date: "asc" }, { specialty: "asc" }],
    });
    res.json({
      data: rows.map((r) => ({
        id: r.id,
        doctorId: r.doctorId,
        doctorName: r.doctor.name,
        specialty: r.specialty,
        day: r.day,
        date: r.date,
        slots: JSON.parse(r.slotsJson) as string[],
        room: r.room,
        status: r.status,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/specialties", async (_req, res, next) => {
  try {
    const rows = await prisma.doctorSchedule.findMany({
      select: { specialty: true },
      distinct: ["specialty"],
      orderBy: { specialty: "asc" },
    });
    res.json({ data: rows.map((r) => r.specialty) });
  } catch (err) {
    next(err);
  }
});

export default router;
