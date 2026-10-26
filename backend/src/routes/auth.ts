import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, signToken, verifyPassword, verifyToken } from "../lib/auth.js";
import {
  buildGoogleAuthUrl,
  exchangeCodeAndVerify,
  friendlyGoogleError,
  frontendOrigin,
  googleConfigured,
  newOAuthState,
  type GoogleProfile,
} from "../lib/google.js";
import { writeAudit } from "../lib/audit.js";
import { logError, logInfo } from "../lib/logger.js";
import { sendPasswordResetEmail, smtpConfigured } from "../lib/mail.js";
import {
  consumePasswordResetToken,
  issuePasswordResetToken,
  markResetTokenUsed,
} from "../lib/passwordReset.js";
import { redactEmail } from "../lib/privacy.js";
import { PERMISSIONS } from "../lib/rbac.js";
import { PUBLIC_SIGNUP_ROLE, ROLES, type Role } from "../lib/roles.js";
import { bumpTokenVersion } from "../lib/session.js";
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
import { requireAuth, tokenFromRequest, type AuthedRequest } from "../middleware/auth.js";
import {
  forgotPasswordLimiter,
  googleAuthLimiter,
  loginLimiter,
  resetPasswordLimiter,
  signupLimiter,
} from "../middleware/rateLimit.js";

const router = Router();

const roleSchema = z.enum(ROLES);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: roleSchema.optional(),
});

/** Public signup is patient-only — role in the body is ignored if present. */
const signupSchema = z.object({
  first: z.string().min(1).max(80),
  last: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  role: z.string().optional(),
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
  tokenVersion?: number;
}, status = 200) {
  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role as Role,
    name: user.name,
    tv: user.tokenVersion ?? 0,
    staffId: user.staffId,
    patientId: user.patientId,
    ward: user.ward,
    dept: user.dept,
    title: user.title,
  });
  setSessionCookie(res, token);
  // Never return the JWT in the JSON body — browser sessions use the httpOnly cookie only.
  return res.status(status).json({ user: publicUser(user) });
}

type GoogleOAuthMode = { intent: "login" | "signup" };

function parseOAuthMode(raw: string | undefined): GoogleOAuthMode {
  if (!raw) return { intent: "login" };
  if (raw === "signup" || raw.startsWith("signup:")) return { intent: "signup" };
  return { intent: "login" };
}

const GOOGLE_PASSWORD_ACCOUNT_MSG =
  "An account with this email already uses a password. Sign in with email and password, or use Forgot password. Google cannot attach to that account automatically.";

async function refreshGoogleUser(
  existing: {
    id: string;
    name: string;
    picture: string | null;
  },
  profile: GoogleProfile,
) {
  return prisma.user.update({
    where: { id: existing.id },
    data: {
      email: profile.email.toLowerCase(),
      name: profile.name || existing.name,
      picture: profile.picture ?? existing.picture,
      emailVerified: true,
    },
  });
}

/**
 * Google Sign-In: only existing users already linked by googleSub.
 * Never auto-link a password account by email (prevents pre-registration takeover).
 */
async function resolveRegisteredGoogleUser(profile: GoogleProfile) {
  const email = profile.email.toLowerCase();

  const bySub = await prisma.user.findUnique({ where: { googleSub: profile.sub } });
  if (bySub) return refreshGoogleUser(bySub, profile);

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail?.passwordHash) {
    throw new Error(GOOGLE_PASSWORD_ACCOUNT_MSG);
  }
  if (byEmail?.googleSub && byEmail.googleSub !== profile.sub) {
    throw new Error("This email is linked to a different Google account. Sign in with that Google account.");
  }

  throw new Error(
    "No Filfilu account found for this Google email. Patients can Sign Up with Google first; doctors and nurses must be registered by an admin.",
  );
}

