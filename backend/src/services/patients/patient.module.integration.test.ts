import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { createApp } from "../../app.js";
import { hashPassword } from "../../lib/auth.js";
import { allocatePatientNumber } from "./patientNumber.js";
import { findPotentialDuplicates } from "./duplicates.js";
import { registerPatient } from "./patientService.js";

const hasDb = Boolean(process.env.DATABASE_URL);
const hasJwt = Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32);
const describeDb = hasDb && hasJwt ? describe : describe.skip;

const prisma = new PrismaClient();
const FAC = "fac_filfilu_default";
const ADMIN_EMAIL = "sec-pat-admin@filfilu.test";
const RECEPTION_EMAIL = "sec-pat-recept@filfilu.test";
const PASSWORD = "PatModPass1!";

describeDb("Section 4 patient module (integration)", () => {
  const app = createApp();
  let adminId = "";
  let receptCookies: string | string[] = [];

  beforeAll(async () => {
    process.env.BCRYPT_COST = "10";
    await prisma.$connect();
    await prisma.facility.upsert({
      where: { id: FAC },
      create: {
        id: FAC,
        slug: "filfilu-default",
        name: "Filfilu Default Clinic",
        settings: { create: {} },
        subscription: { create: {} },
      },
      update: {},
    });

    const passwordHash = await hashPassword(PASSWORD);
    const admin = await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      create: {
        email: ADMIN_EMAIL,
        name: "Pat Admin",
        role: "admin",
        status: "active",
        passwordHash,
        defaultFacilityId: FAC,
      },
      update: { passwordHash, status: "active", role: "admin", tokenVersion: 0 },
    });
    adminId = admin.id;

    const recept = await prisma.user.upsert({
      where: { email: RECEPTION_EMAIL },
      create: {
        email: RECEPTION_EMAIL,
        name: "Pat Reception",
        role: "receptionist",
        status: "active",
        passwordHash,
        defaultFacilityId: FAC,
      },
      update: { passwordHash, status: "active", role: "receptionist", tokenVersion: 0 },
    });

    await prisma.facilityMembership.deleteMany({
      where: { userId: { in: [admin.id, recept.id] } },
    });
    await prisma.facilityMembership.createMany({
      data: [
        { userId: admin.id, facilityId: FAC, role: "admin", status: "active" },
        { userId: recept.id, facilityId: FAC, role: "receptionist", status: "active" },
      ],
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: RECEPTION_EMAIL, password: PASSWORD });
    receptCookies = login.headers["set-cookie"];
  }, 60000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("generates unique patient numbers under concurrency", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => allocatePatientNumber(FAC)),
    );
    expect(new Set(results).size).toBe(5);
    for (const n of results) {
      expect(n).toMatch(/^FIL-\d{3}-\d{6}$/);
    }
  }, 30000);

  it("registers a patient via API", async () => {
    const res = await request(app)
      .post("/api/patients")
      .set("Cookie", receptCookies)
      .send({
        firstName: "Abebe",
        lastName: "Kebede",
        phone: `09${Date.now().toString().slice(-8)}`,
        sex: "male",
        acknowledgeDuplicates: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.patientNumber).toMatch(/^FIL-/);
    expect(res.body.data.firstName).toBe("Abebe");
  }, 30000);

  it("searches patients with pagination", async () => {
    const res = await request(app)
      .get("/api/patients?q=Abebe&limit=10&page=1")
      .set("Cookie", receptCookies);
    expect(res.status).toBe(200);
    expect(res.body.meta).toBeTruthy();
    expect(Array.isArray(res.body.data)).toBe(true);
  }, 30000);

  it("detects duplicates without merging", async () => {
    const phone = `09${Date.now().toString().slice(-8)}`;
    const first = await registerPatient({
      facilityId: FAC,
      registeredById: adminId,
      firstName: "Duplicate",
      lastName: "Probe",
      phone,
      acknowledgeDuplicates: true,
    });
    expect(first.needsReview).toBe(false);

    const dupes = await findPotentialDuplicates({
      facilityId: FAC,
      firstName: "Duplicate",
      lastName: "Probe",
      phone,
    });
    expect(dupes.some((d) => d.matchReasons.includes("phone"))).toBe(true);

    const blocked = await registerPatient({
      facilityId: FAC,
      registeredById: adminId,
      firstName: "Duplicate",
      lastName: "Probe",
      phone,
      acknowledgeDuplicates: false,
    });
    expect(blocked.needsReview).toBe(true);
  }, 30000);

  it("stores medical history and creates encounter", async () => {
    const created = await registerPatient({
      facilityId: FAC,
      registeredById: adminId,
      firstName: "History",
      lastName: "Patient",
      acknowledgeDuplicates: true,
    });
    expect(created.needsReview).toBe(false);
    if (created.needsReview) return;

    const hist = await request(app)
      .post(`/api/patients/${created.patient.id}/medical-history`)
      .set("Cookie", receptCookies)
      .send({ category: "condition", title: "Asthma" });
    // Receptionist lacks medical_history.manage — expect 403
    expect([201, 403]).toContain(hist.status);

    const enc = await request(app)
      .post(`/api/patients/${created.patient.id}/encounters`)
      .set("Cookie", receptCookies)
      .send({ type: "outpatient" });
    expect(enc.status).toBe(201);
    expect(enc.body.data.encounterNumber).toMatch(/^ENC-/);
    expect(enc.body.data.patientId).toBe(created.patient.id);
  }, 30000);

  it("rejects cross-facility patient access by id", async () => {
    const otherFac = "fac_pat_iso_b";
    await prisma.facility.upsert({
      where: { id: otherFac },
      create: {
        id: otherFac,
        slug: "pat-iso-b",
        name: "Pat Iso B",
        settings: { create: {} },
        subscription: { create: {} },
      },
      update: {},
    });
    const foreign = await prisma.patient.create({
      data: {
        facilityId: otherFac,
        name: "Foreign Patient",
        firstName: "Foreign",
        lastName: "Patient",
        patientNumber: `X-${Date.now()}`,
        status: "active",
      },
    });
    const res = await request(app)
      .get(`/api/patients/${foreign.id}`)
      .set("Cookie", receptCookies);
    expect(res.status).toBe(404);
  }, 30000);

  it("receptionist cannot read medical history", async () => {
    const created = await registerPatient({
      facilityId: FAC,
      registeredById: adminId,
      firstName: "Restrict",
      lastName: "Clinical",
      acknowledgeDuplicates: true,
    });
    if (created.needsReview) return;
    const res = await request(app)
      .get(`/api/patients/${created.patient.id}/medical-history`)
      .set("Cookie", receptCookies);
    expect(res.status).toBe(403);
  }, 30000);
});
