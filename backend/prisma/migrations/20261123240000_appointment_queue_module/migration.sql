-- Section 5: Appointment & Queue (non-destructive)

CREATE TABLE IF NOT EXISTS "AppointmentNumberSequence" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT 'APT',
    "facilityCode" TEXT NOT NULL DEFAULT '001',
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "padWidth" INTEGER NOT NULL DEFAULT 6,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppointmentNumberSequence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AppointmentNumberSequence_facilityId_key" ON "AppointmentNumberSequence"("facilityId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppointmentNumberSequence_facilityId_fkey') THEN
    ALTER TABLE "AppointmentNumberSequence" ADD CONSTRAINT "AppointmentNumberSequence_facilityId_fkey"
      FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "appointmentNumber" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "endTime" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "bookingSource" TEXT NOT NULL DEFAULT 'reception';
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "cancelledById" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "checkedInAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "rescheduledFromId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_facilityId_appointmentNumber_key" ON "Appointment"("facilityId", "appointmentNumber");
CREATE INDEX IF NOT EXISTS "Appointment_facilityId_type_idx" ON "Appointment"("facilityId", "type");

-- Expand active-slot unique index statuses (drop + recreate)
DROP INDEX IF EXISTS "Appointment_doctor_slot_active_uidx";
CREATE UNIQUE INDEX "Appointment_doctor_slot_active_uidx"
  ON "Appointment" ("doctorId", "date", "time")
  WHERE "status" IN (
    'requested', 'scheduled', 'confirmed', 'checked_in', 'waiting', 'in_consultation'
  );

CREATE TABLE IF NOT EXISTS "AppointmentStatusEvent" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppointmentStatusEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AppointmentStatusEvent_appointmentId_createdAt_idx" ON "AppointmentStatusEvent"("appointmentId", "createdAt");
CREATE INDEX IF NOT EXISTS "AppointmentStatusEvent_facilityId_createdAt_idx" ON "AppointmentStatusEvent"("facilityId", "createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppointmentStatusEvent_facilityId_fkey') THEN
    ALTER TABLE "AppointmentStatusEvent" ADD CONSTRAINT "AppointmentStatusEvent_facilityId_fkey"
      FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppointmentStatusEvent_appointmentId_fkey') THEN
    ALTER TABLE "AppointmentStatusEvent" ADD CONSTRAINT "AppointmentStatusEvent_appointmentId_fkey"
      FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ProviderUnavailability" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderUnavailability_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProviderUnavailability_facilityId_staffId_idx" ON "ProviderUnavailability"("facilityId", "staffId");
CREATE INDEX IF NOT EXISTS "ProviderUnavailability_facilityId_startDate_endDate_idx" ON "ProviderUnavailability"("facilityId", "startDate", "endDate");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderUnavailability_facilityId_fkey') THEN
    ALTER TABLE "ProviderUnavailability" ADD CONSTRAINT "ProviderUnavailability_facilityId_fkey"
      FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "QueueEntry" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "queueNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "departmentKey" TEXT NOT NULL,
    "doctorId" TEXT,
    "serviceDate" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "arrivalTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "serviceStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "skipReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QueueEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "QueueEntry_facilityId_departmentKey_serviceDate_queueNumber_key"
  ON "QueueEntry"("facilityId", "departmentKey", "serviceDate", "queueNumber");
CREATE INDEX IF NOT EXISTS "QueueEntry_facilityId_serviceDate_status_idx" ON "QueueEntry"("facilityId", "serviceDate", "status");
CREATE INDEX IF NOT EXISTS "QueueEntry_facilityId_departmentKey_serviceDate_idx" ON "QueueEntry"("facilityId", "departmentKey", "serviceDate");
CREATE INDEX IF NOT EXISTS "QueueEntry_appointmentId_idx" ON "QueueEntry"("appointmentId");
CREATE INDEX IF NOT EXISTS "QueueEntry_patientId_idx" ON "QueueEntry"("patientId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QueueEntry_facilityId_fkey') THEN
    ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_facilityId_fkey"
      FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QueueEntry_appointmentId_fkey') THEN
    ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_appointmentId_fkey"
      FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "QueueNumberSequence" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "departmentKey" TEXT NOT NULL,
    "serviceDate" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QueueNumberSequence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "QueueNumberSequence_facilityId_departmentKey_serviceDate_key"
  ON "QueueNumberSequence"("facilityId", "departmentKey", "serviceDate");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QueueNumberSequence_facilityId_fkey') THEN
    ALTER TABLE "QueueNumberSequence" ADD CONSTRAINT "QueueNumberSequence_facilityId_fkey"
      FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "NotificationJob" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'in_app',
    "template" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "NotificationJob_facilityId_status_idx" ON "NotificationJob"("facilityId", "status");
CREATE INDEX IF NOT EXISTS "NotificationJob_createdAt_idx" ON "NotificationJob"("createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationJob_facilityId_fkey') THEN
    ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_facilityId_fkey"
      FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "AppointmentNumberSequence" ("id", "facilityId", "prefix", "facilityCode", "nextValue", "padWidth", "updatedAt")
SELECT 'ans_' || f."id", f."id", 'APT',
  CASE WHEN f."id" = 'fac_filfilu_default' THEN '001' ELSE '002' END,
  1, 6, CURRENT_TIMESTAMP
FROM "Facility" f
ON CONFLICT ("facilityId") DO NOTHING;
