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

function clockSkewSeconds() {
  const skew = Number(process.env.GOOGLE_CLOCK_TOLERANCE_SEC || 86400);
  return Number.isFinite(skew) && skew >= 0 ? skew : 86400;
}

/**
 * google-auth-library v10+ hardcodes CLOCK_SKEW_SECS_ = 300 and ignores
 * `client.clockTolerance`. Windows demo clocks are often hours off, which
 * surfaces as "Token used too late" with a raw JWT dump. Widen skew for local use.
 */
function applyLibraryClockSkew() {
  const skew = clockSkewSeconds();
  const ctor = OAuth2Client as unknown as { CLOCK_SKEW_SECS_?: number };
  if (typeof ctor.CLOCK_SKEW_SECS_ === "number") {
    ctor.CLOCK_SKEW_SECS_ = skew;
  }
}

applyLibraryClockSkew();

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