/** Google signup: create a patient account only (never staff/admin). */
async function createOrSignInGooglePatient(profile: GoogleProfile) {
  const email = profile.email.toLowerCase();

  const bySub = await prisma.user.findUnique({ where: { googleSub: profile.sub } });
  if (bySub) return refreshGoogleUser(bySub, profile);

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail?.passwordHash) {
    throw new Error(GOOGLE_PASSWORD_ACCOUNT_MSG);
  }
  if (byEmail?.googleSub) {
    // Same email already Google-linked under another sub — should be rare.
    throw new Error("An account with this email already exists. Sign in with Google from the login page.");
  }
  if (byEmail) {
    // Orphan email row without password/google — refuse silent takeover.
    throw new Error("An account with this email already exists. Sign in with email and password, or use Forgot password.");
  }

  const name = profile.name || email.split("@")[0] || "Google user";
  // No seed/default doctor assignment — admin assigns primary doctor later.
  const patient = await prisma.patient.create({
    data: {
      name,
      age: 30,
      condition: "New patient registration",
      doctorId: null,
    },
  });

  return prisma.user.create({
    data: {
      email,
      passwordHash: null,
      name,
      role: PUBLIC_SIGNUP_ROLE,
      title: "Patient",
      picture: profile.picture,
      googleSub: profile.sub,
      emailVerified: true,
      staffId: null,
      patientId: patient.id,
      ward: null,
      dept: null,
    },
  });
}

async function assertStaffActive(user: { staffId: string | null; role: string }) {
  if (!user.staffId) return;
  if (user.role === "patient") return;
  const staff = await prisma.staff.findUnique({ where: { id: user.staffId } });
  if (staff && staff.status === "inactive") {
    throw Object.assign(new Error("This staff account is deactivated. Contact an administrator."), { status: 403 });
  }
}

function authRedirectError(message: string, page: "login.html" | "signup.html" = "login.html") {
  const url = new URL(page, frontendOrigin().endsWith("/") ? frontendOrigin() : `${frontendOrigin()}/`);
  url.searchParams.set("error", message);
  return url.toString();
}

router.post("/login", loginLimiter, async (req, res, next) => {
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

    try {
      await assertStaffActive(user);
    } catch (err) {
      const e = err as Error & { status?: number };
      return res.status(e.status || 403).json({ error: e.message });
    }

    await writeAudit({ actorId: user.id, action: "auth.login", entity: "User", meta: { role: user.role } });

    return issueAuth(res, user);
  } catch (err) {
    next(err);
  }
});

router.post("/signup", signupLimiter, async (req, res, next) => {
  try {
    const body = signupSchema.parse(req.body);

    // Hard reject staff/admin self-registration even if the client sends a role.
    if (body.role && body.role !== PUBLIC_SIGNUP_ROLE) {
      return res.status(403).json({
        error: "Only patients can create an account. Doctors and nurses are registered by an administrator.",
      });
    }

    const email = body.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: "An account with this email already exists." });

    const passwordHash = await hashPassword(body.password);
    const name = `${body.first} ${body.last}`.trim();

    // Leave primary doctor unassigned — never hardcode seed IDs like s-doc-1.
    const patient = await prisma.patient.create({
      data: {
        name,
        age: 30,
        condition: "New patient registration",
        doctorId: null,
      },
    });

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: PUBLIC_SIGNUP_ROLE,
        title: "Patient",
        emailVerified: false,
        staffId: null,
        patientId: patient.id,
        ward: null,
        dept: null,
      },
    });

    await writeAudit({ actorId: user.id, action: "auth.signup", entity: "User", meta: { role: user.role } });

    return issueAuth(res, user, 201);
  } catch (err) {
    next(err);
  }
});

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(6).max(128),
});

/**
 * Request a password reset. Always returns the same message (no email enumeration).
 * Sends email via Nodemailer when SMTP is configured; in development also returns `devResetUrl`.
 */
