# Filfilu HMS — Technical Decisions Record

**Section 1 architecture decisions.** Update this file when choices change.

Format: Decision → Context → Options → Choice → Consequences → Open questions.

---

## ADR-001 — Evolve in place (no greenfield rewrite)

- **Context:** Working auth, appointments, roster, deploy path already exist.
- **Options:** (A) Rewrite Nest+Next from scratch (B) Evolve modularly (C) Keep Express forever.
- **Choice:** **B** — modular evolution.
- **Consequences:** Slower feature velocity early; lower regression risk; preserves `:8080` product.
- **Open:** None.

---

## ADR-002 — NestJS as modular monolith host; Express until cutover

- **Context:** Nest already listens via ExpressAdapter; domain code is Express.
- **Options:** (A) Immediate full Nest rewrite (B) Incremental Nest modules (C) Drop Nest, stay Express.
- **Choice:** **B**.
- **Consequences:** Temporary dual framework knowledge; requires strict no-dual-route rule.
- **Open:** Timeline for retiring Express routers.

---

## ADR-003 — Single deployable over microservices

- **Context:** Early commercial SaaS for Ethiopian clinics; small team.
- **Options:** (A) Microservices per domain (B) Modular monolith (C) Serverless functions sprawl.
- **Choice:** **B**.
- **Consequences:** Simpler ops on Render; split later only with clear boundary pressure.
- **Open:** None.

---

## ADR-004 — PostgreSQL + Prisma remains system of record

- **Context:** Schema/migrations/seed already Prisma.
- **Options:** (A) Keep Prisma (B) Switch to TypeORM/Drizzle (C) Raw SQL only.
- **Choice:** **A**.
- **Consequences:** Continue migration discipline; avoid runtime schema hacks.
- **Open:** Prisma multi-tenant middleware vs extension API design.

---

## ADR-005 — Multi-tenancy: shared DB + `facilityId` row isolation

- **Context:** Need multiple facilities on one platform without immediate DB-per-tenant ops cost.
- **Options:** (A) Shared schema + tenant column (B) Schema-per-tenant (C) DB-per-tenant.
- **Choice:** **A** for MVP SaaS; revisit C for enterprise contracts.
- **Consequences:** Requires airtight query enforcement + tests; careful unique constraints.
- **Open:** Global vs per-facility email identity (see ADR-006).

---

## ADR-006 — Identity model for multi-facility users (ACCEPTED)

- **Context:** Doctors may work at multiple clinics; patients usually one facility. Section 2 requires multi-facility memberships.
- **Options:**
  - (A) User unique email globally + `FacilityMembership(facilityId, role)`
  - (B) User unique per facility (duplicate emails allowed across tenants)
  - (C) Separate login realms per facility subdomain
- **Choice:** **A** — global `User.email`; facility privileges via `FacilityMembership`. Active facility context drives RBAC.
- **Consequences:** Google OAuth and password reset remain global to the user; memberships grant facility access. Legacy `User.role` / `staffId` / `patientId` kept as compatibility mirrors of the active membership.
- **Open:** None for Section 2. Facility switcher UX deferred.

## ADR-015 — Section 2 schema scope (no empty commercial modules)

- **Context:** Section 2 listed lab/pharmacy/billing domains; also “do not create unnecessary tables.”
- **Choice:** Tenantize existing models + Facility/IAM foundation + thin patient extensions (`PatientIdentifier`, `PatientEmergencyContact`, `PatientAllergy`). Defer Encounter/Lab/Pharmacy/Billing tables to later sections.
- **Consequences:** Docs list planned tables; no fake unfinished modules in Prisma.

---

## ADR-007 — Frontend: preserve landing; progressive TS app (Next or React)

- **Context:** Vanilla `app.html` works for 4 roles but will not scale to lab/pharmacy/billing.
- **Options:** (A) Next.js app router (B) Vite React SPA (C) Keep vanilla forever.
- **Choice:** **A preferred**, **B acceptable** if lighter; **not C** long-term. Do not resurrect mock `:5173` product.
- **Consequences:** Dual UI during transition; design system extraction needed.
- **Open:** Exact framework pick in Section 2 kickoff.

---

## ADR-008 — Cookie session remains primary web auth

- **Context:** httpOnly JWT cookie already production-hardened.
- **Options:** (A) Keep cookies (B) LocalStorage JWT (C) Session store in Redis only.
- **Choice:** **A**; optional Bearer for future mobile; Redis sessions later if needed.
- **Consequences:** CSRF considerations for cookie POSTs — same-site + CORS already used; revisit explicit CSRF tokens for sensitive mutations.
- **Open:** CSRF token strategy when SPA expands.

---

## ADR-009 — Redis + BullMQ when jobs justify complexity

- **Context:** Email + retention currently inline/startup.
- **Options:** (A) Add Redis now (B) Add when async volume hurts (C) Never.
- **Choice:** **B** — introduce with notification/billing jobs.
- **Consequences:** Avoids premature infra cost on Render free tiers.
- **Open:** Provider choice (Render Redis vs Upstash).

---

## ADR-010 — REST + OpenAPI; FHIR as adapter layer later

- **Context:** Current clients speak REST JSON.
- **Options:** (A) REST internal + FHIR gateway later (B) FHIR-native everywhere (C) GraphQL.
- **Choice:** **A**.
- **Consequences:** Cleaner product API; FHIR mappings explicit and versioned.
- **Open:** National exchange profile when specs available.

---

## ADR-011 — Compliance claims require legal review

- **Context:** PDPP 1321/2024 and healthcare sensitivity.
- **Options:** (A) Claim compliance after controls (B) Implement controls + counsel review before claims.
- **Choice:** **B**.
- **Consequences:** Marketing language must stay accurate.
- **Open:** Engage Ethiopian data protection counsel; processor inventory.

---

## ADR-012 — New commercial modules are Nest-only

- **Context:** Prevent Express `resources.ts` from absorbing lab/billing.
- **Options:** (A) Nest-only for new domains (B) Continue Express growth.
- **Choice:** **A** after Platform P0.
- **Consequences:** Forces migration discipline.
- **Open:** None.

---

## ADR-013 — Default facility backfill for existing data

- **Context:** Current DB has no tenant key; production/demo rows exist.
- **Options:** (A) Create `Facility` “Filfilu Default” and backfill `facilityId` NOT NULL (B) Separate DBs per customer from day one.
- **Choice:** **A** when tenancy ships.
- **Consequences:** One-time migration; app must deny null facility on tenant tables afterward.
- **Open:** Name/slug of default facility; whether demo seed creates facility.

---

## ADR-014 — Always revalidate session with `/auth/me` on workspace boot

- **Context:** `bootWorkspace` can trust forged `sessionStorage` role chrome if `cookieAuth` is set.
- **Options:** (A) Always `/auth/me` before UI (B) Sign sessionStorage blob (C) Rely on API only.
- **Choice:** **A** (plus clear storage on `/me` failure). API remains authoritative; UI must not lie about role.
- **Consequences:** One extra round-trip on app load; fixes privileged-chrome spoof.
- **Open:** None — implement in first hardening slice after Section approval.

---

## Decisions explicitly deferred (not made)

- Field-level encryption product list.
- SMS provider.
- Payment gateway for patient billing (local Ethiopian providers TBD).
- AI vendor / on-prem model policy.
- Whether patient portal is subdomain (`patient.`) vs path (`/portal`).

---

*End of TECHNICAL_DECISIONS.md — Section 1*
