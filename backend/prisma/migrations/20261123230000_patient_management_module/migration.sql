-- Section 4: Patient management (non-destructive)

-- PatientNumberSequence
CREATE TABLE IF NOT EXISTS "PatientNumberSequence" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT 'FIL',
    "facilityCode" TEXT NOT NULL DEFAULT '001',
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "padWidth" INTEGER NOT NULL DEFAULT 6,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientNumberSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PatientNumberSequence_facilityId_key" ON "PatientNumberSequence"("facilityId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientNumberSequence_facilityId_fkey') THEN
    ALTER TABLE "PatientNumberSequence"
      ADD CONSTRAINT "PatientNumberSequence_facilityId_fkey"
      FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Extend Patient
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "middleName" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "nationality" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "occupation" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "photoPath" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "phoneAlt" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "zone" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "woreda" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "kebele" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "addressDetail" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "registeredById" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "registrationNotes" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- age becomes nullable (keep existing values)
ALTER TABLE "Patient" ALTER COLUMN "age" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "Patient_facilityId_firstName_lastName_idx" ON "Patient"("facilityId", "firstName", "lastName");
CREATE INDEX IF NOT EXISTS "Patient_facilityId_email_idx" ON "Patient"("facilityId", "email");
CREATE INDEX IF NOT EXISTS "Patient_facilityId_status_idx" ON "Patient"("facilityId", "status");
CREATE INDEX IF NOT EXISTS "Patient_facilityId_createdAt_idx" ON "Patient"("facilityId", "createdAt");

-- Backfill name parts from name where missing
UPDATE "Patient"
SET
  "firstName" = COALESCE("firstName", split_part("name", ' ', 1)),
  "lastName" = COALESCE(
    "lastName",
    NULLIF(trim(both from substring("name" from length(split_part("name", ' ', 1)) + 1)), ''),
    "name"
  )
WHERE "firstName" IS NULL OR "lastName" IS NULL;

-- Emergency contact address
ALTER TABLE "PatientEmergencyContact" ADD COLUMN IF NOT EXISTS "address" TEXT;

-- Allergy audit fields
ALTER TABLE "PatientAllergy" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "PatientAllergy" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "PatientIdentifier_facilityId_value_idx" ON "PatientIdentifier"("facilityId", "value");

-- MedicalHistoryEntry
CREATE TABLE IF NOT EXISTS "MedicalHistoryEntry" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedOn" TIMESTAMP(3),
    "endedOn" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalHistoryEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MedicalHistoryEntry_facilityId_patientId_idx" ON "MedicalHistoryEntry"("facilityId", "patientId");
CREATE INDEX IF NOT EXISTS "MedicalHistoryEntry_patientId_category_idx" ON "MedicalHistoryEntry"("patientId", "category");
CREATE INDEX IF NOT EXISTS "MedicalHistoryEntry_patientId_status_idx" ON "MedicalHistoryEntry"("patientId", "status");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MedicalHistoryEntry_facilityId_fkey') THEN
    ALTER TABLE "MedicalHistoryEntry"
      ADD CONSTRAINT "MedicalHistoryEntry_facilityId_fkey"
      FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MedicalHistoryEntry_patientId_fkey') THEN
    ALTER TABLE "MedicalHistoryEntry"
      ADD CONSTRAINT "MedicalHistoryEntry_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Encounter
CREATE TABLE IF NOT EXISTS "Encounter" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "departmentId" TEXT,
    "doctorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Encounter_facilityId_encounterNumber_key" ON "Encounter"("facilityId", "encounterNumber");
CREATE INDEX IF NOT EXISTS "Encounter_facilityId_patientId_idx" ON "Encounter"("facilityId", "patientId");
CREATE INDEX IF NOT EXISTS "Encounter_facilityId_visitedAt_idx" ON "Encounter"("facilityId", "visitedAt");
CREATE INDEX IF NOT EXISTS "Encounter_facilityId_status_idx" ON "Encounter"("facilityId", "status");
CREATE INDEX IF NOT EXISTS "Encounter_doctorId_idx" ON "Encounter"("doctorId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Encounter_facilityId_fkey') THEN
    ALTER TABLE "Encounter"
      ADD CONSTRAINT "Encounter_facilityId_fkey"
      FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Encounter_patientId_fkey') THEN
    ALTER TABLE "Encounter"
      ADD CONSTRAINT "Encounter_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- PatientDocument
CREATE TABLE IF NOT EXISTS "PatientDocument" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PatientDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PatientDocument_facilityId_patientId_idx" ON "PatientDocument"("facilityId", "patientId");
CREATE INDEX IF NOT EXISTS "PatientDocument_patientId_deletedAt_idx" ON "PatientDocument"("patientId", "deletedAt");
CREATE INDEX IF NOT EXISTS "PatientDocument_encounterId_idx" ON "PatientDocument"("encounterId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientDocument_facilityId_fkey') THEN
    ALTER TABLE "PatientDocument"
      ADD CONSTRAINT "PatientDocument_facilityId_fkey"
      FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientDocument_patientId_fkey') THEN
    ALTER TABLE "PatientDocument"
      ADD CONSTRAINT "PatientDocument_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientDocument_encounterId_fkey') THEN
    ALTER TABLE "PatientDocument"
      ADD CONSTRAINT "PatientDocument_encounterId_fkey"
      FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed sequences for existing facilities (nextValue above max numeric suffix if any)
INSERT INTO "PatientNumberSequence" ("id", "facilityId", "prefix", "facilityCode", "nextValue", "padWidth", "updatedAt")
SELECT
  'pns_' || f."id",
  f."id",
  'FIL',
  CASE WHEN f."id" = 'fac_filfilu_default' THEN '001' ELSE '002' END,
  1,
  6,
  CURRENT_TIMESTAMP
FROM "Facility" f
ON CONFLICT ("facilityId") DO NOTHING;
