import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { createApp } from "../app.js";
import { hashPassword } from "./auth.js";
import {
  createAuthSession,
  hashRefreshToken,
  revokeRefreshToken,
  rotateAuthSession,
} from "./authSession.js";
import { resolveFacilityContext } from "./tenant.js";

/**
 * Section 3 security integration tests.
 * Requires DATABASE_URL + JWT_SECRET. Skips otherwise.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const hasJwt = Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32);
const describeDb = hasDb && hasJwt ? describe : describe.skip;

const prisma = new PrismaClient();
const FAC_A = "fac_filfilu_default";
const FAC_B = "fac_sec_test_b";
const EMAIL = "sec-auth-a@filfilu.test";
const EMAIL_B = "sec-auth-b@filfilu.test";
const PASSWORD = "SecTestPass1!";

describeDb("Section 3 auth security (integration)", () => {
  const app = createApp();
  let userAId = "";
  let userBId = "";

  beforeAll(async () => {
    // Faster hashes in CI/local tests (production default remains 12).
    process.env.BCRYPT_COST = "10";
    await prisma.$connect();
    await prisma.facility.upsert({
      where: { id: FAC_A },
      create: {
        id: FAC_A,
        slug: "filfilu-default",
        name: "Filfilu Default Clinic",
        settings: { create: {} },
        subscription: { create: {} },
      },
      update: {},
    });
    await prisma.facility.upsert({
      where: { id: FAC_B },
      create: {
        id: FAC_B,
        slug: "sec-test-b",
        name: "Security Test Clinic B",
        settings: { create: {} },
        subscription: { create: {} },
      },
      update: {},
    });

    const passwordHash = await hashPassword(PASSWORD);
    const userA = await prisma.user.upsert({
      where: { email: EMAIL },
      create: {
        email: EMAIL,
        name: "Sec User A",
        role: "admin",
        status: "active",
        passwordHash,
        defaultFacilityId: FAC_A,
      },
      update: { passwordHash, status: "active", role: "admin", tokenVersion: 0 },
    });
    userAId = userA.id;

    const userB = await prisma.user.upsert({
      where: { email: EMAIL_B },
      create: {
        email: EMAIL_B,
        name: "Sec User B",
        role: "receptionist",
        status: "active",
        passwordHash,
        defaultFacilityId: FAC_A,
      },
      update: { passwordHash, status: "active", role: "receptionist", tokenVersion: 0 },
    });
    userBId = userB.id;

    await prisma.facilityMembership.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.facilityMembership.create({
      data: { userId: userAId, facilityId: FAC_A, role: "admin", status: "active" },
    });
    await prisma.facilityMembership.create({
      data: { userId: userBId, facilityId: FAC_A, role: "receptionist", status: "active" },
    });
    await prisma.authSession.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it(
    "1. valid users can authenticate",
    async () => {
      const res = await request(app).post("/api/auth/login").send({ email: EMAIL, password: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.user?.email).toBe(EMAIL);
      expect(res.headers["set-cookie"]?.join(";") || "").toMatch(/filfilu_token/);
      expect(res.headers["set-cookie"]?.join(";") || "").toMatch(/filfilu_refresh/);
    },
    30000,
  );

  it(
    "2. invalid credentials are rejected",
    async () => {
      const res = await request(app).post("/api/auth/login").send({ email: EMAIL, password: "wrong-password" });
      expect(res.status).toBe(401);
    },
    30000,
  );

  it(
    "3. inactive users cannot authenticate",
    async () => {
      await prisma.user.update({ where: { id: userAId }, data: { status: "inactive" } });
      const res = await request(app).post("/api/auth/login").send({ email: EMAIL, password: PASSWORD });
      expect(res.status).toBe(403);
      await prisma.user.update({ where: { id: userAId }, data: { status: "active" } });
    },
    30000,
  );

  it("5-6. refresh rotation works; revoked token cannot be reused", async () => {
    const created = await createAuthSession({ userId: userAId, facilityId: FAC_A });
    const rotated = await rotateAuthSession(created.refreshToken);
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;

    // Explicit revoke of current refresh before reuse scenario.
    const revoked = await revokeRefreshToken(rotated.refreshToken);
    expect(revoked.revoked).toBe(true);
    const afterRevoke = await rotateAuthSession(rotated.refreshToken);
    expect(afterRevoke.ok).toBe(false);

    // Separate family: rotation then reuse of the old token.
    const created2 = await createAuthSession({ userId: userAId, facilityId: FAC_A });
    const rotated2 = await rotateAuthSession(created2.refreshToken);
    expect(rotated2.ok).toBe(true);
    const reuse = await rotateAuthSession(created2.refreshToken);
    expect(reuse.ok).toBe(false);
    if (!reuse.ok) expect(reuse.reason).toBe("reuse");
  });

  it(
    "7. users cannot switch to facilities where they are not members",
    async () => {
      const login = await request(app).post("/api/auth/login").send({ email: EMAIL, password: PASSWORD });
      expect(login.status).toBe(200);
      const cookies = login.headers["set-cookie"];
      const res = await request(app)
        .post("/api/auth/switch-facility")
        .set("Cookie", cookies)
        .send({ facilityId: FAC_B });
      expect(res.status).toBe(403);
    },
    30000,
  );

  it("8. resolveFacilityContext rejects foreign facility without membership", async () => {
    const ctx = await resolveFacilityContext(userAId, {
      requestedFacilityId: FAC_B,
      defaultFacilityId: FAC_A,
    });
    expect(ctx?.facilityId).not.toBe(FAC_B);
  });

  it(
    "9. receptionist lacks clinical permission",
    async () => {
      const login = await request(app).post("/api/auth/login").send({ email: EMAIL_B, password: PASSWORD });
      expect(login.status).toBe(200);
      expect(login.body.user.permissions).not.toContain("clinical.read");
      expect(login.body.user.permissions).not.toContain("clinical.write");
    },
    30000,
  );

  it(
    "12. facility admin create rejects platform role mass-assignment",
    async () => {
      const login = await request(app).post("/api/auth/login").send({ email: EMAIL, password: PASSWORD });
      expect(login.status).toBe(200);
      const cookies = login.headers["set-cookie"];
      const res = await request(app)
        .post("/api/staff/accounts")
        .set("Cookie", cookies)
        .send({
          first: "Hack",
          last: "Attempt",
          email: `hack-${Date.now()}@filfilu.test`,
          password: "HackPass1!",
          role: "doctor",
          platformRole: "super_admin",
        });
      expect(res.status).toBe(403);
    },
    30000,
  );

  it("stores only hashed refresh tokens", async () => {
    const created = await createAuthSession({ userId: userAId, facilityId: FAC_A });
    const row = await prisma.authSession.findUnique({ where: { id: created.session.id } });
    expect(row?.refreshTokenHash).toBe(hashRefreshToken(created.refreshToken));
    expect(row?.refreshTokenHash).not.toBe(created.refreshToken);
  });
});
