# Patient Workflows (Section 4)

## Registration

1. Staff with `patients.create` opens **Register patient**.
2. Enters demographics (ID optional).
3. API runs soft duplicate check (identifier / phone / name+DOB).
4. On matches → `409` warning; staff reviews; may resubmit with `acknowledgeDuplicates: true`.
5. Server allocates MRN via `PatientNumberSequence` (atomic).
6. Creates patient (+ optional identifier & emergency contact).
7. Audit: `patients.register`.

## Search

Filter box / `GET /patients?q=` searches MRN, name parts, phone, email, identifier values — **facility-scoped**, paginated.

## Profile

Overview → medical history / encounters / documents tabs (permission-gated). Archive soft-sets `status=archived`.

## Encounter

Create outpatient/emergency/inpatient/follow-up stub linked to patient + facility. Clinical documentation deferred to Section 6.

## Documents

Upload to private `STORAGE_ROOT` (`backend/storage` by default). Download only via authenticated route. Soft-delete clears file and sets `deletedAt`.

## Future merge strategy (not implemented)

Safe merge must: keep both MRNs as aliases, re-point encounters/history/docs/appointments, write immutable audit, never delete source history. Manual admin tooling only — out of Section 4 scope.
