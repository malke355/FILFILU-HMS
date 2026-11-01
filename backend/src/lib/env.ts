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
  "replace_with_your_jwt_secret",
  "replace-with-your-jwt-secret",
  "CHANGE_ME",
]);

const DEV_CORS_DEFAULT = "http://127.0.0.1:8080,http://localhost:8080";

/** Strip accidental quotes from dashboard/.env paste (e.g. "postgresql://…"). */
export function stripEnvQuotes(value: string | undefined): string {
  const s = value?.trim() || "";
  if (s.length >= 2) {
    const q = s[0];
    if ((q === '"' || q === "'") && s[s.length - 1] === q) {
      return s.slice(1, -1).trim();
    }
  }
  return s;
}

function readEnv(name: string): string {
  const cleaned = stripEnvQuotes(process.env[name]);
  if (process.env[name] !== undefined && process.env[name] !== cleaned) {
    process.env[name] = cleaned;
  }
  return cleaned;
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function parseCorsOrigins(): string[] {
  const raw = readEnv("CORS_ORIGIN") || (isProduction() ? "" : DEV_CORS_DEFAULT);
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function assertJwtSecret() {
  const s = readEnv("JWT_SECRET");
  if (!s || WEAK_SECRETS.has(s.toLowerCase()) || s.length < 32) {
    throw new Error(
      "JWT_SECRET is missing, too short (<32), or a known placeholder. Set a strong unique value in Render Environment (or backend/.env).",
    );
  }
}

function assertDatabaseUrl() {
  const url = readEnv("DATABASE_URL");
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

  const front = readEnv("FRONTEND_ORIGIN");
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
  const env = readEnv("NODE_ENV");
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
  const id = readEnv("GOOGLE_CLIENT_ID");
  const secret = readEnv("GOOGLE_CLIENT_SECRET");
  const redirect = readEnv("GOOGLE_REDIRECT_URI");
  const any = Boolean(id || secret || redirect);
  const all = Boolean(id && secret && redirect);
  if (any && !all) {
    throw new Error(
      "Google OAuth is partially configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI together (or leave all empty).",
    );
  }
}

function assertSmtpIfConfigured() {
  const host = readEnv("SMTP_HOST");
  const user = readEnv("SMTP_USER");
  const pass = readEnv("SMTP_PASS");
  const from = readEnv("SMTP_FROM");
  const any = Boolean(host || user || pass || from);
  const all = Boolean(host && user && pass && from);
  if (any && !all) {
    throw new Error(
      "SMTP is partially configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM together (SMTP_PORT defaults to 587).",
    );
  }
  const smtpPort = readEnv("SMTP_PORT");
  if (smtpPort) {
    const port = Number(smtpPort);
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
