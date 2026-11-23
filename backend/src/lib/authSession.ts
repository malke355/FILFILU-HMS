import crypto from "crypto";
import { prisma } from "./prisma.js";

const REFRESH_TTL_MS = Number(process.env.REFRESH_TOKEN_TTL_MS || 7 * 24 * 60 * 60 * 1000); // 7d
const ACCESS_TTL_SEC = Number(process.env.ACCESS_TOKEN_TTL_SEC || 15 * 60); // 15m

export function accessTokenTtlSeconds() {
  return ACCESS_TTL_SEC;
}

export function hashRefreshToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

export function generateFamilyId() {
  return crypto.randomBytes(16).toString("hex");
}

export type CreateSessionInput = {
  userId: string;
  facilityId?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  familyId?: string;
};

export async function createAuthSession(input: CreateSessionInput) {
  const raw = generateRefreshToken();
  const hash = hashRefreshToken(raw);
  const familyId = input.familyId || generateFamilyId();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  const session = await prisma.authSession.create({
    data: {
      userId: input.userId,
      refreshTokenHash: hash,
      familyId,
      facilityId: input.facilityId || null,
      userAgent: input.userAgent ? String(input.userAgent).slice(0, 400) : null,
      ip: input.ip ? String(input.ip).slice(0, 80) : null,
      expiresAt,
    },
  });
  return { session, refreshToken: raw, expiresAt };
}

/** Rotate: revoke current, create replacement in same family. Detects reuse. */
export async function rotateAuthSession(rawRefresh: string, meta?: { userAgent?: string | null; ip?: string | null }) {
  const hash = hashRefreshToken(rawRefresh);
  const current = await prisma.authSession.findUnique({ where: { refreshTokenHash: hash } });
  if (!current) {
    return { ok: false as const, reason: "not_found" as const };
  }
  if (current.revokedAt) {
    // Possible token reuse after rotation — revoke entire family
    await prisma.authSession.updateMany({
      where: { familyId: current.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: false as const, reason: "reuse" as const, userId: current.userId, familyId: current.familyId };
  }
  if (current.expiresAt.getTime() < Date.now()) {
    await prisma.authSession.update({
      where: { id: current.id },
      data: { revokedAt: new Date() },
    });
    return { ok: false as const, reason: "expired" as const };
  }

  const next = await createAuthSession({
    userId: current.userId,
    facilityId: current.facilityId,
    userAgent: meta?.userAgent ?? current.userAgent,
    ip: meta?.ip ?? current.ip,
    familyId: current.familyId,
  });

  await prisma.authSession.update({
    where: { id: current.id },
    data: { revokedAt: new Date(), replacedById: next.session.id, lastUsedAt: new Date() },
  });

  return {
    ok: true as const,
    userId: current.userId,
    facilityId: current.facilityId,
    refreshToken: next.refreshToken,
    sessionId: next.session.id,
    expiresAt: next.expiresAt,
  };
}

export async function revokeRefreshToken(rawRefresh: string) {
  const hash = hashRefreshToken(rawRefresh);
  const current = await prisma.authSession.findUnique({ where: { refreshTokenHash: hash } });
  if (!current || current.revokedAt) return { revoked: false };
  await prisma.authSession.update({
    where: { id: current.id },
    data: { revokedAt: new Date() },
  });
  return { revoked: true, userId: current.userId, sessionId: current.id };
}

export async function revokeAllUserSessions(userId: string) {
  const result = await prisma.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

export async function revokeSessionFamily(familyId: string) {
  const result = await prisma.authSession.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}
