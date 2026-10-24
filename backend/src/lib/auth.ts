import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { Role } from "./roles.js";

export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
  name: string;
  staffId?: string | null;
  patientId?: string | null;
  ward?: string | null;
  dept?: string | null;
  title?: string | null;
};

function secret() {
  return process.env.JWT_SECRET || "filfilu-dev-secret-change-me";
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
  return jwt.verify(token, secret()) as JwtPayload;
}
