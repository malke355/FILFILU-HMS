-- Remove older duplicates among active (requested|confirmed) doctor slots, keep earliest row.
DELETE FROM "Appointment" AS a
USING "Appointment" AS b
WHERE a."doctorId" = b."doctorId"
  AND a."date" = b."date"
  AND a."time" = b."time"
  AND a."status" IN ('requested', 'confirmed')
  AND b."status" IN ('requested', 'confirmed')
  AND a."createdAt" > b."createdAt";

-- Enforce one active booking per doctor/date/time (cancelled/draft/completed may reuse the slot).
CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_doctor_slot_active_uidx"
ON "Appointment" ("doctorId", "date", "time")
WHERE "status" IN ('requested', 'confirmed');
