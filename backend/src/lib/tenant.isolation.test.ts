import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { resolveFacilityContext, assertSameFacilityPatient } from "./tenant.js";

/**
 * DB-backed isolation tests. Skips when DATABASE_URL is unset.
 * Expects multi-tenant migration applied (default facility exists).
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const prisma = new PrismaClient();

const describeDb = hasDb ? describe : describe.skip;

describeDb("tenant isolation (database)", () => {
  const FAC_A = "fac_filfilu_default";
  const FAC_B = "fac_iso_test_b";
  let userAId = "";
  let userBId = "";
  let patientAId = "";
  let patientBId = "";

  beforeAll(async () => {
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
        slug: "iso-test-b",
        name: "Isolation Test Clinic B",
        settings: { create: {} },
        subscription: { create: {} },
      },
      update: {},
    });

    const userA = await prisma.user.upsert({
      where: { email: "iso-a@filfilu.test" },
      create: {
        email: "iso-a@filfilu.test",
        name: "Iso User A",
        role: "admin",
        defaultFacilityId: FAC_A,
      },
      update: { defaultFacilityId: FAC_A },
    });
    userAId = userA.id;

    const userB = await prisma.user.upsert({
      where: { email: "iso-b@filfilu.test" },
      create: {
        email: "iso-b@filfilu.test",
        name: "Iso User B",
        role: "admin",
        defaultFacilityId: FAC_B,
      },
      update: { defaultFacilityId: FAC_B },
    });
    userBId = userB.id;

    await prisma.facilityMembership.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.facilityMembership.create({
      data: { userId: userAId, facilityId: FAC_A, role: "admin", status: "active" },
    });
    await prisma.facilityMembership.create({
      data: { userId: userBId, facilityId: FAC_B, role: "admin", status: "active" },
    });

    await prisma.department.upsert({
      where: { facilityId_name: { facilityId: FAC_A, name: "Iso Dept A" } },
      create: { facilityId: FAC_A, name: "Iso Dept A" },
      update: {},
    });
    await prisma.department.upsert({
      where: { facilityId_name: { facilityId: FAC_B, name: "Iso Dept A" } },
      create: { facilityId: FAC_B, name: "Iso Dept A" },
      update: {},
    });

    const pA = await prisma.patient.create({
      data: { facilityId: FAC_A, name: "Iso Patient A", age: 40, patientNumber: `ISO-A-${Date.now()}` },
    });
    const pB = await prisma.patient.create({
      data: { facilityId: FAC_B, name: "Iso Patient B", age: 41, patientNumber: `ISO-B-${Date.now()}` },
    });
    patientAId = pA.id;
    patientBId = pB.id;
  }, 60000);

  afterAll(async () => {
    await prisma.patient.deleteMany({ where: { id: { in: [patientAId, patientBId].filter(Boolean) } } });
    await prisma.facilityMembership.deleteMany({ where: { userId: { in: [userAId, userBId].filter(Boolean) } } });
    await prisma.user.deleteMany({ where: { email: { in: ["iso-a@filfilu.test", "iso-b@filfilu.test"] } } });
    await prisma.department.deleteMany({ where: { name: "Iso Dept A" } });
    await prisma.facilitySubscription.deleteMany({ where: { facilityId: FAC_B } });
    await prisma.facilitySettings.deleteMany({ where: { facilityId: FAC_B } });
    await prisma.facility.deleteMany({ where: { id: FAC_B } });
    await prisma.$disconnect();
  });

  it("resolves membership facility for authorized user", async () => {
    const ctx = await resolveFacilityContext(userAId, { defaultFacilityId: FAC_A });
    expect(ctx?.facilityId).toBe(FAC_A);
    expect(ctx?.role).toBe("admin");
  });

  it("rejects access to a facility the user does not belong to", async () => {
    const ctx = await resolveFacilityContext(userAId, {
      requestedFacilityId: FAC_B,
      defaultFacilityId: FAC_A,
    });
    // Falls back to a membership they do have (A), never grants B
    expect(ctx?.facilityId).toBe(FAC_A);
    expect(ctx?.facilityId).not.toBe(FAC_B);
  });

  it("Facility A cannot retrieve Facility B patients via scoped query", async () => {
    const rows = await prisma.patient.findMany({ where: { facilityId: FAC_A, id: patientBId } });
    expect(rows).toHaveLength(0);
    const own = await prisma.patient.findMany({ where: { facilityId: FAC_A, id: patientAId } });
    expect(own).toHaveLength(1);
  });

  it("assertSameFacilityPatient rejects cross-tenant patient id", async () => {
    await expect(assertSameFacilityPatient(FAC_A, patientBId)).rejects.toMatchObject({
      status: 400,
    });
    await expect(assertSameFacilityPatient(FAC_A, patientAId)).resolves.toMatchObject({
      id: patientAId,
    });
  });

  it("allows same department name in two facilities (tenant-aware uniqueness)", async () => {
    const a = await prisma.department.findUnique({
      where: { facilityId_name: { facilityId: FAC_A, name: "Iso Dept A" } },
    });
    const b = await prisma.department.findUnique({
      where: { facilityId_name: { facilityId: FAC_B, name: "Iso Dept A" } },
    });
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a!.id).not.toBe(b!.id);
  });

  it("rejects duplicate department name inside one facility", async () => {
    await expect(
      prisma.department.create({ data: { facilityId: FAC_A, name: "Iso Dept A" } }),
    ).rejects.toThrow();
  });
});
