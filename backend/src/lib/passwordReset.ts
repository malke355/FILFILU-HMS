import crypto from "node:crypto";
import { prisma } from "./prisma.js";
import { frontendOrigin } from "./google.js";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export function hashResetToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function createRawResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function buildResetPasswordUrl(rawToken: string) {
  const base = frontendOrigin().endsWith("/") ? frontendOrigin() : `${frontendOrigin()}/`;
  const url = new URL("reset-password.html", base);
  url.searchParams.set("token", rawToken);
  return url.toString();
}

/**
 * Creates a single-use reset token for a password-based account.
 * Returns the raw token (show/email once) — only the hash is stored.
 */
export async function issuePasswordResetToken(userId: string) {
  const rawToken = createRawResetToken();
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await prisma.passwordResetToken.deleteMany({
    where: { userId, usedAt: null },
  });

  await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return { rawToken, expiresAt, resetUrl: buildResetPasswordUrl(rawToken) };
}

export async function consumePasswordResetToken(rawToken: string) {
  const tokenHash = hashResetToken(rawToken);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    return null;
  }

  return row;
}

export async function markResetTokenUsed(id: string, userId: string) {
  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId, usedAt: null },
    }),
  ]);
}
