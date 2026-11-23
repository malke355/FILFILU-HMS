# Filfilu HMS — Module Implementation Roadmap

**Status:** Planning only (Section 1)  
**Rule:** Do not implement modules from this roadmap until Section approval.

---

## 1. Proposed modules

| # | Module | Outcome |
|---|--------|---------|
| M0 | Platform foundation | Nest modules skeleton, OpenAPI, health, config, logging |
| M1 | Tenant & facility | Facility entity, memberships, tenant context |
| M2 | Identity & access | Users, sessions, RBAC hardening, invites, MFA |
| M3 | Patient registration | Demographics, identifiers, search, duplicate prevention |
| M4 | Appointments & queue | Booking, check-in, queue boards |
| M5 | Staff & roster | Departments, wards, shifts (evolve existing) |
| M6 | Clinical EMR | Encounters, notes, allergies, problem list, history |
| M7 | Laboratory | Orders, specimens, results |
| M8 | Pharmacy & inventory | Prescriptions, dispense, stock, expiry |
| M9 | Billing | Charge master, invoices, payments, receipts |
| M10 | Inpatient | Beds, ADT, transfers |
| M11 | Patient portal | Self-service appointments, summaries, notifications |
| M12 | Reports & analytics | Operational + financial dashboards |
| M13 | Notifications & jobs | Email/SMS/push via BullMQ |
| M14 | Integrations | FHIR adapters, partner APIs |
| M15 | AI assist | Admin/ops copilots (non-diagnostic first) |
| M16 | Commercialization | Plans, metering, super-admin console |

---

## 2. Dependencies

```
M0 Platform
 └─► M1 Tenant
      └─► M2 Identity
           ├─► M3 Patient ─┬─► M4 Appointments/Queue
           │               ├─► M6 Clinical EMR ─┬─► M7 Lab
           │               │                   └─► M8 Pharmacy
           │               └─► M11 Portal
           ├─► M5 Staff/Roster (can parallel early with M3)
           ├─► M9 Billing (needs M3 + optionally M4/M6/M7/M8 charge events)
           ├─► M10 Inpatient (needs M3 + M6)
           ├─► M12 Reports (after data domains exist)
           ├─► M13 Notifications (parallel after M2)
           ├─► M14 Integrations (after M6/M7 stable)
           ├─► M15 AI (after clean operational data + audit)
           └─► M16 Commercial (after M1 + billing basics)
```

---

## 3. Recommended implementation order

### Phase A — Stabilize & foundation (MVP clinics)

1. Fix residual product bugs / auth UX on `:8080` (preserve).
2. **Hardening:** `bootWorkspace` always calls `GET /auth/me` before painting role chrome; ignore forged `sessionStorage` roles.
3. Wire or remove non-functional “Remember me”; align client `can()` with server permissions where practical.
4. **M0** Nest module boundaries without changing URLs.
5. Extract Identity/Staff/Appointments services behind existing routes.
6. Frontend: introduce TS app shell; keep landing auth pages.
7. Deepen audit logging for patient list/chart access.
8. Correct README/docs drift (no `demo-accounts` route; clarify Nest host vs Express routers; no Postgres RLS).

### Phase B — Multi-tenant SaaS spine

6. **M1** facility model + backfill single default facility for existing rows.
7. Tenant-scoped Prisma access + negative tests.
8. **M2** invites, facility admin, super admin.

### Phase C — Clinical & ops MVP

9. **M3** richer registration.
10. **M4** queue + reception workflows.
11. **M6** minimal EMR encounter note (doctor/nurse).
12. **M9** simple cash billing for visits.
13. **M11** patient portal parity with current patient views.

### Phase D — Ancillary clinical

14. **M7** Lab MVP.
15. **M8** Pharmacy MVP.
16. **M10** Inpatient MVP.
17. **M12** Reports pack.
18. **M13** async notifications.

### Phase E — Scale & market

19. **M14** FHIR export of core resources.
20. **M16** subscriptions / facility provisioning.
21. **M15** AI for scheduling/admin drafts (human-in-the-loop).

---

## 4. MVP scope (first commercial pilot)

**In scope**

- Single-tenant mode *or* multi-tenant with one facility flag (prefer introducing `facilityId` early).
- Admin, doctor, nurse, receptionist (new), patient.
- Registration, appointments, basic consult note, staff roster, simple invoice/payment, notifications email.
- Amharic/English UI for core flows.

**Out of scope for first pilot**

- Full lab automation, advanced inventory, insurance adjudication, AI diagnosis, national exchange go-live, multi-hospital chains with custom isolation.

---

## 5. Advanced features (post-MVP)

- Full LIS/PACS-lite, e-prescribing decision support, DRG/insurance packs.
- Bed management + theatre scheduling.
- Advanced analytics / data warehouse export.
- Mobile apps consuming same API.
- National Digital Health Exchange when authorized.
- AI scribing / coding assist with strict audit and clinician confirmation.

---

## 6. Commercialization requirements

| Need | Notes |
|------|-------|
| Facility provisioning | Create tenant + admin invite |
| Plans & limits | Users, storage, modules |
| Billing Filfilu itself | Separate from patient billing |
| SLA / support roles | Super admin tooling |
| Contracts & DPA | Legal — processor list (Neon, Render, SMTP) |
| Demo vs prod | Hard block destructive seed in prod |

---

## 7. Testing requirements

| Layer | Requirement |
|-------|-------------|
| Unit | Domain services, RBAC, tenant guard |
| Integration | API routes with test DB |
| Security | Cross-tenant denial suite (blocking) |
| E2E | Login → book → consult → bill happy paths |
| Performance | Hydrate/dashboard budgets |
| Restore | Backup restore drill quarterly |

---

## 8. Deployment milestones

| Milestone | Exit criteria |
|-----------|---------------|
| M-A | Nest modules host existing Express routes; CI green; no API breaks |
| M-B | `facilityId` live; one default facility; cross-tenant tests pass |
| M-C | Pilot clinic using registration + appointments + note + cash bill |
| M-D | Lab or pharmacy module in pilot |
| M-E | Second facility onboarded on same deployment without data leak |
| M-F | FHIR Patient/Encounter export available to authorized partner |

---

## 9. Mapping to existing code (start points)

| Roadmap module | Existing seed |
|----------------|---------------|
| Identity | `routes/auth.ts`, `lib/auth.ts`, session cookies |
| Staff | `Staff`, `POST /staff/accounts` |
| Patient | `Patient` model (extend) |
| Appointments | `Appointment`, schedules, landing booking |
| Roster | `Shift`, `Exchange` |
| Notifications | `Notification`, Nodemailer |
| Audit | `AuditLog`, `writeAudit` |
| Portal | patient views in `app.html` |
| Tenant / Lab / Pharmacy / Billing / EMR | **new** |

---

*End of MODULE_IMPLEMENTATION_ROADMAP.md — Section 1*
