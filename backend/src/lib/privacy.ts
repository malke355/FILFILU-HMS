/** PHI / PII helpers — keep logs and audit metadata minimal. */

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "authorization",
  "cookie",
  "message",
  "reason",
  "notes",
  "diagnosis",
  "condition",
  "phone",
  "address",
  "picture",
  "sub",
  "googlesub",
]);

export function redactEmail(email: string | null | undefined): string | undefined {
  if (!email) return undefined;
  const [user, domain] = email.split("@");
  if (!user || !domain) return "[redacted-email]";
  const keep = user.length <= 2 ? "*" : `${user.slice(0, 1)}***`;
  return `${keep}@${domain}`;
}

export function sanitizeAuditMeta(meta: unknown): Record<string, unknown> | undefined {
  if (meta == null) return undefined;
  if (typeof meta !== "object" || Array.isArray(meta)) {
    return { note: "non-object-meta-omitted" };
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lower)) {
      if (typeof value === "string") out[key] = `[redacted len=${value.length}]`;
      else out[key] = "[redacted]";
      continue;
    }
    if (lower.includes("email") && typeof value === "string") {
      out[key] = redactEmail(value);
      continue;
    }
    if (value != null && typeof value === "object") {
      out[key] = sanitizeAuditMeta(value) ?? "[redacted-object]";
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 200);
  return "unknown-error";
}
