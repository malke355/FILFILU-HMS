# Filfilu HMS — Target Architecture

**Status:** Recommended direction (Section 1 — design only; not implemented)  
**Principle:** Evolve the existing codebase; do not greenfield rewrite.

---

## 1. Recommended system architecture

### Pattern: Modular monolith (single deployable)

```
                    ┌─────────────────────────────────────┐
                    │         Edge / TLS (Render/nginx)   │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │     Filfilu API + Web (one service) │
                    │  NestJS modular app (Express under) │
                    │  ┌─────────┐ ┌─────────┐ ┌───────┐  │
                    │  │ Auth    │ │ Clinical│ │ Ops   │  │
                    │  │ Tenant  │ │ EMR Lab │ │ Bill  │  │
                    │  └────┬────┘ └────┬────┘ └───┬───┘  │
                    │       └───────────┼──────────┘      │
                    │             Prisma + Postgres         │
                    │             Redis (cache/queues)      │
                    └─────────────────────────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │  Web clients (role experiences)     │
                    │  Next.js or progressive React shell │
                    │  same-origin /api during migration  │
                    └─────────────────────────────────────┘
```

**Avoid microservices** until a module’s scale/team/regulatory boundary clearly requires isolation.

### Deployment units (near-term)

| Unit | Purpose |
|------|---------|
| **Primary web service** | Nest+Prisma API + authenticated app UI |
| **PostgreSQL (Neon)** | System of record |
| **Redis** (add when needed) | Cache, rate-limit store, BullMQ |
| **Object storage** (later) | Documents/images with tenant prefixes |
| **Static brochure** (optional) | Marketing only on Pages/Vercel — not the product |

---

## 2. Frontend architecture

### Direction

- **Preserve** current landing visual language (Plus Jakarta Sans, blue/teal brand, auth layouts, i18n).
- **Evolve** workspace from monolithic `app.html` toward a **TypeScript React/Next.js** app that:
  - Uses centralized API client + auth session (cookie credentials).
  - Implements **role-based layouts** and route guards.
  - Shares a design system (buttons, tables, forms, empty states).
  - Remains responsive and accessible (WCAG-oriented healthcare UI).

### Experience model (one app, many personas)

Prefer **one frontend application** with role-routed areas over many separate apps:

| Persona | Experience |
|---------|------------|
| Super Administrator | Platform ops, tenants, billing plans |
| Facility Administrator | Facility config, staff, departments |
| Receptionist | Registration, appointments, queue |
| Doctor | Schedule, patients, consults, orders |
| Nurse | Ward board, vitals, tasks |
| Laboratory Technician | Orders, specimens, results |
| Pharmacist | Prescriptions, dispense, stock |
| Cashier | Invoices, payments, receipts |
| Patient | Portal: appointments, results summary, messaging |

### Migration stance for UI

1. Keep `landing/*` auth/marketing pages working during transition.
2. Introduce Next.js (or Vite React) under a clear folder (e.g. `web/`) **without deleting** landing.
3. Cut over `/app` when parity for current 4 roles is proven.
4. Do **not** revive a separate Vite mock on `:5173` as the product.

---

## 3. Backend modular architecture

### Target NestJS module map

| Module | Responsibility |
|--------|----------------|
| `PlatformModule` | Health, config, swagger, metrics |
| `TenantModule` | Facilities, subscriptions, tenant context |
| `IdentityModule` | Users, sessions, OAuth, password reset, MFA |
| `RbacModule` | Roles, permissions, grants |
| `StaffModule` | Workforce, departments, wards |
| `PatientModule` | Demographics, registration |
| `SchedulingModule` | Appointments, queues, doctor schedules |
| `ClinicalModule` | Encounters, notes, allergies, history |
| `LaboratoryModule` | Orders, results |
| `PharmacyModule` | Rx, dispense, inventory |
| `BillingModule` | Charges, invoices, payments |
| `InpatientModule` | Beds, ADT |
| `NotificationModule` | In-app + email/SMS jobs |
| `ReportingModule` | Analytics exports |
| `AuditModule` | Immutable access/action logs |
| `IntegrationModule` | FHIR adapters (later) |

### Communication rules

- Modules expose **application services**; cross-module calls go through those APIs (no deep Prisma grabs across domains).
- Shared kernel: tenant context, auth user, pagination, error types, audit writer.
- Domain events (in-process initially) for “appointment confirmed → notify patient”.

### Nest + existing Express

- Short term: Nest host remains; Express routers stay mounted as today.
- Medium term: extract one domain at a time into Nest controllers/services **behind the same URL paths** (no silent contract changes).
- See `MIGRATION_PLAN.md`.

---

## 4. Database architecture direction

### Near-term (pre-multi-tenant hardening)

- Keep Prisma + PostgreSQL.
- Normalize date/time fields to `DateTime`/`timestamptz` in planned migrations.
- Split JSON blobs (slots) into relational tables when scheduling becomes commercial-critical.
- Add clinical tables only with clear ownership module and audit hooks.

### Multi-tenant data model (recommended)

**Shared database, shared schema, mandatory `facilityId` (tenant key) on all tenant-owned rows.**

```
Facility (tenant)
  └── Users, Staff, Patients, Appointments, … (every row carries facilityId)
PlatformAdmin users may have facilityId = null
```

**Why this over DB-per-tenant initially**

