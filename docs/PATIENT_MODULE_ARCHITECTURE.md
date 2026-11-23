# Patient Module Architecture (Section 4)

## Scope

Facility-scoped patient registration, search, profile, medical history foundation, encounter foundation, and private document storage. Integrates with Section 2 tenancy and Section 3 RBAC/audit.

## Layers

| Layer | Location |
|-------|----------|
| Prisma models | `backend/prisma/schema.prisma` |
| Services | `backend/src/services/patients/*` |
| HTTP routes | `backend/src/routes/patients.ts` |
| Frontend | `landing/app.html` + `landing/js/auth.js` |
| OpenAPI | `backend/openapi/patients.yaml` |

## Boundaries

- **Does:** demographics, MRN generation, duplicate warnings, allergies/history entries, encounter stubs, private docs.
- **Does not:** full clinical charting (Section 6), lab/pharmacy/billing modules, automatic diagnosis, destructive patient merge.

## Tenant isolation

Every query uses `requireFacilityId(req)` from the authenticated session. Patient IDs from other facilities return **404** (not 403) to avoid enumeration. Client-supplied `facilityId` is ignored on create.

## Compatibility

Existing `Patient.name` / `age` / list consumers continue to work. New fields are additive. Signup/Google registration now allocate MRNs.
