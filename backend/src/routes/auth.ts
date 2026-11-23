import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, signToken, verifyPassword, verifyToken } from "../lib/auth.js";
import {
  createAuthSession,
  revokeAllUserSessions,
  revokeRefreshToken,
  rotateAuthSession,
} from "../lib/authSession.js";
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
import { permissionsForRole } from "../lib/rbac.js";
import { PUBLIC_SIGNUP_ROLE, ROLES, type Role } from "../lib/roles.js";
import { bumpTokenVersion } from "../lib/session.js";
import {
  DEFAULT_FACILITY_ID,
  listUserFacilities,
  resolveFacilityContext,
} from "../lib/tenant.js";
import { allocatePatientNumber } from "../services/patients/patientNumber.js";
import { composeDisplayName } from "../services/patients/displayName.js";
import {
  OAUTH_MODE_COOKIE,
  OAUTH_STATE_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  clearOAuthModeCookie,
  clearOAuthStateCookie,
  setOAuthModeCookie,
  setOAuthStateCookie,
  setRefreshCookie,
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

function clientIp(req: import("express").Request) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string") return xf.split(",")[0]?.trim() || req.ip || null;
  return req.ip || null;
}

function refreshFromRequest(req: import("express").Request) {
  const cookies = (req as import("express").Request & { cookies?: Record<string, string> }).cookies;
  const fromCookie = cookies?.[REFRESH_COOKIE];
  if (fromCookie) return fromCookie;
  const body = req.body as { refreshToken?: string } | undefined;
  return typeof body?.refreshToken === "string" ? body.refreshToken : null;
}

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

function publicUser(
  u: {
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
    platformRole?: string | null;
    status?: string | null;
  },
  extras?: { facilityId?: string | null; facilities?: unknown[] },
) {
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
    status: u.status ?? "active",
    facilityId: extras?.facilityId ?? null,
    platformRole: u.platformRole ?? null,
    facilities: extras?.facilities ?? [],
    permissions: permissionsForRole(role),
  };
}

async function ensureFacilityMembership(
  userId: string,
  data: {
    facilityId?: string;
    role: string;
    staffId?: string | null;
    title?: string | null;
    ward?: string | null;
    dept?: string | null;
  },
) {
  const facilityId = data.facilityId || DEFAULT_FACILITY_ID;
  return prisma.facilityMembership.upsert({
    where: { userId_facilityId: { userId, facilityId } },
    create: {
      userId,
      facilityId,
      role: data.role,
      status: "active",
      staffId: data.staffId ?? null,
      title: data.title ?? null,
      ward: data.ward ?? null,
      dept: data.dept ?? null,
    },
    update: {
      role: data.role,
      status: "active",
      staffId: data.staffId ?? undefined,
      title: data.title ?? undefined,
      ward: data.ward ?? undefined,
      dept: data.dept ?? undefined,
    },
  });
}

type SessionUser = {
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
  platformRole?: string | null;
  defaultFacilityId?: string | null;
  status?: string | null;
};

/** Sets access + refresh cookies and syncs User mirrors. Does not write a response body. */
async function establishSession(
  res: import("express").Response,
  user: SessionUser,
  requestedFacilityId: string | null | undefined,
  req?: import("express").Request,
) {
  if (user.status && user.status !== "active") {
    return { error: "This account is deactivated. Contact an administrator.", status: 403 as const };
  }

  const ctx = await resolveFacilityContext(user.id, {
    requestedFacilityId: requestedFacilityId || null,
    defaultFacilityId: user.defaultFacilityId || DEFAULT_FACILITY_ID,
    platformRole: user.platformRole,
  });
  if (!ctx) {
    return { error: "No active facility membership for this account.", status: 403 as const };
  }

  const role = ctx.role;
  const staffId = ctx.membership?.staffId ?? user.staffId;
  const ward = ctx.membership?.ward ?? user.ward;
  const dept = ctx.membership?.dept ?? user.dept;
  const title = ctx.membership?.title ?? user.title;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      role,
      title,
      ward,
      dept,
      staffId: staffId || user.staffId,
      defaultFacilityId: ctx.facilityId,
    },
  });

  const token = signToken({
    sub: user.id,
    email: user.email,
    role,
    name: user.name,
    tv: user.tokenVersion ?? 0,
    facilityId: ctx.facilityId,
    platformRole: user.platformRole,
    staffId,
    patientId: user.patientId,
    ward,
    dept,
    title,
  });
  setSessionCookie(res, token);

  const session = await createAuthSession({
    userId: user.id,
    facilityId: ctx.facilityId,
    userAgent: req?.headers["user-agent"] ? String(req.headers["user-agent"]) : null,
    ip: req ? clientIp(req) : null,
  });
  setRefreshCookie(res, session.refreshToken, session.expiresAt);

  const facilities = await listUserFacilities(user.id);
  return {
    facilityId: ctx.facilityId,
    role,
    staffId: staffId || null,
    ward,
    dept,
    title,
    facilities,
  };
}

