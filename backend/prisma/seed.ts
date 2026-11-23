import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PERMISSIONS } from "../src/lib/rbac.js";
import { DEFAULT_FACILITY_ID } from "../src/lib/tenant.js";

const prisma = new PrismaClient();

const FAC_A = DEFAULT_FACILITY_ID; // fac_filfilu_default
const FAC_B = "fac_demo_bole";

/**
 * Destructive demo seed — wipes HMS tables then loads multi-facility DEMO data.
 * Blocked in production unless ALLOW_DESTRUCTIVE_SEED=1.
 * Always requires CONFIRM_SEED=YES to run.
 */
async function seedPermissions() {
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  for (const [role, codes] of Object.entries(PERMISSIONS)) {
    for (const code of codes) {
      const perm = await prisma.permission.upsert({
        where: { code },
        create: { code, description: code },
        update: {},
      });
      await prisma.rolePermission.create({
        data: { role, permissionId: perm.id },
      });
    }
  }
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DESTRUCTIVE_SEED !== "1") {
    throw new Error(
      "Refusing to seed in production (would wipe the database). Set ALLOW_DESTRUCTIVE_SEED=1 only if you intentionally want a destructive demo reset.",
    );
  }
  if (process.env.CONFIRM_SEED !== "YES") {
    throw new Error(
      'Seed is destructive (deletes all rows). Re-run with CONFIRM_SEED=YES, e.g. PowerShell: $env:CONFIRM_SEED="YES"; npm run db:seed',
    );
  }

  console.warn(
    '[seed] Wiping tables and loading DEMO multi-facility data. Demo password: "filfilu" — local/dev only.',
  );

  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.patientAllergy.deleteMany();
  await prisma.patientEmergencyContact.deleteMany();
  await prisma.patientIdentifier.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.bookingRequest.deleteMany();
  await prisma.contactMessage.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.doctorSchedule.deleteMany();
  await prisma.doctorPublic.deleteMany();
  await prisma.exchange.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.facilityMembership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.department.deleteMany();
  await prisma.facilitySubscription.deleteMany();
  await prisma.facilitySettings.deleteMany();
  await prisma.facility.deleteMany();

  await seedPermissions();

  await prisma.facility.create({
    data: {
      id: FAC_A,
      slug: "filfilu-default",
      name: "Filfilu Default Clinic",
      status: "active",
      timezone: "Africa/Addis_Ababa",
      settings: { create: { locale: "en" } },
      subscription: { create: { planCode: "pilot", seatLimit: 100 } },
    },
  });
  await prisma.facility.create({
    data: {
      id: FAC_B,
      slug: "bole-care-demo",
      name: "Bole Care Demo Clinic",
      status: "active",
      timezone: "Africa/Addis_Ababa",
      settings: { create: { locale: "en" } },
      subscription: { create: { planCode: "pilot", seatLimit: 50 } },
    },
  });

  for (const facilityId of [FAC_A, FAC_B]) {
    const suffix = facilityId === FAC_A ? "" : " (Bole)";
    for (const name of [
      "General Medicine",
      "Cardiology",
      "Pediatrics",
      "Maternity",
      "Orthopedics",
      "Neurology",
      "Dermatology",
      "Ophthalmology",
      "Administration",
    ]) {
      await prisma.department.create({ data: { facilityId, name: name + (suffix && name === "Administration" ? suffix : "") } });
    }
  }
  // Fix: departments should have same names per facility — recreate B cleanly
  await prisma.department.deleteMany({ where: { facilityId: FAC_B } });
  for (const name of [
    "General Medicine",
    "Cardiology",
    "Pediatrics",
    "Maternity",
    "Administration",
  ]) {
    await prisma.department.create({ data: { facilityId: FAC_B, name } });
  }

  const staffA = [
    { id: "s-doc-1", name: "Dr. Helen Tesfaye", role: "doctor", dept: "General Medicine", phone: "+251 911 100 001" },
    { id: "s-doc-2", name: "Dr. Sara Mekonnen", role: "doctor", dept: "Cardiology", phone: "+251 911 100 002" },
    { id: "s-doc-3", name: "Dr. Dawit Bekele", role: "doctor", dept: "Pediatrics", phone: "+251 911 100 003" },
    { id: "s-doc-4", name: "Dr. Rahel Desta", role: "doctor", dept: "Maternity", phone: "+251 911 100 004" },
    { id: "s-doc-5", name: "Dr. Bemnet Girma", role: "doctor", dept: "Orthopedics", phone: "+251 911 100 005" },
    { id: "s-doc-6", name: "Dr. Kidist Alemu", role: "doctor", dept: "Neurology", phone: "+251 911 100 006" },
    { id: "s-doc-7", name: "Dr. Yared Negash", role: "doctor", dept: "Dermatology", phone: "+251 911 100 007" },
    { id: "s-doc-8", name: "Dr. Meron Tadesse", role: "doctor", dept: "Ophthalmology", phone: "+251 911 100 008" },
    { id: "s-nurse-1", name: "Rahel Abebe", role: "nurse", dept: "Maternity", ward: "Ward A", phone: "+251 911 100 011" },
    { id: "s-nurse-2", name: "Lidya Tadesse", role: "nurse", dept: "General Medicine", ward: "Ward B", phone: "+251 911 100 012" },
    { id: "s-admin", name: "Selam Bekele", role: "admin", dept: "Administration", phone: "+251 911 100 099" },
  ];
  for (const s of staffA) {
    await prisma.staff.create({ data: { ...s, facilityId: FAC_A } });
  }

  const staffB = [
    { id: "s-b-admin", name: "Demo Bole Admin", role: "admin", dept: "Administration", phone: "+251 911 200 099" },
    { id: "s-b-doc-1", name: "Dr. Bole Demo", role: "doctor", dept: "General Medicine", phone: "+251 911 200 001" },
    { id: "s-b-nurse-1", name: "Nurse Bole Demo", role: "nurse", dept: "Maternity", ward: "Ward 1", phone: "+251 911 200 011" },
  ];
  for (const s of staffB) {
    await prisma.staff.create({ data: { ...s, facilityId: FAC_B } });
  }

  const patientsA = [
    { id: "p-1", name: "Amina Mohammed", age: 29, sex: "F", blood: "O+", phone: "+251 911 200 001", condition: "Hypertension follow-up", doctorId: "s-doc-1", patientNumber: "A-0001" },
    { id: "p-2", name: "Yonas Hailu", age: 41, sex: "M", blood: "A+", phone: "+251 911 200 002", condition: "Cardiac monitoring", doctorId: "s-doc-2", ward: "Ward A", bed: "A-12", patientNumber: "A-0002" },
    { id: "p-3", name: "Hana Kebede", age: 8, sex: "F", blood: "B+", phone: "+251 911 200 003", condition: "Pediatric fever review", doctorId: "s-doc-3", ward: "Ward B", bed: "B-03", patientNumber: "A-0003" },
    { id: "p-4", name: "Mulugeta Assefa", age: 55, sex: "M", blood: "AB+", phone: "+251 911 200 004", condition: "Diabetes review", doctorId: "s-doc-1", ward: "Ward A", bed: "A-07", patientNumber: "A-0004" },
    { id: "p-5", name: "Kidist Alemu", age: 33, sex: "F", blood: "O-", phone: "+251 911 200 005", condition: "ECG screening", doctorId: "s-doc-2", patientNumber: "A-0005" },
  ];
  for (const p of patientsA) {
    await prisma.patient.create({ data: { ...p, facilityId: FAC_A } });
  }

  await prisma.patient.create({
    data: {
      id: "p-b-1",
      facilityId: FAC_B,
      patientNumber: "B-0001",
      name: "Bole Demo Patient",
      age: 35,
      sex: "M",
      phone: "+251 911 300 001",
      condition: "Demo visit only",
      doctorId: "s-b-doc-1",
    },
  });

  await prisma.patientIdentifier.create({
    data: { patientId: "p-1", facilityId: FAC_A, system: "national_id_demo", value: "ETH-DEMO-0001" },
  });
  await prisma.patientAllergy.create({
    data: { patientId: "p-1", substance: "Penicillin (demo)", severity: "moderate", reaction: "Rash" },
  });
  await prisma.patientEmergencyContact.create({
    data: { patientId: "p-1", name: "Demo Contact", relationship: "Spouse", phone: "+251 911 000 000", isPrimary: true },
  });

  const passwordHash = await bcrypt.hash("filfilu", 10);

  const platformAdmin = await prisma.user.create({
    data: {
      email: "platform@filfilu.com",
      passwordHash,
      name: "Platform Super Admin",
      role: "admin",
      platformRole: "super_admin",
      title: "Platform Administrator",
      emailVerified: true,
      defaultFacilityId: FAC_A,
    },
  });

  const usersA = [
    { email: "admin@filfilu.com", name: "Selam Bekele", role: "admin", title: "Hospital Administrator", staffId: "s-admin" },
    { email: "doctor@filfilu.com", name: "Dr. Helen Tesfaye", role: "doctor", title: "Consultant Physician", staffId: "s-doc-1", dept: "General Medicine" },
    { email: "sara@filfilu.com", name: "Dr. Sara Mekonnen", role: "doctor", title: "Cardiologist", staffId: "s-doc-2", dept: "Cardiology" },
    { email: "nurse@filfilu.com", name: "Rahel Abebe", role: "nurse", title: "Senior Nurse", staffId: "s-nurse-1", ward: "Ward A", dept: "Maternity" },
    { email: "patient@filfilu.com", name: "Amina Mohammed", role: "patient", title: "Patient", patientId: "p-1" },
    { email: "yonas@filfilu.com", name: "Yonas Hailu", role: "patient", title: "Patient", patientId: "p-2" },
  ];
  for (const u of usersA) {
    const user = await prisma.user.create({
      data: {
        ...u,
        passwordHash,
        emailVerified: true,
        defaultFacilityId: FAC_A,
      },
    });
    await prisma.facilityMembership.create({
      data: {
        userId: user.id,
        facilityId: FAC_A,
        role: u.role,
        status: "active",
        staffId: u.staffId ?? null,
        title: u.title,
        ward: "ward" in u ? (u as { ward?: string }).ward ?? null : null,
        dept: "dept" in u ? (u as { dept?: string }).dept ?? null : null,
      },
    });
  }

  const boleAdmin = await prisma.user.create({
    data: {
      email: "bole-admin@filfilu.com",
      passwordHash,
      name: "Demo Bole Admin",
      role: "admin",
      title: "Facility Administrator",
      staffId: "s-b-admin",
      emailVerified: true,
      defaultFacilityId: FAC_B,
    },
  });
  await prisma.facilityMembership.create({
    data: {
      userId: boleAdmin.id,
      facilityId: FAC_B,
      role: "admin",
      status: "active",
      staffId: "s-b-admin",
      title: "Facility Administrator",
      dept: "Administration",
    },
  });

  // Cross-facility doctor: Helen also has a membership at Bole (demo).
  const helen = await prisma.user.findUnique({ where: { email: "doctor@filfilu.com" } });
  if (helen) {
    await prisma.facilityMembership.create({
      data: {
        userId: helen.id,
        facilityId: FAC_B,
        role: "doctor",
        status: "active",
        staffId: "s-b-doc-1",
        title: "Visiting Physician",
        dept: "General Medicine",
      },
    });
  }

  await prisma.facilityMembership.create({
    data: {
      userId: platformAdmin.id,
      facilityId: FAC_A,
      role: "admin",
      status: "active",
      title: "Platform Administrator",
    },
  });

  await prisma.appointment.createMany({
    data: [
      { facilityId: FAC_A, patientId: "p-1", doctorId: "s-doc-1", date: "2026-10-24", time: "09:30", dept: "General Medicine", status: "confirmed", reason: "BP check" },
      { facilityId: FAC_A, patientId: "p-1", doctorId: "s-doc-2", date: "2026-10-28", time: "11:00", dept: "Cardiology", status: "requested", reason: "Chest discomfort" },
      { facilityId: FAC_A, patientId: "p-2", doctorId: "s-doc-2", date: "2026-10-23", time: "15:30", dept: "Cardiology", status: "confirmed", reason: "Post-op review" },
      { facilityId: FAC_A, patientId: "p-3", doctorId: "s-doc-3", date: "2026-10-25", time: "10:00", dept: "Pediatrics", status: "confirmed", reason: "Fever follow-up" },
      { facilityId: FAC_A, patientId: "p-4", doctorId: "s-doc-1", date: "2026-10-26", time: "14:00", dept: "General Medicine", status: "draft", reason: "HbA1c review" },
      { facilityId: FAC_A, patientId: "p-2", doctorId: "s-doc-1", date: "2026-10-30", time: "08:45", dept: "General Medicine", status: "confirmed", reason: "Meds adjust" },
      { facilityId: FAC_A, patientId: "p-5", doctorId: "s-doc-2", date: "2026-10-24", time: "13:15", dept: "Cardiology", status: "confirmed", reason: "ECG" },
      { facilityId: FAC_B, patientId: "p-b-1", doctorId: "s-b-doc-1", date: "2026-11-05", time: "10:00", dept: "General Medicine", status: "confirmed", reason: "Demo consult" },
    ],
  });

  await prisma.shift.createMany({
    data: [
      { facilityId: FAC_A, staffId: "s-doc-1", date: "2026-10-23", slot: "08:00–16:00", dept: "General Medicine", status: "published", unit: "OPD 2" },
      { facilityId: FAC_A, staffId: "s-doc-1", date: "2026-10-24", slot: "08:00–16:00", dept: "General Medicine", status: "published", unit: "OPD 2" },
      { facilityId: FAC_A, staffId: "s-doc-2", date: "2026-10-23", slot: "12:00–20:00", dept: "Cardiology", status: "published", unit: "Cardio Bay" },
      { facilityId: FAC_A, staffId: "s-nurse-1", date: "2026-10-23", slot: "07:00–19:00", dept: "Maternity", status: "published", unit: "Ward A" },
      { facilityId: FAC_A, staffId: "s-nurse-1", date: "2026-10-24", slot: "19:00–07:00", dept: "Maternity", status: "draft", unit: "Ward A" },
      { facilityId: FAC_A, staffId: "s-nurse-2", date: "2026-10-23", slot: "07:00–19:00", dept: "General Medicine", status: "published", unit: "Ward B" },
      { facilityId: FAC_A, staffId: "s-doc-3", date: "2026-10-25", slot: "08:00–14:00", dept: "Pediatrics", status: "published", unit: "Peds Clinic" },
      { facilityId: FAC_B, staffId: "s-b-doc-1", date: "2026-11-05", slot: "08:00–16:00", dept: "General Medicine", status: "published", unit: "OPD 1" },
    ],
  });

  await prisma.exchange.createMany({
    data: [
      { facilityId: FAC_A, fromStaffId: "s-doc-1", toStaffId: "s-doc-2", date: "2026-10-27", status: "pending_admin", reason: "CME conference" },
      { facilityId: FAC_A, fromStaffId: "s-nurse-1", toStaffId: "s-nurse-2", date: "2026-10-26", status: "peer_accepted", reason: "Family emergency" },
    ],
  });

  const publics = [
    { doctorId: "s-doc-1", specialty: "General Medicine", onDuty: true, nextSlot: "Today, 3:30 PM", rating: 4.9 },
    { doctorId: "s-doc-2", specialty: "Cardiology", onDuty: true, nextSlot: "Tomorrow, 11:00 AM", rating: 4.8 },
    { doctorId: "s-doc-3", specialty: "Pediatrics", onDuty: false, nextSlot: "Fri, 10:00 AM", rating: 4.7 },
    { doctorId: "s-doc-4", specialty: "Maternity", onDuty: true, nextSlot: "Today, 2:00 PM", rating: 4.8 },
    { doctorId: "s-doc-5", specialty: "Orthopedics", onDuty: true, nextSlot: "Thu, 9:00 AM", rating: 4.6 },
    { doctorId: "s-doc-6", specialty: "Neurology", onDuty: false, nextSlot: "Wed, 1:30 PM", rating: 4.7 },
    { doctorId: "s-doc-7", specialty: "Dermatology", onDuty: true, nextSlot: "Today, 4:15 PM", rating: 4.5 },
    { doctorId: "s-doc-8", specialty: "Ophthalmology", onDuty: false, nextSlot: "Sat, 10:30 AM", rating: 4.6 },
  ];
  for (const d of publics) {
    await prisma.doctorPublic.create({ data: { ...d, facilityId: FAC_A } });
  }
  await prisma.doctorPublic.create({
    data: {
      facilityId: FAC_B,
      doctorId: "s-b-doc-1",
      specialty: "General Medicine",
      onDuty: true,
      nextSlot: "Tomorrow, 10:00 AM",
      rating: 4.5,
    },
  });

  const schedules: Array<{
    doctorId: string; specialty: string; day: string; date: string; slots: string[]; room: string; status: "open" | "limited" | "full";
  }> = [
    { doctorId: "s-doc-1", specialty: "General Medicine", day: "Monday", date: "2026-10-27", slots: ["09:00", "09:30", "10:00", "11:30", "14:00", "15:30"], room: "OPD 2", status: "open" },
    { doctorId: "s-doc-1", specialty: "General Medicine", day: "Tuesday", date: "2026-10-28", slots: ["08:30", "09:00", "10:30", "13:00", "16:00"], room: "OPD 2", status: "open" },
    { doctorId: "s-doc-2", specialty: "Cardiology", day: "Monday", date: "2026-10-27", slots: ["11:00", "11:30", "12:00", "15:00", "15:30"], room: "Cardio Bay", status: "open" },
    { doctorId: "s-doc-3", specialty: "Pediatrics", day: "Tuesday", date: "2026-10-28", slots: ["08:00", "08:30", "09:00", "09:30", "10:00"], room: "Peds Clinic", status: "open" },
  ];
  for (const s of schedules) {
    await prisma.doctorSchedule.create({
      data: {
        facilityId: FAC_A,
        doctorId: s.doctorId,
        specialty: s.specialty,
        day: s.day,
        date: s.date,
        room: s.room,
        status: s.status,
        slotsJson: JSON.stringify(s.slots),
      },
    });
  }

  for (const n of [
    { role: "admin", text: "2 shift swaps await your approval", level: "warn" },
    { role: "doctor", text: "New visit request from Amina Mohammed", level: "warn" },
    { role: "nurse", text: "Ward A bed A-12 vitals due", level: "warn" },
    { role: "patient", text: "Reminder: General Medicine visit tomorrow 09:30", level: "ok" },
  ]) {
    await prisma.notification.create({ data: { ...n, facilityId: FAC_A } });
  }
  await prisma.notification.create({
    data: { facilityId: FAC_B, role: "admin", text: "Bole demo facility seeded", level: "info" },
  });

  console.log(
    "Seed complete. Facilities: filfilu-default + bole-care-demo. Password: filfilu. Accounts: platform@, admin@, doctor@, bole-admin@, patient@filfilu.com",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
