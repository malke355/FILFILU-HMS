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
