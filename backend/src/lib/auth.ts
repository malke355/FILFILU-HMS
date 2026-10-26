import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { Role } from "./roles.js";

export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
  name: string;
  /** Session generation — must match User.tokenVersion or the token is rejected. */
  tv: number;
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

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string | null | undefined) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, secret(), {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, secret(), { algorithms: ["HS256"] }) as JwtPayload;
}
