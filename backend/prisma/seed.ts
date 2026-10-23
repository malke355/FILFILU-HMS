import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.bookingRequest.deleteMany();
  await prisma.contactMessage.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.doctorSchedule.deleteMany();
  await prisma.doctorPublic.deleteMany();
  await prisma.exchange.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.user.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.department.deleteMany();

  const departments = [
    "General Medicine",
    "Cardiology",
    "Pediatrics",
    "Maternity",
    "Orthopedics",
    "Neurology",
    "Dermatology",
    "Ophthalmology",
    "Administration",
  ];
  for (const name of departments) {
    await prisma.department.create({ data: { name } });
  }

  const staff = [
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
  for (const s of staff) {
    await prisma.staff.create({ data: s });
  }

  const patients = [
    { id: "p-1", name: "Amina Mohammed", age: 29, sex: "F", blood: "O+", phone: "+251 911 200 001", condition: "Hypertension follow-up", doctorId: "s-doc-1" },
    { id: "p-2", name: "Yonas Hailu", age: 41, sex: "M", blood: "A+", phone: "+251 911 200 002", condition: "Cardiac monitoring", doctorId: "s-doc-2", ward: "Ward A", bed: "A-12" },
    { id: "p-3", name: "Hana Kebede", age: 8, sex: "F", blood: "B+", phone: "+251 911 200 003", condition: "Pediatric fever review", doctorId: "s-doc-3", ward: "Ward B", bed: "B-03" },
    { id: "p-4", name: "Mulugeta Assefa", age: 55, sex: "M", blood: "AB+", phone: "+251 911 200 004", condition: "Diabetes review", doctorId: "s-doc-1", ward: "Ward A", bed: "A-07" },
    { id: "p-5", name: "Kidist Alemu", age: 33, sex: "F", blood: "O-", phone: "+251 911 200 005", condition: "ECG screening", doctorId: "s-doc-2" },
  ];
  for (const p of patients) {
    await prisma.patient.create({ data: p });
  }

  const passwordHash = await bcrypt.hash("filfilu", 10);
  const users = [
    { email: "admin@filfilu.com", name: "Selam Bekele", role: "admin", title: "Hospital Administrator", staffId: "s-admin" },
    { email: "doctor@filfilu.com", name: "Dr. Helen Tesfaye", role: "doctor", title: "Consultant Physician", staffId: "s-doc-1", dept: "General Medicine" },
    { email: "sara@filfilu.com", name: "Dr. Sara Mekonnen", role: "doctor", title: "Cardiologist", staffId: "s-doc-2", dept: "Cardiology" },
    { email: "nurse@filfilu.com", name: "Rahel Abebe", role: "nurse", title: "Senior Nurse", staffId: "s-nurse-1", ward: "Ward A", dept: "Maternity" },
    { email: "patient@filfilu.com", name: "Amina Mohammed", role: "patient", title: "Patient", patientId: "p-1" },
    { email: "yonas@filfilu.com", name: "Yonas Hailu", role: "patient", title: "Patient", patientId: "p-2" },
  ];
  for (const u of users) {
    await prisma.user.create({ data: { ...u, passwordHash } });
  }

  await prisma.appointment.createMany({
    data: [
      { patientId: "p-1", doctorId: "s-doc-1", date: "2026-10-24", time: "09:30", dept: "General Medicine", status: "confirmed", reason: "BP check" },
      { patientId: "p-1", doctorId: "s-doc-2", date: "2026-10-28", time: "11:00", dept: "Cardiology", status: "requested", reason: "Chest discomfort" },
      { patientId: "p-2", doctorId: "s-doc-2", date: "2026-10-23", time: "15:30", dept: "Cardiology", status: "confirmed", reason: "Post-op review" },
      { patientId: "p-3", doctorId: "s-doc-3", date: "2026-10-25", time: "10:00", dept: "Pediatrics", status: "confirmed", reason: "Fever follow-up" },
      { patientId: "p-4", doctorId: "s-doc-1", date: "2026-10-26", time: "14:00", dept: "General Medicine", status: "draft", reason: "HbA1c review" },
      { patientId: "p-2", doctorId: "s-doc-1", date: "2026-10-30", time: "08:45", dept: "General Medicine", status: "confirmed", reason: "Meds adjust" },
      { patientId: "p-5", doctorId: "s-doc-2", date: "2026-10-24", time: "13:15", dept: "Cardiology", status: "confirmed", reason: "ECG" },
    ],
  });

  await prisma.shift.createMany({
    data: [
      { staffId: "s-doc-1", date: "2026-10-23", slot: "08:00–16:00", dept: "General Medicine", status: "published", unit: "OPD 2" },
      { staffId: "s-doc-1", date: "2026-10-24", slot: "08:00–16:00", dept: "General Medicine", status: "published", unit: "OPD 2" },
      { staffId: "s-doc-2", date: "2026-10-23", slot: "12:00–20:00", dept: "Cardiology", status: "published", unit: "Cardio Bay" },
      { staffId: "s-nurse-1", date: "2026-10-23", slot: "07:00–19:00", dept: "Maternity", status: "published", unit: "Ward A" },
      { staffId: "s-nurse-1", date: "2026-10-24", slot: "19:00–07:00", dept: "Maternity", status: "draft", unit: "Ward A" },
      { staffId: "s-nurse-2", date: "2026-10-23", slot: "07:00–19:00", dept: "General Medicine", status: "published", unit: "Ward B" },
      { staffId: "s-doc-3", date: "2026-10-25", slot: "08:00–14:00", dept: "Pediatrics", status: "published", unit: "Peds Clinic" },
    ],
  });

  await prisma.exchange.createMany({
    data: [
      { fromStaffId: "s-doc-1", toStaffId: "s-doc-2", date: "2026-10-27", status: "pending_admin", reason: "CME conference" },
      { fromStaffId: "s-nurse-1", toStaffId: "s-nurse-2", date: "2026-10-26", status: "peer_accepted", reason: "Family emergency" },
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
    await prisma.doctorPublic.create({ data: d });
  }

  const schedules: Array<{
    doctorId: string; specialty: string; day: string; date: string; slots: string[]; room: string; status: "open" | "limited" | "full";
  }> = [
    { doctorId: "s-doc-1", specialty: "General Medicine", day: "Monday", date: "2026-10-27", slots: ["09:00", "09:30", "10:00", "11:30", "14:00", "15:30"], room: "OPD 2", status: "open" },
    { doctorId: "s-doc-1", specialty: "General Medicine", day: "Tuesday", date: "2026-10-28", slots: ["08:30", "09:00", "10:30", "13:00", "16:00"], room: "OPD 2", status: "open" },
    { doctorId: "s-doc-1", specialty: "General Medicine", day: "Thursday", date: "2026-10-30", slots: ["09:00", "10:00", "11:00", "14:30"], room: "OPD 2", status: "limited" },
    { doctorId: "s-doc-2", specialty: "Cardiology", day: "Monday", date: "2026-10-27", slots: ["11:00", "11:30", "12:00", "15:00", "15:30"], room: "Cardio Bay", status: "open" },
    { doctorId: "s-doc-2", specialty: "Cardiology", day: "Wednesday", date: "2026-10-29", slots: ["09:30", "10:00", "13:15", "14:00"], room: "Cardio Bay", status: "open" },
    { doctorId: "s-doc-2", specialty: "Cardiology", day: "Friday", date: "2026-10-31", slots: ["10:00", "10:30", "11:00"], room: "Cardio Bay", status: "limited" },
    { doctorId: "s-doc-2", specialty: "Cardiology", day: "Saturday", date: "2026-11-01", slots: ["09:00", "09:30"], room: "Cardio Bay", status: "full" },
    { doctorId: "s-doc-3", specialty: "Pediatrics", day: "Tuesday", date: "2026-10-28", slots: ["08:00", "08:30", "09:00", "09:30", "10:00"], room: "Peds Clinic", status: "open" },
    { doctorId: "s-doc-3", specialty: "Pediatrics", day: "Friday", date: "2026-10-31", slots: ["09:00", "09:45", "10:30", "11:15"], room: "Peds Clinic", status: "open" },
    { doctorId: "s-doc-4", specialty: "Maternity", day: "Monday", date: "2026-10-27", slots: ["08:00", "09:00", "10:00", "14:00", "15:00"], room: "Maternity Wing", status: "open" },
    { doctorId: "s-doc-4", specialty: "Maternity", day: "Wednesday", date: "2026-10-29", slots: ["08:30", "09:30", "11:00", "13:30"], room: "Maternity Wing", status: "open" },
    { doctorId: "s-doc-4", specialty: "Maternity", day: "Saturday", date: "2026-11-01", slots: ["09:00", "10:00", "11:00"], room: "Maternity Wing", status: "limited" },
    { doctorId: "s-doc-5", specialty: "Orthopedics", day: "Tuesday", date: "2026-10-28", slots: ["09:00", "09:40", "10:20", "14:00"], room: "Ortho 1", status: "open" },
    { doctorId: "s-doc-5", specialty: "Orthopedics", day: "Thursday", date: "2026-10-30", slots: ["08:30", "09:10", "09:50", "15:00", "15:40"], room: "Ortho 1", status: "open" },
    { doctorId: "s-doc-6", specialty: "Neurology", day: "Wednesday", date: "2026-10-29", slots: ["13:00", "13:30", "14:00", "14:30"], room: "Neuro Suite", status: "open" },
    { doctorId: "s-doc-6", specialty: "Neurology", day: "Friday", date: "2026-10-31", slots: ["10:00", "11:00", "12:00"], room: "Neuro Suite", status: "limited" },
    { doctorId: "s-doc-7", specialty: "Dermatology", day: "Monday", date: "2026-10-27", slots: ["14:00", "14:20", "14:40", "15:00", "16:00"], room: "Derm Clinic", status: "open" },
    { doctorId: "s-doc-7", specialty: "Dermatology", day: "Thursday", date: "2026-10-30", slots: ["09:00", "09:30", "10:00", "10:30"], room: "Derm Clinic", status: "open" },
    { doctorId: "s-doc-8", specialty: "Ophthalmology", day: "Tuesday", date: "2026-10-28", slots: ["10:00", "10:30", "11:00"], room: "Eye Unit", status: "limited" },
    { doctorId: "s-doc-8", specialty: "Ophthalmology", day: "Saturday", date: "2026-11-01", slots: ["09:00", "09:30", "10:00", "10:30", "11:00"], room: "Eye Unit", status: "open" },
  ];
  for (const s of schedules) {
    await prisma.doctorSchedule.create({
      data: {
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

  const notifications = [
    { role: "admin", text: "2 shift swaps await your approval", level: "warn" },
    { role: "admin", text: "Duty schedule draft for Mon needs publish", level: "info" },
    { role: "doctor", text: "New visit request from Amina Mohammed", level: "warn" },
    { role: "doctor", text: "Lab result ready for Mulugeta Assefa", level: "ok" },
    { role: "nurse", text: "Ward A bed A-12 vitals due", level: "warn" },
    { role: "nurse", text: "Handoff note posted for night shift", level: "info" },
    { role: "patient", text: "Your Cardiology visit is requested", level: "info" },
    { role: "patient", text: "Reminder: General Medicine visit tomorrow 09:30", level: "ok" },
  ];
  for (const n of notifications) {
    await prisma.notification.create({ data: n });
  }

  console.log("Seed complete. Demo password for all users: filfilu");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
