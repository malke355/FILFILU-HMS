import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, signToken, verifyPassword } from "../lib/auth.js";
import { PERMISSIONS } from "../lib/rbac.js";
import { ROLES, type Role } from "../lib/roles.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

const roleSchema = z.enum(ROLES);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: roleSchema.optional(),
});

const signupSchema = z.object({
  first: z.string().min(1),
  last: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: roleSchema,
});

function publicUser(u: {
  id: string;
  email: string;
  name: string;
  role: string;
  title: string | null;
  staffId: string | null;
  patientId: string | null;
  ward: string | null;
  dept: string | null;
}) {
  const role = u.role as Role;
  return {
    userId: u.id,
    email: u.email,
    name: u.name,
    role,
    title: u.title,
    staffId: u.staffId,
    patientId: u.patientId,
    ward: u.ward,
    dept: u.dept,
    permissions: PERMISSIONS[role] || [],
  };
}

router.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user) return res.status(401).json({ error: "Invalid email or password." });

    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password." });

    if (body.role && body.role !== user.role) {
      return res.status(403).json({
        error: `This account is assigned the ${user.role} role. Choose “${user.role}” or use another account.`,
      });
    }

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      name: user.name,
      staffId: user.staffId,
      patientId: user.patientId,
      ward: user.ward,
      dept: user.dept,
      title: user.title,
    });

    await prisma.auditLog.create({
      data: { actorId: user.id, action: "auth.login", entity: "User", metaJson: JSON.stringify({ role: user.role }) },
    });

    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/signup", async (req, res, next) => {
  try {
    const body = signupSchema.parse(req.body);
    const email = body.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: "An account with this email already exists." });

    const passwordHash = await hashPassword(body.password);
    const name = `${body.first} ${body.last}`.trim();
    const template = await prisma.user.findFirst({ where: { role: body.role } });

    let staffId: string | null = null;
    let patientId: string | null = null;
    const ward = template?.ward ?? null;
    const dept = template?.dept ?? (body.role === "doctor" ? "General Medicine" : null);

    if (body.role === "patient") {
      const patient = await prisma.patient.create({
        data: {
          name,
          age: 30,
          condition: "New patient registration",
          doctorId: "s-doc-1",
        },
      });
      patientId = patient.id;
    } else {
      const staff = await prisma.staff.create({
        data: {
          name,
          role: body.role,
          dept: dept || "Administration",
          ward,
          status: "active",
        },
      });
      staffId = staff.id;
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: body.role,
        title: body.role === "patient" ? "Patient" : body.role,
        staffId,
        patientId,
        ward,
        dept,
      },
    });

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      name: user.name,
      staffId: user.staffId,
      patientId: user.patientId,
      ward: user.ward,
      dept: user.dept,
      title: user.title,
    });

    await prisma.auditLog.create({
      data: { actorId: user.id, action: "auth.signup", entity: "User", metaJson: JSON.stringify({ role: user.role }) },
    });

    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get("/demo-accounts", (_req, res) => {
  res.json({
    password: "filfilu",
    accounts: [
      { email: "admin@filfilu.com", role: "admin", name: "Selam Bekele" },
      { email: "doctor@filfilu.com", role: "doctor", name: "Dr. Helen Tesfaye" },
      { email: "nurse@filfilu.com", role: "nurse", name: "Rahel Abebe" },
      { email: "patient@filfilu.com", role: "patient", name: "Amina Mohammed" },
    ],
  });
});

export default router;
