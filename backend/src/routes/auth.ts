import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, signToken, verifyPassword } from "../lib/auth.js";
import {
  buildGoogleAuthUrl,
  exchangeCodeAndVerify,
  frontendOrigin,
  googleConfigured,
  newOAuthState,
  type GoogleProfile,
} from "../lib/google.js";
import { PERMISSIONS } from "../lib/rbac.js";
import { ROLES, type Role } from "../lib/roles.js";
import {
  OAUTH_STATE_COOKIE,
  clearOAuthStateCookie,
  clearSessionCookie,
  setOAuthStateCookie,
  setSessionCookie,
} from "../lib/sessionCookie.js";
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
  picture?: string | null;
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
    picture: u.picture ?? null,
    staffId: u.staffId,
    patientId: u.patientId,
    ward: u.ward,
    dept: u.dept,
    permissions: PERMISSIONS[role] || [],
  };
}

function issueAuth(res: import("express").Response, user: {
  id: string;
  email: string;
  name: string;
  role: string;
  title: string | null;
  picture?: string | null;
  staffId: string | null;
  patientId: string | null;
  ward: string | null;
  dept: string | null;
}, status = 200) {
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
  setSessionCookie(res, token);
  return res.status(status).json({ token, user: publicUser(user) });
}

async function findOrCreateGoogleUser(profile: GoogleProfile) {
  const bySub = await prisma.user.findUnique({ where: { googleSub: profile.sub } });
  if (bySub) {
    return prisma.user.update({
      where: { id: bySub.id },
      data: {
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        emailVerified: true,
      },
    });
  }

  const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
  if (byEmail) {
    return prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleSub: profile.sub,
        name: profile.name || byEmail.name,
        picture: profile.picture ?? byEmail.picture,
        emailVerified: true,
      },
    });
  }

  const patient = await prisma.patient.create({
    data: {
      name: profile.name,
      age: 30,
      condition: "Google sign-in registration",
      doctorId: "s-doc-1",
    },
  });

  return prisma.user.create({
    data: {
      email: profile.email,
      passwordHash: null,
      name: profile.name,
      role: "patient",
      title: "Patient",
      picture: profile.picture,
      googleSub: profile.sub,
      emailVerified: true,
      patientId: patient.id,
    },
  });
}

function loginRedirectError(message: string) {
  const url = new URL("login.html", frontendOrigin().endsWith("/") ? frontendOrigin() : `${frontendOrigin()}/`);
  url.searchParams.set("error", message);
  return url.toString();
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

    await prisma.auditLog.create({
      data: { actorId: user.id, action: "auth.login", entity: "User", metaJson: JSON.stringify({ role: user.role }) },
    });

    return issueAuth(res, user);
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

    await prisma.auditLog.create({
      data: { actorId: user.id, action: "auth.signup", entity: "User", metaJson: JSON.stringify({ role: user.role }) },
    });

    return issueAuth(res, user, 201);
  } catch (err) {
    next(err);
  }
});

/** Start Google OAuth — redirects to Google's account chooser. */
router.get("/google", (req, res) => {
  try {
    if (!googleConfigured()) {
      return res.redirect(loginRedirectError("Google sign-in is not configured on the server."));
    }
    const state = newOAuthState();
    setOAuthStateCookie(res, state);
    return res.redirect(buildGoogleAuthUrl(state));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start Google sign-in.";
    return res.redirect(loginRedirectError(message));
  }
});

/** Google OAuth callback — verifies ID token server-side, then sets session cookie. */
router.get("/google/callback", async (req, res) => {
  try {
    if (!googleConfigured()) {
      return res.redirect(loginRedirectError("Google sign-in is not configured on the server."));
    }

    const errParam = typeof req.query.error === "string" ? req.query.error : "";
    if (errParam) {
      const desc = typeof req.query.error_description === "string" ? req.query.error_description : errParam;
      return res.redirect(loginRedirectError(desc || "Google sign-in was cancelled."));
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const expected = (req as typeof req & { cookies?: Record<string, string> }).cookies?.[OAUTH_STATE_COOKIE];
    clearOAuthStateCookie(res);

    if (!code) return res.redirect(loginRedirectError("Google sign-in failed: missing authorization code."));
    if (!state || !expected || state !== expected) {
      return res.redirect(loginRedirectError("Google sign-in failed: invalid OAuth state."));
    }

    const profile = await exchangeCodeAndVerify(code);
    const user = await findOrCreateGoogleUser(profile);

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
    setSessionCookie(res, token);

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "auth.google",
        entity: "User",
        metaJson: JSON.stringify({ sub: profile.sub, email: profile.email }),
      },
    });

    const dest = new URL("app.html", frontendOrigin().endsWith("/") ? frontendOrigin() : `${frontendOrigin()}/`);
    return res.redirect(dest.toString());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google sign-in failed.";
    return res.redirect(loginRedirectError(message));
  }
});

router.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  clearOAuthStateCookie(res);
  res.json({ ok: true });
});

router.get("/logout", (_req, res) => {
  clearSessionCookie(res);
  clearOAuthStateCookie(res);
  const dest = new URL("login.html", frontendOrigin().endsWith("/") ? frontendOrigin() : `${frontendOrigin()}/`);
  res.redirect(dest.toString());
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