- Fits current Neon/Prisma ops and Render single service.
- Lower ops cost for Ethiopian clinic MVP SaaS.
- Enforce isolation via: Prisma middleware / extension, CHECK constraints, unique indexes scoped by facility, automated tests.

**When to consider schema-per-tenant or DB-per-tenant**

- Large hospital chains demanding physical isolation.
- Strict contractual residency beyond row-level guarantees.

### Indexing & constraints

- Unique emails **per facility** (not globally) once multi-tenant — or global login with facility memberships (decision in TECHNICAL_DECISIONS).
- Composite indexes `(facilityId, …)` on all hot queries.

---

## 5. Multi-tenancy strategy

### Requirements (design)

Each facility isolates: users, patients, records, appointments, departments, staff, prescriptions, lab, inventory, invoices, reports, configs.

### Enforcement layers

1. **AuthN** — session includes `facilityId` / active membership.
2. **AuthZ** — permission checks always facility-scoped.
3. **Data access** — Prisma extension auto-injects `facilityId` on find/create; reject queries without tenant context.
4. **Jobs** — BullMQ job payloads include `facilityId`; workers refuse cross-tenant.
5. **Files** — storage key prefix `facilities/{facilityId}/…`.
6. **Tests** — mandatory negative tests attempting cross-tenant reads/writes.

### Explicit non-goals for Section 1

- Do **not** implement tenancy until Section approval and a dedicated migration window.

---

## 6. Authentication and authorization design

### AuthN (evolve current system)

| Keep | Add later |
|------|-----------|
| Cookie JWT + tokenVersion | MFA (TOTP) for staff |
| Google OAuth | Magic link / invite onboarding |
| Password reset SMTP | Email verification enforcement |
| Secure cookies / CORS | Session idle timeout + refresh rotation |

### AuthZ

- Keep string permission catalog; move to DB-backed roles for facility customization later.
- Introduce **resource policies** for EMR (patient chart access = assigned clinician OR ward role OR break-glass with audit).
- Separate **platform roles** (super admin) from **facility roles**.

### Patient portal

- Patient users bound to `facilityId` + `patientId`.
- Limited scopes; no staff endpoints.

---

## 7. Security architecture

### Engineering controls (target)

- TLS everywhere; HSTS at edge.
- Least-privilege DB users; no prod seed.
- Field-level encryption for selected identifiers (national ID) if legally required — evaluate with counsel.
- Comprehensive audit: who accessed which patient record, when, why.
- Backup + tested restore (existing scripts evolve to facility-aware exports).
- Secrets only in host env (never docs/repos).
- Dependency scanning in CI; security headers tightened as inline scripts leave CSP.

### Compliance posture

- Treat records as sensitive under **Ethiopia Personal Data Protection Proclamation No. 1321/2024**.
- Engineering implements technical safeguards; **legal counsel** confirms lawful basis, retention, cross-border (Neon region), DPA with processors, data subject rights workflows.
- **Do not claim compliance** solely because controls exist.

---

## 8. API design standards

| Standard | Choice |
|----------|--------|
| Style | REST JSON |
| Versioning | `/api/v1/...` when Nest modules land (keep unversioned aliases during migration) |
| Errors | `{ error, code?, details? }` consistent |
| Validation | Zod or Nest DTO + class-validator (pick one per module migration) |
| Auth | Cookie session primary; Bearer for future mobile |
| Docs | Swagger/OpenAPI generated from Nest |
| Pagination | Continue cursor/limit patterns in `lib/pagination.ts` |
| Idempotency | Required for payments and lab result posts |

**Rule:** Do not silently change existing contracts; introduce new paths or versioned dual-run.

---

## 9. Integration strategy

### Phased

1. **Internal events** — notify, bill, audit.
2. **Documented partner APIs** — lab analyzers / pharmacy — only with verified specs.
3. **HL7 FHIR R4** — Patient, Encounter, Appointment, Observation as export/import adapters in `IntegrationModule`.
4. **Ethiopian national digital health / exchange** — only after official specs and authorization; do not invent mappings.

### Terminology

- Plan for coded values (ICD/SNOMED/LOINC subsets) behind clinical dictionaries — start with facility-configurable code lists.

---

## 10. Deployment architecture

### Current (preserve)

- Docker image for backend; Render Blueprint; Neon Postgres; optional GitHub Pages brochure.

### Target SaaS

| Environment | Purpose |
|-------------|---------|
| `dev` | Feature branches, seed allowed |
| `staging` | Prod-like Neon branch, no destructive seed |
| `prod` | Multi-tenant, backups, monitoring |

### Additions when scale demands

- Redis addon
- Object storage (S3-compatible)
- Log/metrics (OpenTelemetry-friendly)
- Separate worker process for BullMQ (same codebase)

### Regions

- Prefer DB/compute regions compatible with Ethiopian data residency guidance once counsel advises.

---

## 11. Recommended final architecture (summary statement)

**Filfilu remains one modular NestJS monolith on PostgreSQL/Prisma, with a progressive TypeScript frontend, cookie-based identity, facility-scoped multi-tenancy, Redis/BullMQ when jobs appear, OpenAPI documentation, and FHIR-ready integration ports — evolved from today’s Express routers and landing UI without a big-bang rewrite.**

---

*End of TARGET_ARCHITECTURE.md — Section 1*
