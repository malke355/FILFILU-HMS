# Filfilu HMS — Multi-Tenancy Design

## Model

**Shared database + shared schema** with mandatory `facilityId` on tenant-owned tables.

```
User (global email)
  └── FacilityMembership (facilityId, role, staffId?)
        └── Facility
              └── Patients, Appointments, Staff, …
```

ADR-006 accepted: permissions are evaluated for the **active facility membership**, not a global role alone. `User.role` / `staffId` / `patientId` remain compatibility mirrors synced on login.

## Active facility context

1. JWT includes `facilityId` + facility-scoped `role`.
2. Optional header `X-Facility-Id` switches context **only** if the user has an active membership (or `platformRole = super_admin`).
3. Unauthorized header → session rejected (401).
4. Public contact/booking writes always use the default facility id — client-supplied facility ids are ignored.

Helpers: `backend/src/lib/tenant.ts` (`resolveFacilityContext`, `requireFacilityId`, `assertSameFacility*`).

## Isolation layers

| Layer | Status |
|-------|--------|
| Membership check | Implemented |
| Query `where: { facilityId }` | Implemented on resource/public APIs |
| Strip client facilityId | Implemented for public forms + appointment body |
| Cross-tenant staff/patient asserts | Implemented on appointment create/reassign |
| Composite DB FKs `(facilityId, patientId)` | Not added (Prisma/cuid global ids); app asserts instead |
| PostgreSQL RLS | **Deferred** — Neon pooler + Prisma make `SET LOCAL` session vars fragile; revisit with dedicated non-pooled role |

## Platform vs facility roles

- `User.platformRole = super_admin` — cross-facility ops (optional membership).
- Facility roles: `admin`, `doctor`, `nurse`, `patient` on `FacilityMembership.role`.

## Security rules

- Never trust tenant id from the browser without membership verification.
- Do not log PHI in audit meta (existing privacy helpers).
- Demo seed creates two facilities; production must never run destructive seed.
