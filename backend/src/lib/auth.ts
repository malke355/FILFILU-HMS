import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { Role } from "./roles.js";

export type JwtPayload = {
  sub: string;
  email: string;
  /** Facility-scoped role for the active facility (or admin for platform super_admin). */
  role: Role;
  name: string;
  /** Session generation — must match User.tokenVersion or the token is rejected. */
  tv: number;
  /** Active facility for this session — required for tenant-scoped APIs. */
  facilityId?: string | null;
  platformRole?: string | null;
  staffId?: string | null;
  patientId?: string | null;
  ward?: string | null;
  dept?: string | null;
  title?: string | null;
};

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

function secret() {
  const s = process.env.JWT_SECRET?.trim() || "";
  if (!s || WEAK_SECRETS.has(s) || s.length < 32) {
    throw new Error(
      "JWT_SECRET is missing, too short (<32), or a known placeholder. Set a strong unique value in backend/.env.",
    );
  }
  return s;
}

/** bcrypt cost — default 12 (was 10). Override with BCRYPT_COST. */
export async function hashPassword(password: string) {
  const cost = Number(process.env.BCRYPT_COST || 12);
  const rounds = Number.isFinite(cost) && cost >= 10 && cost <= 15 ? cost : 12;
  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(password: string, hash: string | null | undefined) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

/** Access JWT — default 15m (override JWT_EXPIRES_IN or ACCESS_TOKEN_TTL_SEC). */
export function signToken(payload: JwtPayload) {
  const expiresIn = (process.env.JWT_EXPIRES_IN ||
    `${Number(process.env.ACCESS_TOKEN_TTL_SEC || 15 * 60)}s`) as SignOptions["expiresIn"];
  return jwt.sign(payload, secret(), { expiresIn });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, secret(), { algorithms: ["HS256"] }) as JwtPayload;
}