router.post("/forgot-password", forgotPasswordLimiter, async (req, res, next) => {
  try {
    const body = forgotSchema.parse(req.body);
    const email = body.email.toLowerCase();
    const generic = {
      ok: true,
      message: "If an account with that email exists, a password reset link has been sent. Check your inbox (and spam).",
    };

    const user = await prisma.user.findUnique({ where: { email } });
    // Only password-based accounts can reset; Google-only accounts have no passwordHash.
    if (!user?.passwordHash) {
      return res.json(generic);
    }

    const issued = await issuePasswordResetToken(user.id);
    let mailed = false;
    if (smtpConfigured()) {
      try {
        mailed = await sendPasswordResetEmail(email, issued.resetUrl);
      } catch (err) {
        logError("auth.forgot_password.mail", err);
        // Still return generic message — do not reveal mail failure to clients.
      }
    }

    // Never put reset URLs in JSON unless explicitly opted in (local debug only).
    const allowDevResetUrl =
      process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_RESET_URL === "1";
    if (allowDevResetUrl || process.env.NODE_ENV !== "production") {
      logInfo(
        `[password-reset] ${redactEmail(email)} mailed=${mailed}` +
          (allowDevResetUrl ? ` link=${issued.resetUrl}` : ""),
      );
    }

    await writeAudit({
      actorId: user.id,
      action: "auth.forgot_password",
      entity: "User",
      meta: { emailed: mailed },
    });

    const payload: Record<string, unknown> = { ...generic };
    if (allowDevResetUrl) {
      payload.devResetUrl = issued.resetUrl;
      payload.devMailed = mailed;
    }
    return res.json(payload);
  } catch (err) {
    next(err);
  }
});

/** Set a new password using a one-time reset token. */
router.post("/reset-password", resetPasswordLimiter, async (req, res, next) => {
  try {
    const body = resetSchema.parse(req.body);
    const row = await consumePasswordResetToken(body.token);
    if (!row) {
      return res.status(400).json({ error: "This reset link is invalid or has expired. Request a new one." });
    }

    const passwordHash = await hashPassword(body.password);
    await prisma.user.update({
      where: { id: row.userId },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    });
    await markResetTokenUsed(row.id, row.userId);

    await writeAudit({
      actorId: row.userId,
      action: "auth.reset_password",
      entity: "User",
    });

    clearSessionCookie(res);
    return res.json({ ok: true, message: "Password updated. You can sign in with your new password." });
  } catch (err) {
    next(err);
  }
});

/** Start Google OAuth — redirects to Google's account chooser. */
router.get("/google", googleAuthLimiter, (req, res) => {
  const intentRaw = typeof req.query.intent === "string" ? req.query.intent : "login";
  const intent = intentRaw === "signup" ? "signup" : "login";
  const errPage = intent === "signup" ? "signup.html" : "login.html";

  try {
    if (!googleConfigured()) {
      return res.redirect(authRedirectError("Google sign-in is not configured on the server.", errPage));
    }
    const state = newOAuthState();
    setOAuthStateCookie(res, state);
    // Signup via Google is always patient — ignore any role query param.
    setOAuthModeCookie(res, intent === "signup" ? "signup" : "login");
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
        ? await createOrSignInGooglePatient(profile)
        : await resolveRegisteredGoogleUser(profile);

    try {
      await assertStaffActive(user);
    } catch (err) {
      const e = err as Error;
      return res.redirect(authRedirectError(e.message, "login.html"));
    }

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      name: user.name,
      tv: user.tokenVersion ?? 0,
      staffId: user.staffId,
      patientId: user.patientId,
      ward: user.ward,
      dept: user.dept,
      title: user.title,
    });
    setSessionCookie(res, token);

    await writeAudit({
      actorId: user.id,
      action: mode.intent === "signup" ? "auth.google_signup" : "auth.google",
      entity: "User",
      meta: { role: user.role },
    });

    const dest = new URL("app.html", frontendOrigin().endsWith("/") ? frontendOrigin() : `${frontendOrigin()}/`);
    return res.redirect(dest.toString());
  } catch (err) {
    clearOAuthModeCookie(res);
    return res.redirect(authRedirectError(friendlyGoogleError(err), errPage));
  }
});

/** Logout is POST-only (not GET) so links/prefetch cannot revoke sessions. */
router.get("/logout", (_req, res) => {
  res.set("Allow", "POST");
  res.status(405).json({ error: "Use POST /api/auth/logout to sign out." });
});

router.post("/logout", async (req, res, next) => {
  try {
    const token = tokenFromRequest(req);
    if (token) {
      try {
        const payload = verifyToken(token);
        await bumpTokenVersion(payload.sub);
      } catch {
        /* ignore invalid cookie */
      }
    }
    clearSessionCookie(res);
    clearOAuthStateCookie(res);
    clearOAuthModeCookie(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) return res.status(404).json({ error: "User not found." });
    try {
      await assertStaffActive(user);
    } catch (err) {
      const e = err as Error & { status?: number };
      clearSessionCookie(res);
      return res.status(e.status || 403).json({ error: e.message });
    }
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
