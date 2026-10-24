import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, signToken, verifyPassword } from "../lib/auth.js";
import {
  buildGoogleAuthUrl,
  exchangeCodeAndVerify,
  friendlyGoogleError,
  frontendOrigin,
  googleConfigured,
  newOAuthState,
  type GoogleProfile,
} from "../lib/google.js";
import { PERMISSIONS } from "../lib/rbac.js";
import { ROLES, type Role } from "../lib/roles.js";
import {
  OAUTH_MODE_COOKIE,
  OAUTH_STATE_COOKIE,
  clearOAuthModeCookie,
  clearOAuthStateCookie,
  clearSessionCookie,
  setOAuthModeCookie,
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

type GoogleOAuthMode = { intent: "login" | "signup"; role: Role };

function parseOAuthMode(raw: string | undefined): GoogleOAuthMode {
  if (!raw) return { intent: "login", role: "patient" };
  if (raw === "login") return { intent: "login", role: "patient" };
  if (raw.startsWith("signup:")) {
    const role = raw.slice("signup:".length);
    if ((ROLES as readonly string[]).includes(role)) {
      return { intent: "signup", role: role as Role };
    }
    return { intent: "signup", role: "patient" };
  }
  if (raw === "signup") return { intent: "signup", role: "patient" };
  return { intent: "login", role: "patient" };
}

async function linkOrRefreshGoogleUser(
  existing: {
    id: string;
    name: string;
    picture: string | null;
  },
  profile: GoogleProfile,
  linkSub: boolean,
) {
  return prisma.user.update({
    where: { id: existing.id },
    data: {
      ...(linkSub ? { googleSub: profile.sub } : {}),
      email: profile.email.toLowerCase(),
      name: profile.name || existing.name,
      picture: profile.picture ?? existing.picture,
      emailVerified: true,
    },
  });
}

/**
 * Google Sign-In (login page): only existing DB users.
 * Match by googleSub or verified email, then link if needed.
 */
async function resolveRegisteredGoogleUser(profile: GoogleProfile) {
  const email = profile.email.toLowerCase();

  const bySub = await prisma.user.findUnique({ where: { googleSub: profile.sub } });
  if (bySub) return linkOrRefreshGoogleUser(bySub, profile, false);

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) return linkOrRefreshGoogleUser(byEmail, profile, true);

  throw new Error(
    "No Filfilu account found for this Google email. Create an account with Sign Up first, then use Sign in with Google.",
  );
}

/**
 * Continue with Google (signup page): create a Filfilu account for a new Google email.
 * If the email (or Google account) already exists, sign them in instead.
 */
async function createOrSignInGoogleUser(profile: GoogleProfile, role: Role) {
  const email = profile.email.toLowerCase();

  const bySub = await prisma.user.findUnique({ where: { googleSub: profile.sub } });
  if (bySub) return linkOrRefreshGoogleUser(bySub, profile, false);

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) return linkOrRefreshGoogleUser(byEmail, profile, true);

  const name = profile.name || email.split("@")[0] || "Google user";
  const template = await prisma.user.findFirst({ where: { role } });
  let staffId: string | null = null;
  let patientId: string | null = null;
  const ward = template?.ward ?? null;
  const dept = template?.dept ?? (role === "doctor" ? "General Medicine" : null);

  if (role === "patient") {
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
        role,
        dept: dept || "Administration",
        ward,
        status: "active",
      },
    });
    staffId = staff.id;
  }

  return prisma.user.create({
    data: {
      email,
      passwordHash: null,
      name,
      role,
      title: role === "patient" ? "Patient" : role,
      picture: profile.picture,
      googleSub: profile.sub,
      emailVerified: true,
      staffId,
      patientId,
      ward,
      dept,
    },
  });
}

function authRedirectError(message: string, page: "login.html" | "signup.html" = "login.html") {
  const url = new URL(page, frontendOrigin().endsWith("/") ? frontendOrigin() : `${frontendOrigin()}/`);
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
  const intentRaw = typeof req.query.intent === "string" ? req.query.intent : "login";
  const intent = intentRaw === "signup" ? "signup" : "login";
  const roleRaw = typeof req.query.role === "string" ? req.query.role : "patient";
  const role = (ROLES as readonly string[]).includes(roleRaw) ? (roleRaw as Role) : "patient";
  const errPage = intent === "signup" ? "signup.html" : "login.html";

  try {
    if (!googleConfigured()) {
      return res.redirect(authRedirectError("Google sign-in is not configured on the server.", errPage));
    }
    const state = newOAuthState();
    setOAuthStateCookie(res, state);
    setOAuthModeCookie(res, intent === "signup" ? `signup:${role}` : "login");
    return res.redirect(buildGoogleAuthUrl(state));
  } catch (err) {
    return res.redirect(authRedirectError(friendlyGoogleError(err), errPage));
  }
});

/** Google OAuth callback — verifies ID token server-side, then sets session cookie. */
router.get("/google/callback", async (req, res) => {
  const cookies = (req as typeof req & { cookies?: Record<string, string> }).cookies;
  const mode = parseOAuthMode(cookies?.[OAUTH_MODE_COOKIE]);
  const errPage = mode.intent === "signup" ? "signup.html" : "login.html";

  try {
    if (!googleConfigured()) {
      clearOAuthModeCookie(res);
      return res.redirect(authRedirectError("Google sign-in is not configured on the server.", errPage));
    }

    const errParam = typeof req.query.error === "string" ? req.query.error : "";
    if (errParam) {
      clearOAuthStateCookie(res);
      clearOAuthModeCookie(res);
      const desc = typeof req.query.error_description === "string" ? req.query.error_description : errParam;
      const friendly =
        errParam === "access_denied"
          ? "Google sign-in was cancelled."
          : desc && desc.length < 120
            ? desc
            : "Google sign-in was cancelled.";
      return res.redirect(authRedirectError(friendly, errPage));
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const expected = cookies?.[OAUTH_STATE_COOKIE];
    clearOAuthStateCookie(res);
    clearOAuthModeCookie(res);

    if (!code) return res.redirect(authRedirectError("Google sign-in failed: missing authorization code.", errPage));
    if (!state || !expected || state !== expected) {
      return res.redirect(
        authRedirectError("Google sign-in failed: invalid OAuth state. Try again.", errPage),
      );
    }

    const profile = await exchangeCodeAndVerify(code);
    const user =
      mode.intent === "signup"
        ? await createOrSignInGoogleUser(profile, mode.role)
        : await resolveRegisteredGoogleUser(profile);

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
        action: mode.intent === "signup" ? "auth.google_signup" : "auth.google",
        entity: "User",
        metaJson: JSON.stringify({ sub: profile.sub, email: profile.email, role: user.role }),
      },
    });

    const dest = new URL("app.html", frontendOrigin().endsWith("/") ? frontendOrigin() : `${frontendOrigin()}/`);
    return res.redirect(dest.toString());
  } catch (err) {
    clearOAuthModeCookie(res);
    return res.redirect(authRedirectError(friendlyGoogleError(err), errPage));
  }
});

router.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  clearOAuthStateCookie(res);
  clearOAuthModeCookie(res);
  res.json({ ok: true });
});

router.get("/logout", (_req, res) => {
  clearSessionCookie(res);
  clearOAuthStateCookie(res);
  clearOAuthModeCookie(res);
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