async function issueAuth(
  res: import("express").Response,
  user: SessionUser,
  status = 200,
  requestedFacilityId?: string | null,
  req?: import("express").Request,
) {
  const result = await establishSession(res, user, requestedFacilityId, req);
  if ("error" in result) {
    return res.status(result.status ?? 403).json({ error: result.error || "Authentication failed." });
  }
  return res.status(status).json({
    user: publicUser(
      {
        ...user,
        role: result.role,
        title: result.title,
        ward: result.ward,
        dept: result.dept,
        staffId: result.staffId,
      },
      { facilityId: result.facilityId, facilities: result.facilities },
    ),
  });
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
  const nameParts = name.trim().split(/\s+/);
  const firstName = nameParts[0] || name;
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : name;
  const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : null;
  const patientNumber = await allocatePatientNumber(DEFAULT_FACILITY_ID);
  // No seed/default doctor assignment — admin assigns primary doctor later.
  const patient = await prisma.patient.create({
    data: {
      facilityId: DEFAULT_FACILITY_ID,
      patientNumber,
      name: composeDisplayName({ firstName, middleName, lastName, name }),
      firstName,
      middleName,
      lastName,
      age: null,
      email,
      status: "active",
      doctorId: null,
    },
  });

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: null,
      name,
      role: PUBLIC_SIGNUP_ROLE,
      title: "Patient",
      picture: profile.picture,
      googleSub: profile.sub,
      emailVerified: true,
      defaultFacilityId: DEFAULT_FACILITY_ID,
      staffId: null,
      patientId: patient.id,
      ward: null,
      dept: null,
    },
  });
  await ensureFacilityMembership(user.id, {
    facilityId: DEFAULT_FACILITY_ID,
    role: PUBLIC_SIGNUP_ROLE,
    title: "Patient",
  });
  return user;
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
    if (!user) {
      await writeAudit({
        action: "auth.login_failed",
        entity: "User",
        meta: { reason: "unknown_email" },
        req,
      });
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (user.status && user.status !== "active") {
      await writeAudit({
        actorId: user.id,
        action: "auth.login_failed",
        entity: "User",
        meta: { reason: "inactive" },
        req,
      });
      return res.status(403).json({ error: "This account is deactivated. Contact an administrator." });
    }

    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) {
      await writeAudit({
        actorId: user.id,
        action: "auth.login_failed",
        entity: "User",
        meta: { reason: "bad_password" },
        req,
      });
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const ctxPreview = await resolveFacilityContext(user.id, {
      defaultFacilityId: user.defaultFacilityId,
      platformRole: user.platformRole,
    });
    const activeRole = ctxPreview?.role || user.role;
    if (body.role && body.role !== activeRole) {
      return res.status(403).json({
        error: `This account is assigned the ${activeRole} role. Choose “${activeRole}” or use another account.`,
      });
    }

    try {
      await assertStaffActive(user);
    } catch (err) {
      const e = err as Error & { status?: number };
      return res.status(e.status || 403).json({ error: e.message });
    }

    await writeAudit({
      actorId: user.id,
      facilityId: ctxPreview?.facilityId,
      action: "auth.login",
      entity: "User",
      meta: { role: activeRole },
      req,
    });

    return issueAuth(res, user, 200, null, req);
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
    const patientNumber = await allocatePatientNumber(DEFAULT_FACILITY_ID);

    // Leave primary doctor unassigned — never hardcode seed IDs like s-doc-1.
    const patient = await prisma.patient.create({
      data: {
        facilityId: DEFAULT_FACILITY_ID,
        patientNumber,
        name,
        firstName: body.first.trim(),
        lastName: body.last.trim(),
        email,
        age: null,
        status: "active",
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
        defaultFacilityId: DEFAULT_FACILITY_ID,
        staffId: null,
        patientId: patient.id,
        ward: null,
        dept: null,
      },
    });
    await ensureFacilityMembership(user.id, {
      facilityId: DEFAULT_FACILITY_ID,
      role: PUBLIC_SIGNUP_ROLE,
      title: "Patient",
    });

    await writeAudit({
      actorId: user.id,
      facilityId: DEFAULT_FACILITY_ID,
      action: "auth.signup",
      entity: "User",
      meta: { role: user.role },
    });

    return issueAuth(res, user, 201, null, req);
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
 * Sends email via Nodemailer when SMTP is configured.
 * In non-production, also returns a local reset link so you can test without inbox delivery.
 */
router.post("/forgot-password", forgotPasswordLimiter, async (req, res, next) => {
  try {
    const body = forgotSchema.parse(req.body);
    const email = body.email.toLowerCase();
    const generic = {
      ok: true,
      message: "If an account with that email exists, a password reset link has been sent. Check your inbox (and spam).",
    };
    const isDev = process.env.NODE_ENV !== "production";

    const user = await prisma.user.findUnique({ where: { email } });

    // No account → same generic response (do not reveal whether the email exists).
    if (!user) {
      logInfo(`[password-reset] ${redactEmail(email)} result=no_account`);
      return res.json(isDev ? { ...generic, devHint: "no_account" } : generic);
    }

    // Google-only accounts can still receive a link to *set* a local password.
    const issued = await issuePasswordResetToken(user.id);
    let mailed = false;
    if (smtpConfigured()) {
      try {
        mailed = await sendPasswordResetEmail(email, issued.resetUrl);
      } catch (err) {
        logError("auth.forgot_password.mail", err);
        // Still return generic message — do not reveal mail failure to clients in production.
      }
    }

    logInfo(
      `[password-reset] ${redactEmail(email)} result=reset_token mailed=${mailed}` +
        (isDev ? ` link=${issued.resetUrl}` : ""),
    );

    await writeAudit({
      actorId: user.id,
      action: "auth.forgot_password",
      entity: "User",
      meta: { emailed: mailed },
    });

    // Do not return reset URLs to the browser — user must open the emailed link
    // (avoids jumping straight into the reset form after “Send reset link”).
    const payload: Record<string, unknown> = { ...generic, emailed: mailed };
    if (isDev) {
      payload.devMailed = mailed;
      payload.devHint = mailed ? "mailed" : "token_created_mail_skipped_or_failed";
      logInfo(`[password-reset] dev link (email only): ${issued.resetUrl}`);
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
    await revokeAllUserSessions(row.userId);

    await writeAudit({
      actorId: row.userId,
      action: "auth.reset_password",
      entity: "User",
      req,
    });

    clearAuthCookies(res);
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

    if (user.status && user.status !== "active") {
      return res.redirect(authRedirectError("This account is deactivated. Contact an administrator.", "login.html"));
    }

    const established = await establishSession(res, user, null, req);
    if ("error" in established) {
      return res.redirect(authRedirectError(established.error || "Authentication failed.", errPage));
    }

    await writeAudit({
      actorId: user.id,
      facilityId: established.facilityId,
      action: mode.intent === "signup" ? "auth.google_signup" : "auth.google",
      entity: "User",
      meta: { role: established.role },
      req,
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
    const refresh = refreshFromRequest(req);
    let userId: string | null = null;
    if (refresh) {
      const revoked = await revokeRefreshToken(refresh);
      userId = revoked.userId || null;
    }
    const token = tokenFromRequest(req);
    if (token) {
      try {
        const payload = verifyToken(token);
        userId = payload.sub;
        // Do not bump tokenVersion on single-session logout (other devices stay valid).
      } catch {
        /* ignore invalid cookie */
      }
    }
    if (userId) {
      await writeAudit({
        actorId: userId,
        action: "auth.logout",
        entity: "User",
        req,
      });
    }
    clearAuthCookies(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** Revoke all refresh sessions and invalidate access JWTs. */
router.post("/logout-all", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    await revokeAllUserSessions(userId);
    await bumpTokenVersion(userId);
    await writeAudit({
      actorId: userId,
      facilityId: req.user!.facilityId,
      action: "auth.logout_all",
      entity: "User",
      req,
    });
    clearAuthCookies(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** Rotate refresh token and issue a new short-lived access JWT. */
router.post("/refresh", async (req, res, next) => {
  try {
    const raw = refreshFromRequest(req);
    if (!raw) return res.status(401).json({ error: "Refresh token required." });

    const rotated = await rotateAuthSession(raw, {
      userAgent: req.headers["user-agent"] ? String(req.headers["user-agent"]) : null,
      ip: clientIp(req),
    });

    if (!rotated.ok) {
      clearAuthCookies(res);
      if (rotated.reason === "reuse") {
        await writeAudit({
          actorId: rotated.userId,
          action: "auth.refresh_reuse",
          entity: "AuthSession",
          meta: { familyId: rotated.familyId },
          req,
        });
        if (rotated.userId) await bumpTokenVersion(rotated.userId);
      }
      return res.status(401).json({ error: "Invalid or expired refresh token." });
    }

    const user = await prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user || (user.status && user.status !== "active")) {
      clearAuthCookies(res);
      return res.status(401).json({ error: "Invalid or expired refresh token." });
    }

    const ctx = await resolveFacilityContext(user.id, {
      requestedFacilityId: rotated.facilityId,
      defaultFacilityId: user.defaultFacilityId || DEFAULT_FACILITY_ID,
      platformRole: user.platformRole,
    });
    if (!ctx) {
      clearAuthCookies(res);
      return res.status(403).json({ error: "No active facility membership." });
    }

    const role = ctx.role;
    const staffId = ctx.membership?.staffId ?? user.staffId;
    const ward = ctx.membership?.ward ?? user.ward;
    const dept = ctx.membership?.dept ?? user.dept;
    const title = ctx.membership?.title ?? user.title;

    const access = signToken({
      sub: user.id,
      email: user.email,
      role,
      name: user.name,
      tv: user.tokenVersion ?? 0,
      facilityId: ctx.facilityId,
      platformRole: user.platformRole,
      staffId,
      patientId: user.patientId,
      ward,
      dept,
      title,
    });
    setSessionCookie(res, access);
    setRefreshCookie(res, rotated.refreshToken, rotated.expiresAt);

    await writeAudit({
      actorId: user.id,
      facilityId: ctx.facilityId,
      action: "auth.refresh",
      entity: "AuthSession",
      req,
    });

    const facilities = await listUserFacilities(user.id);
    return res.json({
      user: publicUser(
        { ...user, role, title, ward, dept, staffId: staffId || null },
        { facilityId: ctx.facilityId, facilities },
      ),
    });
  } catch (err) {
    next(err);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(6).max(128),
});

router.post("/change-password", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const body = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) return res.status(404).json({ error: "User not found." });

    const ok = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Current password is incorrect." });

    const passwordHash = await hashPassword(body.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });
    await revokeAllUserSessions(user.id);

    await writeAudit({
      actorId: user.id,
      facilityId: req.user!.facilityId,
      action: "auth.change_password",
      entity: "User",
      req,
    });

    clearAuthCookies(res);
    return res.json({ ok: true, message: "Password updated. Please sign in again." });
  } catch (err) {
    next(err);
  }
});

const switchFacilitySchema = z.object({
  facilityId: z.string().min(1).max(80),
});

/** Switch active facility — membership validated server-side; issues new cookies. */
router.post("/switch-facility", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const body = switchFacilitySchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) return res.status(404).json({ error: "User not found." });
    if (user.status && user.status !== "active") {
      return res.status(403).json({ error: "This account is deactivated." });
    }

    const ctx = await resolveFacilityContext(user.id, {
      requestedFacilityId: body.facilityId,
      defaultFacilityId: user.defaultFacilityId,
      platformRole: user.platformRole,
    });
    if (!ctx || ctx.facilityId !== body.facilityId) {
      return res.status(403).json({ error: "You are not a member of that facility." });
    }

    const currentRefresh = refreshFromRequest(req);
    if (currentRefresh) await revokeRefreshToken(currentRefresh);

    await writeAudit({
      actorId: user.id,
      facilityId: ctx.facilityId,
      action: "auth.switch_facility",
      entity: "Facility",
      meta: { from: req.user!.facilityId, to: ctx.facilityId },
      req,
    });

    return issueAuth(res, user, 200, ctx.facilityId, req);
  } catch (err) {
    next(err);
  }
});

router.get("/facilities", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const facilities = await listUserFacilities(req.user!.sub);
    res.json({ facilities, activeFacilityId: req.user!.facilityId || null });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) return res.status(404).json({ error: "User not found." });
    if (user.status && user.status !== "active") {
      clearAuthCookies(res);
      return res.status(403).json({ error: "This account is deactivated." });
    }
    try {
      await assertStaffActive(user);
    } catch (err) {
      const e = err as Error & { status?: number };
      clearAuthCookies(res);
      return res.status(e.status || 403).json({ error: e.message });
    }
    const facilities = await listUserFacilities(user.id);
    res.json({
      user: publicUser(
        {
          ...user,
          role: req.user!.role,
          staffId: req.user!.staffId ?? user.staffId,
          ward: req.user!.ward ?? user.ward,
          dept: req.user!.dept ?? user.dept,
          title: req.user!.title ?? user.title,
        },
        { facilityId: req.user!.facilityId, facilities },
      ),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
