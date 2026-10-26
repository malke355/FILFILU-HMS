import { OAuth2Client } from "google-auth-library";
import crypto from "node:crypto";

const SCOPES = ["openid", "email", "profile"];

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
};

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is not configured.`);
  return v;
}

/**
 * Default skew is 5 minutes (library-safe).
 * Local broken Windows clocks may set GOOGLE_CLOCK_TOLERANCE_SEC higher (never in production).
 */
function clockSkewSeconds() {
  const fallback = 300;
  const raw = process.env.GOOGLE_CLOCK_TOLERANCE_SEC;
  if (raw == null || raw === "") return fallback;
  const skew = Number(raw);
  if (!Number.isFinite(skew) || skew < 0) return fallback;
  if (process.env.NODE_ENV === "production" && skew > 300) {
    throw new Error(
      "GOOGLE_CLOCK_TOLERANCE_SEC cannot exceed 300 seconds in production. Fix server clock sync instead.",
    );
  }
  return skew;
}

/**
 * google-auth-library v10+ hardcodes CLOCK_SKEW_SECS_ = 300 and ignores
 * `client.clockTolerance`. Override only when env asks (local clock drift).
 */
function applyLibraryClockSkew() {
  const skew = clockSkewSeconds();
  const ctor = OAuth2Client as unknown as { CLOCK_SKEW_SECS_?: number };
  if (typeof ctor.CLOCK_SKEW_SECS_ === "number") {
    ctor.CLOCK_SKEW_SECS_ = skew;
  }
}

applyLibraryClockSkew();

/** Fail fast in production if OAuth / frontend URLs are still localhost. */
export function assertGoogleProductionConfig() {
  if (process.env.NODE_ENV !== "production") return;
  // Re-validate skew rule at startup even if Google is unused.
  clockSkewSeconds();

  const redirect = process.env.GOOGLE_REDIRECT_URI?.trim() || "";
  const front = process.env.FRONTEND_ORIGIN?.trim() || "";
  const cors = process.env.CORS_ORIGIN?.trim() || "";

  if (googleConfigured()) {
    if (/localhost|127\.0\.0\.1/i.test(redirect)) {
      throw new Error(
        "GOOGLE_REDIRECT_URI must be your public HTTPS callback in production (not localhost). Register it in Google Cloud Console too.",
      );
    }
    if (!redirect.startsWith("https://")) {
      throw new Error("GOOGLE_REDIRECT_URI must use https:// in production.");
    }
  }

  if (front && /localhost|127\.0\.0\.1/i.test(front)) {
    throw new Error("FRONTEND_ORIGIN must be your public HTTPS site origin in production (not localhost).");
  }
  if (front && !front.startsWith("https://")) {
    throw new Error("FRONTEND_ORIGIN must use https:// in production.");
  }
  if (cors && /localhost|127\.0\.0\.1/i.test(cors)) {
    throw new Error("CORS_ORIGIN must not include localhost in production.");
  }
}

export function googleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_REDIRECT_URI?.trim(),
  );
}

export function createGoogleClient() {
  return new OAuth2Client(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    requireEnv("GOOGLE_REDIRECT_URI"),
  );
}

/** User-facing Google auth errors (never dump JWT payloads into the UI). */
export function friendlyGoogleError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Google sign-in failed.";
  if (/Token used too (late|early)/i.test(message)) {
    return "Your computer’s date & time is out of sync with Google. In Windows: Settings → Time & language → Date & time → turn on “Set time automatically”, then try Sign in with Google again.";
  }
  if (/No Filfilu account found/i.test(message)) {
    return message;
  }
  if (/already uses a password|Forgot password|cannot attach/i.test(message)) {
    return message;
  }
  if (/Wrong recipient|audience|invalid token|jwt/i.test(message) || message.includes("{") || message.includes("iat")) {
    return "Google sign-in failed. Please try again.";
  }
  if (message.length > 160) return "Google sign-in failed. Please try again.";
  return message;
}

export function buildGoogleAuthUrl(state: string) {
  const client = createGoogleClient();
  return client.generateAuthUrl({
    access_type: "online",
    scope: SCOPES,
    prompt: "select_account",
    state,
    include_granted_scopes: false,
  });
}

export function newOAuthState() {
  return crypto.randomBytes(24).toString("hex");
}

/** Exchange code, then verify the ID token with google-auth-library. */
export async function exchangeCodeAndVerify(code: string): Promise<GoogleProfile> {
  applyLibraryClockSkew();
  const client = createGoogleClient();
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) {
    throw new Error("Google did not return an ID token.");
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub) throw new Error("Invalid Google ID token payload.");
  if (!payload.email) throw new Error("Google account has no email.");
  if (payload.email_verified !== true) {
    throw new Error("Google email is not verified.");
  }

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: true,
    name: payload.name || payload.email.split("@")[0] || "Google user",
    picture: payload.picture || null,
  };
}

export function frontendOrigin() {
  return (
    process.env.FRONTEND_ORIGIN?.trim() ||
    process.env.CORS_ORIGIN?.split(",")[0]?.trim() ||
    "http://127.0.0.1:8080"
  );
}
