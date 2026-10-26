import { prisma } from "./prisma.js";

/** Invalidate all existing JWTs for this user (logout, deactivate, role/password change). */
export async function bumpTokenVersion(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}

/** Invalidate sessions for every user linked to a staff row. */
export async function bumpTokenVersionForStaff(staffId: string) {
  await prisma.user.updateMany({
    where: { staffId },
    data: { tokenVersion: { increment: 1 } },
  });
}
