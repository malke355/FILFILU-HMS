-- Legacy dual-schema tables (lowercase users/patients/...) are unused.
-- The Express app uses Prisma models only ("User", "Patient", ...).
-- Drop as a DB owner/superuser if those tables still exist:
--   DROP TABLE IF EXISTS bills, medical_records, appointments, doctors, patients, users CASCADE;
-- This migration is intentionally a no-op so `prisma migrate deploy` works with the app role.
SELECT 1;
