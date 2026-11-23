# Filfilu HMS — Database Architecture

**Section 2.** Shared PostgreSQL + Prisma modular foundation for multi-tenant healthcare SaaS.

## Goals

- One database, one schema, many facilities (`facilityId` on tenant-owned rows).
- Preserve existing Filfilu operational data via non-destructive backfill.
- Prepare patient identity extensions without inventing unfinished Lab/Pharmacy/Billing engines.

## Modeling strategy

| Concern | Approach |
|---------|----------|
| Identity | Global `User` (unique email); facility access via `FacilityMembership` |
| Tenant root | `Facility` + `FacilitySettings` + `FacilitySubscription` (plan metadata only) |
| RBAC catalog | `Permission` + `RolePermission` (codes aligned with `lib/rbac.ts`) |
| Operational data | Existing models gain required `facilityId` after migration |
| Patient extensions | `PatientIdentifier`, `PatientEmergencyContact`, `PatientAllergy` |
| IDs | `cuid()` string primary keys (existing convention) |
| Deletes | Cascade facility → owned rows; memberships cascade with user/facility |

## Relationship highlights

- `Facility` 1—* `Staff`, `Patient`, `Appointment`, `Shift`, `Exchange`, schedules, notifications.
- `User` *—* `Facility` through `FacilityMembership` (unique `(userId, facilityId)`).
- Membership may point at facility-local `Staff` (`staffId`).
- `User.patientId` remains a portal convenience link; patient rows are facility-scoped.
- `Department` uniqueness is `(facilityId, name)` — same department name allowed in different clinics.

## Same-facility integrity

- Application layer: `assertSameFacilityPatient` / `assertSameFacilityStaff` on writes.
- Client `facilityId` on create payloads is ignored; server uses session facility.
- PostgreSQL RLS evaluated; **deferred** under Neon pooling — see `MULTI_TENANCY_DESIGN.md`.

## Planned later (not in Section 2 schema)

Encounter/Diagnosis/Vitals, Lab catalog/orders/results, Pharmacy batches/movements, Invoice/Payment — document only until product sections implement them.

## Performance

Composite indexes favor `(facilityId, …)` on patients, appointments, shifts, audit. See schema reference.
