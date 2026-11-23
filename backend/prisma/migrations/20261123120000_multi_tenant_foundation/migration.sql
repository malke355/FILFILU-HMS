-- Section 2: Multi-tenant foundation (non-destructive backfill).
-- Adds Facility / membership / IAM catalog and facilityId on tenant-owned tables.

-- ── New facility tables ─────────────────────────────────────────────────────

CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Addis_Ababa',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Facility_slug_key" ON "Facility"("slug");

CREATE TABLE "FacilitySettings" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "featuresJson" TEXT NOT NULL DEFAULT '{}',
    "brandingJson" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FacilitySettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FacilitySettings_facilityId_key" ON "FacilitySettings"("facilityId");

CREATE TABLE "FacilitySubscription" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL DEFAULT 'pilot',
    "status" TEXT NOT NULL DEFAULT 'active',
    "seatLimit" INTEGER NOT NULL DEFAULT 25,
    "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FacilitySubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FacilitySubscription_facilityId_key" ON "FacilitySubscription"("facilityId");

CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RolePermission_role_permissionId_key" ON "RolePermission"("role", "permissionId");
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");

CREATE TABLE "FacilityMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "staffId" TEXT,
    "title" TEXT,
    "ward" TEXT,
    "dept" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FacilityMembership_pkey" PRIMARY KEY ("id")
);

