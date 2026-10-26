-- Hot FK / filter indexes for list and booking conflict lookups
CREATE INDEX IF NOT EXISTS "Patient_doctorId_idx" ON "Patient"("doctorId");
CREATE INDEX IF NOT EXISTS "Patient_ward_idx" ON "Patient"("ward");

CREATE INDEX IF NOT EXISTS "Appointment_patientId_idx" ON "Appointment"("patientId");
CREATE INDEX IF NOT EXISTS "Appointment_doctorId_idx" ON "Appointment"("doctorId");
CREATE INDEX IF NOT EXISTS "Appointment_doctorId_date_time_idx" ON "Appointment"("doctorId", "date", "time");
CREATE INDEX IF NOT EXISTS "Appointment_status_idx" ON "Appointment"("status");

CREATE INDEX IF NOT EXISTS "Shift_staffId_idx" ON "Shift"("staffId");
CREATE INDEX IF NOT EXISTS "Shift_date_idx" ON "Shift"("date");
CREATE INDEX IF NOT EXISTS "Shift_status_idx" ON "Shift"("status");

CREATE INDEX IF NOT EXISTS "Exchange_fromStaffId_idx" ON "Exchange"("fromStaffId");
CREATE INDEX IF NOT EXISTS "Exchange_toStaffId_idx" ON "Exchange"("toStaffId");
CREATE INDEX IF NOT EXISTS "Exchange_status_idx" ON "Exchange"("status");

CREATE INDEX IF NOT EXISTS "DoctorSchedule_doctorId_idx" ON "DoctorSchedule"("doctorId");
CREATE INDEX IF NOT EXISTS "DoctorSchedule_doctorId_date_idx" ON "DoctorSchedule"("doctorId", "date");
CREATE INDEX IF NOT EXISTS "DoctorSchedule_specialty_idx" ON "DoctorSchedule"("specialty");

CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_role_idx" ON "Notification"("role");

CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");
