# RBAC Permission Matrix (Section 3)

Permissions use dotted form (`patients.read`). Legacy colon codes (`patients:read_all`) remain accepted via aliases in `backend/src/lib/rbac.ts`.

`facility_owner` / `facility_admin` normalize to **admin** for authorization.

## Legend

| Symbol | Meaning |
|--------|---------|
| Y | Granted |
| — | Not granted |

## Matrix

| Permission | Admin | Doctor | Nurse | Receptionist | Lab tech | Pharmacist | Cashier | Inventory | Accountant | Patient |
|------------|:-----:|:------:|:-----:|:------------:|:--------:|:----------:|:-------:|:---------:|:----------:|:-------:|
| dashboard.admin | Y | — | — | Y | — | — | Y | Y | Y | — |
| dashboard.clinical | — | Y | Y | — | Y | Y | — | — | — | — |
| dashboard.patient | — | — | — | — | — | — | — | — | — | Y |
| staff.read / staff.manage | Y | — | — | — | — | — | — | — | — | — |
| users.manage / roles.manage | Y | — | — | — | — | — | — | — | — | — |
| facility.settings.manage | Y | — | — | — | — | — | — | — | — | — |
| patients.read / create / update | Y | — | — | Y | — | — | — | — | — | — |
| patients.read_assigned | — | Y | — | — | Y | — | — | — | — | — |
| patients.read_ward | — | — | Y | — | — | — | — | — | — | — |
| appointments.read / manage | Y | — | — | Y | — | — | Y* | — | — | — |
| appointments.read_own / write_own | — | Y | — | — | — | — | — | — | — | — |
| appointments.read_ward | — | — | Y | — | — | — | — | — | — | — |
| appointments.request | — | — | — | — | — | — | — | — | — | Y |
| clinical.read | — | Y | Y | — | — | — | — | — | — | — |
| clinical.write | — | Y | — | — | — | — | — | — | — | — |
| clinical.vitals_ward | — | — | Y | — | — | — | — | — | — | — |
| lab.orders.manage | Y | Y | — | — | Y | — | — | — | — | — |
| lab.results.validate | — | — | — | — | Y | — | — | — | — | — |
| pharmacy.dispense | Y | — | — | — | — | Y | — | — | — | — |
| inventory.manage | Y | — | — | — | — | Y | — | Y | — | — |
| billing.read / manage | Y | — | — | — | — | — | Y | — | read† | — |
| reports.read | Y | — | — | — | — | — | — | — | Y | — |
| schedule.* (admin publish) | Y | own | own | public | — | — | — | — | — | public |
| notifications.read | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| profile.read / write | — | — | — | — | — | — | — | — | — | Y |

\* Cashier: appointments.read for visit/billing context, not clinical charting.  
† Accountant: `billing.read` + `reports.read` only (no `billing.manage`).

## Platform roles

| Role | Scope |
|------|--------|
| `super_admin` | Cross-facility ops; may resolve any active facility without membership |
| `support` | Reserved platform identity (membership still required for facility data unless expanded later) |

Facility administrators **cannot** assign platform roles. Attempts via API body fields are rejected with 403.

## Healthcare data patterns

- Receptionist / cashier / pharmacist / inventory / accountant: patient `condition` redacted to `[restricted]` on list APIs; clinical endpoint denied.
- Doctors: assigned patients + clinical write.
- Nurses: ward patients + clinical read + vitals.
- Lab: assigned-scope patient identifiers + lab permissions.
- Dedicated audited access: `GET /api/patients/:id/clinical`.

## Custom facility roles

Architecture stores `FacilityMembership.role` as a string. Custom roles can be added later by extending `ROLE_PERMISSIONS` / seed mappings without schema redesign. Not shipped in Section 3 UI.