-- Default facility for existing rows
INSERT INTO "Facility" ("id", "slug", "name", "status", "timezone", "createdAt", "updatedAt")
VALUES ('fac_filfilu_default', 'filfilu-default', 'Filfilu Default Clinic', 'active', 'Africa/Addis_Ababa', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "FacilitySettings" ("id", "facilityId", "locale", "featuresJson", "brandingJson", "updatedAt")
VALUES ('fset_filfilu_default', 'fac_filfilu_default', 'en', '{}', '{}', CURRENT_TIMESTAMP);

INSERT INTO "FacilitySubscription" ("id", "facilityId", "planCode", "status", "seatLimit", "periodStart", "createdAt", "updatedAt")
VALUES ('fsub_filfilu_default', 'fac_filfilu_default', 'pilot', 'active', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ── Add nullable facilityId columns ─────────────────────────────────────────

ALTER TABLE "Department" ADD COLUMN "facilityId" TEXT;
ALTER TABLE "Staff" ADD COLUMN "facilityId" TEXT;
ALTER TABLE "Patient" ADD COLUMN "facilityId" TEXT;
ALTER TABLE "Patient" ADD COLUMN "patientNumber" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "facilityId" TEXT;
ALTER TABLE "Shift" ADD COLUMN "facilityId" TEXT;
ALTER TABLE "Exchange" ADD COLUMN "facilityId" TEXT;
ALTER TABLE "DoctorPublic" ADD COLUMN "facilityId" TEXT;
ALTER TABLE "DoctorSchedule" ADD COLUMN "facilityId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "facilityId" TEXT;
ALTER TABLE "ContactMessage" ADD COLUMN "facilityId" TEXT;
ALTER TABLE "BookingRequest" ADD COLUMN "facilityId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "facilityId" TEXT;
ALTER TABLE "User" ADD COLUMN "platformRole" TEXT;
ALTER TABLE "User" ADD COLUMN "defaultFacilityId" TEXT;

-- Backfill
UPDATE "Department" SET "facilityId" = 'fac_filfilu_default' WHERE "facilityId" IS NULL;
UPDATE "Staff" SET "facilityId" = 'fac_filfilu_default' WHERE "facilityId" IS NULL;
UPDATE "Patient" SET "facilityId" = 'fac_filfilu_default' WHERE "facilityId" IS NULL;
UPDATE "Appointment" SET "facilityId" = 'fac_filfilu_default' WHERE "facilityId" IS NULL;
UPDATE "Shift" SET "facilityId" = 'fac_filfilu_default' WHERE "facilityId" IS NULL;
UPDATE "Exchange" SET "facilityId" = 'fac_filfilu_default' WHERE "facilityId" IS NULL;
UPDATE "DoctorPublic" SET "facilityId" = 'fac_filfilu_default' WHERE "facilityId" IS NULL;
UPDATE "DoctorSchedule" SET "facilityId" = 'fac_filfilu_default' WHERE "facilityId" IS NULL;
UPDATE "Notification" SET "facilityId" = 'fac_filfilu_default' WHERE "facilityId" IS NULL;
UPDATE "ContactMessage" SET "facilityId" = 'fac_filfilu_default' WHERE "facilityId" IS NULL;
UPDATE "BookingRequest" SET "facilityId" = 'fac_filfilu_default' WHERE "facilityId" IS NULL;
UPDATE "AuditLog" SET "facilityId" = 'fac_filfilu_default' WHERE "facilityId" IS NULL;
UPDATE "User" SET "defaultFacilityId" = 'fac_filfilu_default' WHERE "defaultFacilityId" IS NULL;

-- Memberships for existing users
INSERT INTO "FacilityMembership" ("id", "userId", "facilityId", "role", "status", "staffId", "title", "ward", "dept", "createdAt", "updatedAt")
SELECT
  'fm_' || u."id",
  u."id",
  'fac_filfilu_default',
  u."role",
  'active',
  u."staffId",
  u."title",
  u."ward",
  u."dept",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u;

-- Drop global unique on Department.name, enforce per-facility
DROP INDEX IF EXISTS "Department_name_key";
ALTER TABLE "Department" ALTER COLUMN "facilityId" SET NOT NULL;
ALTER TABLE "Staff" ALTER COLUMN "facilityId" SET NOT NULL;
ALTER TABLE "Patient" ALTER COLUMN "facilityId" SET NOT NULL;
ALTER TABLE "Appointment" ALTER COLUMN "facilityId" SET NOT NULL;
ALTER TABLE "Shift" ALTER COLUMN "facilityId" SET NOT NULL;
ALTER TABLE "Exchange" ALTER COLUMN "facilityId" SET NOT NULL;
ALTER TABLE "DoctorPublic" ALTER COLUMN "facilityId" SET NOT NULL;
ALTER TABLE "DoctorSchedule" ALTER COLUMN "facilityId" SET NOT NULL;

-- Patient extension tables
CREATE TABLE "PatientIdentifier" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatientIdentifier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PatientIdentifier_facilityId_system_value_key" ON "PatientIdentifier"("facilityId", "system", "value");
CREATE INDEX "PatientIdentifier_patientId_idx" ON "PatientIdentifier"("patientId");
CREATE INDEX "PatientIdentifier_facilityId_idx" ON "PatientIdentifier"("facilityId");

CREATE TABLE "PatientEmergencyContact" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PatientEmergencyContact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PatientEmergencyContact_patientId_idx" ON "PatientEmergencyContact"("patientId");

CREATE TABLE "PatientAllergy" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "substance" TEXT NOT NULL,
    "reaction" TEXT,
    "severity" TEXT,
    "notedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "PatientAllergy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PatientAllergy_patientId_idx" ON "PatientAllergy"("patientId");

-- Foreign keys
ALTER TABLE "FacilitySettings" ADD CONSTRAINT "FacilitySettings_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacilitySubscription" ADD CONSTRAINT "FacilitySubscription_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacilityMembership" ADD CONSTRAINT "FacilityMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacilityMembership" ADD CONSTRAINT "FacilityMembership_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacilityMembership" ADD CONSTRAINT "FacilityMembership_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "FacilityMembership_userId_facilityId_key" ON "FacilityMembership"("userId", "facilityId");
CREATE INDEX "FacilityMembership_facilityId_role_idx" ON "FacilityMembership"("facilityId", "role");
CREATE INDEX "FacilityMembership_staffId_idx" ON "FacilityMembership"("staffId");

ALTER TABLE "Department" ADD CONSTRAINT "Department_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Department_facilityId_name_key" ON "Department"("facilityId", "name");
CREATE INDEX "Department_facilityId_idx" ON "Department"("facilityId");

ALTER TABLE "Staff" ADD CONSTRAINT "Staff_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Staff_facilityId_idx" ON "Staff"("facilityId");
CREATE INDEX "Staff_facilityId_role_idx" ON "Staff"("facilityId", "role");
CREATE INDEX "Staff_facilityId_status_idx" ON "Staff"("facilityId", "status");

ALTER TABLE "Patient" ADD CONSTRAINT "Patient_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Patient_facilityId_patientNumber_key" ON "Patient"("facilityId", "patientNumber");
CREATE INDEX "Patient_facilityId_idx" ON "Patient"("facilityId");
CREATE INDEX "Patient_facilityId_name_idx" ON "Patient"("facilityId", "name");
CREATE INDEX "Patient_facilityId_phone_idx" ON "Patient"("facilityId", "phone");

ALTER TABLE "PatientIdentifier" ADD CONSTRAINT "PatientIdentifier_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientEmergencyContact" ADD CONSTRAINT "PatientEmergencyContact_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientAllergy" ADD CONSTRAINT "PatientAllergy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Appointment_facilityId_idx" ON "Appointment"("facilityId");
CREATE INDEX "Appointment_facilityId_date_status_idx" ON "Appointment"("facilityId", "date", "status");
CREATE INDEX "Appointment_facilityId_doctorId_date_idx" ON "Appointment"("facilityId", "doctorId", "date");

ALTER TABLE "Shift" ADD CONSTRAINT "Shift_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Shift_facilityId_idx" ON "Shift"("facilityId");
CREATE INDEX "Shift_facilityId_date_status_idx" ON "Shift"("facilityId", "date", "status");

ALTER TABLE "Exchange" ADD CONSTRAINT "Exchange_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Exchange_facilityId_idx" ON "Exchange"("facilityId");

ALTER TABLE "DoctorPublic" ADD CONSTRAINT "DoctorPublic_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "DoctorPublic_facilityId_idx" ON "DoctorPublic"("facilityId");
CREATE INDEX "DoctorPublic_facilityId_specialty_idx" ON "DoctorPublic"("facilityId", "specialty");

ALTER TABLE "DoctorSchedule" ADD CONSTRAINT "DoctorSchedule_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "DoctorSchedule_facilityId_idx" ON "DoctorSchedule"("facilityId");
CREATE INDEX "DoctorSchedule_facilityId_date_idx" ON "DoctorSchedule"("facilityId", "date");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Notification_facilityId_idx" ON "Notification"("facilityId");

ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ContactMessage_facilityId_idx" ON "ContactMessage"("facilityId");

ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "BookingRequest_facilityId_idx" ON "BookingRequest"("facilityId");

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AuditLog_facilityId_createdAt_idx" ON "AuditLog"("facilityId", "createdAt");
