import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { createApp } from "../../app.js";
import { hashPassword } from "../../lib/auth.js";
import { assertSlotAvailable, rangesOverlap, timeToMinutes } from "../../lib/appointments.js";
import { allocateQueueNumber } from "./numbering.js";
import { bookAppointment } from "./booking.js";

const hasDb = Boolean(process.env.DATABASE_URL);
const hasJwt = Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32);
const describeDb = hasDb && hasJwt ? describe : describe.skip;

const prisma = new PrismaClient();
const FAC = "fac_filfilu_default";
const EMAIL = "sec-appt-admin@filfilu.test";
const PASSWORD = "ApptModPass1!";

describeDb("Section 5 appointment & queue (integration)", () => {
  const app = createApp();
  let adminId = "";
  let doctorId = "";
  let patientId = "";
  let cookies: string | string[] = [];

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
      where: { email: EMAIL },
      create: {
        email: EMAIL,
        name: "Appt Admin",
        role: "admin",
        status: "active",
        passwordHash,
        defaultFacilityId: FAC,
      },
      update: { passwordHash, status: "active", role: "admin", tokenVersion: 0 },
    });
    adminId = admin.id;

    await prisma.facilityMembership.deleteMany({ where: { userId: adminId } });
    await prisma.facilityMembership.create({
      data: { userId: adminId, facilityId: FAC, role: "admin", status: "active" },
    });

    const doctor = await prisma.staff.create({
      data: {
        facilityId: FAC,
        name: `Dr Appt ${Date.now()}`,
        role: "doctor",
        dept: "General",
        status: "active",
      },
    });
    doctorId = doctor.id;

    const patient = await prisma.patient.create({
      data: {
        facilityId: FAC,
        name: "Appt Patient",
        firstName: "Appt",
        lastName: "Patient",
        patientNumber: `APT-P-${Date.now()}`,
        status: "active",
      },
    });
    patientId = patient.id;

    const login = await request(app).post("/api/auth/login").send({ email: EMAIL, password: PASSWORD });
    cookies = login.headers["set-cookie"];
  }, 60000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("overlap helper detects conflicting ranges", () => {
    expect(rangesOverlap(540, 570, 560, 590)).toBe(true);
    expect(rangesOverlap(540, 570, 570, 600)).toBe(false);
    expect(timeToMinutes("09:00")).toBe(540);
  });

  it("creates appointment via book API", async () => {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    const iso = date.toISOString().slice(0, 10);
    const res = await request(app)
      .post("/api/appointments/book")
      .set("Cookie", cookies)
      .send({
        patientId,
        doctorId,
        date: iso,
        time: "10:00",
        dept: "General",
        type: "general",
      });
    expect(res.status).toBe(201);
    expect(res.body.data.appointmentNumber).toMatch(/^APT-/);
    expect(res.body.data.endTime).toBe("10:30");
  }, 30000);

  it("prevents double booking same slot (concurrent)", async () => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    const iso = date.toISOString().slice(0, 10);
    const time = "11:00";

    const results = await Promise.allSettled([
      bookAppointment({
        facilityId: FAC,
        patientId,
        doctorId,
        date: iso,
        time,
        dept: "General",
        createdById: adminId,
        initialStatus: "confirmed",
      }),
      bookAppointment({
        facilityId: FAC,
        patientId,
        doctorId,
        date: iso,
        time,
        dept: "General",
        createdById: adminId,
        initialStatus: "confirmed",
      }),
    ]);

    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(ok.length).toBe(1);
    expect(failed.length).toBe(1);
  }, 30000);

  it("respects provider unavailability", async () => {
    const date = new Date();
    date.setDate(date.getDate() + 4);
    const iso = date.toISOString().slice(0, 10);
    await prisma.providerUnavailability.create({
      data: {
        facilityId: FAC,
        staffId: doctorId,
        startDate: iso,
        endDate: iso,
        allDay: true,
        reason: "leave",
        createdById: adminId,
      },
    });
    await expect(
      assertSlotAvailable(doctorId, iso, "09:00", { facilityId: FAC, durationMinutes: 30 }),
    ).rejects.toMatchObject({ status: 409 });
  }, 30000);

  it("allocates unique queue numbers concurrently", async () => {
    const day = new Date().toISOString().slice(0, 10);
    const nums = await Promise.all(
      Array.from({ length: 5 }, () => allocateQueueNumber(FAC, "GENERAL", day)),
    );
    expect(new Set(nums).size).toBe(5);
  }, 30000);

  it("check-in does not create duplicate queue entries", async () => {
    const date = new Date();
    date.setDate(date.getDate() + 5);
    const iso = date.toISOString().slice(0, 10);
    const booked = await bookAppointment({
      facilityId: FAC,
      patientId,
      doctorId,
      date: iso,
      time: "14:00",
      dept: "General",
      createdById: adminId,
      initialStatus: "confirmed",
    });

    const first = await request(app)
      .post(`/api/appointments/${booked.id}/check-in`)
      .set("Cookie", cookies)
      .send({});
    expect([200, 201]).toContain(first.status);

    const second = await request(app)
      .post(`/api/appointments/${booked.id}/check-in`)
      .set("Cookie", cookies)
      .send({});
    expect(second.status).toBe(200);
    expect(second.body.data.duplicate).toBe(true);
  }, 30000);

  it("rejects cross-facility appointment access", async () => {
    const otherFac = "fac_appt_iso_b";
    await prisma.facility.upsert({
      where: { id: otherFac },
      create: {
        id: otherFac,
        slug: "appt-iso-b",
        name: "Appt Iso B",
        settings: { create: {} },
        subscription: { create: {} },
      },
      update: {},
    });
    const foreignDoctor = await prisma.staff.create({
      data: {
        facilityId: otherFac,
        name: "Foreign Doc",
        role: "doctor",
        dept: "X",
        status: "active",
      },
    });
    const foreignPatient = await prisma.patient.create({
      data: {
        facilityId: otherFac,
        name: "Foreign P",
        firstName: "F",
        lastName: "P",
        status: "active",
      },
    });
    const foreignAppt = await prisma.appointment.create({
      data: {
        facilityId: otherFac,
        patientId: foreignPatient.id,
        doctorId: foreignDoctor.id,
        date: "2099-01-01",
        time: "10:00",
        dept: "X",
        status: "confirmed",
      },
    });
    const res = await request(app)
      .get(`/api/appointments/${foreignAppt.id}/history`)
      .set("Cookie", cookies);
    expect(res.status).toBe(404);
  }, 30000);
});
