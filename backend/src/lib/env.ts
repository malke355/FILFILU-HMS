/**
 * Fail-fast environment validation at process startup.
 * Development keeps localhost-friendly defaults; production requires explicit HTTPS origins.
 */

const WEAK_SECRETS = new Set([
  "",
  "filfilu-dev-secret-change-me",
  "change-me-in-production",
  "secret",
  "jwt-secret",
  "replace-with-a-long-random-secret",
  "replace-with-a-long-random-secret-at-least-32-chars",
  "CHANGE_ME",
]);

const DEV_CORS_DEFAULT = "http://127.0.0.1:8080,http://localhost:8080";

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function parseCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN?.trim() || (isProduction() ? "" : DEV_CORS_DEFAULT);
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function assertJwtSecret() {
  const s = process.env.JWT_SECRET?.trim() || "";
  if (!s || WEAK_SECRETS.has(s) || s.length < 32) {
    throw new Error(
      "JWT_SECRET is missing, too short (<32), or a known placeholder. Set a strong unique value in backend/.env.",
    );
  }
}

function assertDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim() || "";
  if (!url) {
    throw new Error("DATABASE_URL is required.");
  }
  if (!/^postgres(ql)?:\/\//i.test(url)) {
    throw new Error("DATABASE_URL must be a postgresql:// connection string.");
  }
}

function assertCorsAndFrontend() {
  const origins = parseCorsOrigins();
  if (!origins.length) {
    throw new Error(
      isProduction()
        ? "CORS_ORIGIN is required in production (comma-separated https origins, no localhost)."
        : "CORS_ORIGIN is empty.",
    );
  }

  if (!isProduction()) return;

  for (const origin of origins) {
    if (/localhost|127\.0\.0\.1/i.test(origin)) {
      throw new Error("CORS_ORIGIN must not include localhost/127.0.0.1 in production.");
    }
    if (!origin.startsWith("https://")) {
      throw new Error(`CORS_ORIGIN entry must use https:// in production: ${origin}`);
    }
  }

  const front = process.env.FRONTEND_ORIGIN?.trim() || "";
  if (!front) {
    throw new Error("FRONTEND_ORIGIN is required in production (public https site origin).");
  }
  if (/localhost|127\.0\.0\.1/i.test(front)) {
    throw new Error("FRONTEND_ORIGIN must not be localhost in production.");
  }
  if (!front.startsWith("https://")) {
    throw new Error("FRONTEND_ORIGIN must use https:// in production.");
  }
}

function assertNodeEnv() {
  const env = process.env.NODE_ENV?.trim();
  if (!env) {
    // Default to development so local starts remain simple; production deploys must set NODE_ENV.
    process.env.NODE_ENV = "development";
    return;
  }
  if (!["development", "test", "production"].includes(env)) {
    throw new Error(`NODE_ENV must be development|test|production (got "${env}").`);
  }
}

function assertGoogleIfConfigured() {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirect = process.env.GOOGLE_REDIRECT_URI?.trim();
  const any = Boolean(id || secret || redirect);
  const all = Boolean(id && secret && redirect);
  if (any && !all) {
    throw new Error(
      "Google OAuth is partially configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI together (or leave all empty).",
    );
  }
}

function assertSmtpIfConfigured() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim();
  const any = Boolean(host || user || pass || from);
  const all = Boolean(host && user && pass && from);
  if (any && !all) {
    throw new Error(
      "SMTP is partially configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM together (SMTP_PORT defaults to 587).",
    );
  }
  if (process.env.SMTP_PORT?.trim()) {
    const port = Number(process.env.SMTP_PORT);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      throw new Error("SMTP_PORT must be a valid TCP port.");
    }
  }
}

/** Call once at startup before listening. Throws on invalid config. */
export function assertEnvConfigured() {
  assertNodeEnv();
  assertJwtSecret();
  assertDatabaseUrl();
  assertCorsAndFrontend();
  assertGoogleIfConfigured();
  assertSmtpIfConfigured();
}
