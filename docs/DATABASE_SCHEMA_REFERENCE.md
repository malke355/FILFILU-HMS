# Filfilu HMS — Database Schema Reference

Section 2 models (Prisma). IDs are `cuid` strings unless noted.

## Facility / IAM

| Model | Purpose | Key constraints / indexes |
|-------|---------|---------------------------|
| `Facility` | Tenant root | `slug` unique |
| `FacilitySettings` | Locale/features JSON | 1:1 `facilityId` |
| `FacilitySubscription` | Plan foundation | 1:1 `facilityId` |
| `FacilityMembership` | User↔facility role | unique `(userId, facilityId)`; indexes `(facilityId, role)` |
| `Permission` | Permission catalog | `code` unique |
| `RolePermission` | role code → permission | unique `(role, permissionId)` |
| `User` | Global identity | `email` unique; `platformRole`; `status` (`active`\|`inactive`); `defaultFacilityId` |
| `PasswordResetToken` | Reset tokens | `tokenHash` unique |
| `AuthSession` | Hashed refresh sessions | `refreshTokenHash` unique; indexes `userId`, `familyId`, `expiresAt` |

## Clinical / ops (facility-scoped)

| Model | Purpose | Key constraints / indexes |
|-------|---------|---------------------------|
| `Department` | Dept list | unique `(facilityId, name)` |
| `Staff` | Workforce | indexes `(facilityId)`, `(facilityId, role)`, `(facilityId, status)` |
| `Patient` | Demographics + MRN + location + status | unique `(facilityId, patientNumber)`; name/phone/email/status indexes |
| `PatientNumberSequence` | Atomic MRN counter | unique `facilityId` |
| `PatientIdentifier` | Optional ID types | unique `(facilityId, system, value)` |
| `PatientEmergencyContact` | Emergency contacts | index `patientId` |
| `PatientAllergy` | Allergies | index `patientId` |
| `MedicalHistoryEntry` | Structured history | indexes patient/category/status |
| `Encounter` | Visit foundation | unique `(facilityId, encounterNumber)` |
| `PatientDocument` | Private file metadata | soft-delete `deletedAt` |
| `Appointment` | Visits | indexes `(facilityId, date, status)`, doctor/date |
| `Shift` | Duty roster | `(facilityId, date, status)` |
| `Exchange` | Shift swaps | `facilityId` |
| `DoctorPublic` | Public directory | `(facilityId, specialty)` |
| `DoctorSchedule` | Slots JSON | `(facilityId, date)` |
| `Notification` | In-app alerts | `facilityId` nullable historically, seeded with facility |
| `ContactMessage` / `BookingRequest` | Public forms | optional `facilityId` (default facility on write) |
| `AuditLog` | Audit | `(facilityId, createdAt)` |

## Default facility

- Id: `fac_filfilu_default`
- Slug: `filfilu-default`

## Role codes (membership)

`admin` | `doctor` | `nurse` | `patient`  
Platform: `User.platformRole = super_admin`
