# Filfilu HMS — Project Audit

**Audit date:** 2026-11-23  
**Scope:** Full repository at `FILFILU HMS` (source-verified; no assumptions from chat plans)  
**Product host:** Express app in `backend/` serving `landing/` + `/api` on port **8080**  
**Section:** 1 — Audit only (no feature implementation)

---

## 1. Existing project architecture

### High-level shape

```
FILFILU HMS/
├── backend/          # Product process: Nest listen host + Express routes + Prisma
│   ├── src/
│   │   ├── index.ts          # Boot: env checks, DB ping, createApp(), listenWithNest()
│   │   ├── nest-host.ts      # Empty Nest module + ExpressAdapter (listen only)
│   │   ├── app.ts            # Express middleware, mounts routers, static landing
│   │   ├── routes/           # Express Router business APIs
│   │   ├── middleware/       # auth, rateLimit, error
│   │   └── lib/              # auth, rbac, prisma, mail, google, audit, …
│   ├── prisma/               # schema + migrations + seed
│   └── docker/               # compose, nginx sample, entrypoint
├── landing/          # Marketing + auth pages + single-page workspace (vanilla HTML/JS)
├── docs/             # Architecture documentation (this folder)
├── scripts/          # Static deploy prep for Vercel/Pages
├── render.yaml       # Render Blueprint
└── vercel.json       # Static brochure deploy only
```

### Runtime model (verified)

| Layer | Reality |
|-------|---------|
| Process | NestJS `NestFactory` + `ExpressAdapter` listens (`backend/src/nest-host.ts`) |
| HTTP API | **Express 5 routers** (`auth`, `public`, `contact`, `resources`) |
| Nest modules/controllers | **None** — `FilfiluHttpModule` is empty |
| UI | Static HTML/JS under `landing/`, served by Express |
| Separate Next.js / Vite product UI | **Not present** in this repo |
| Database | PostgreSQL via Prisma (`DATABASE_URL`; Neon preferred) |

**Important:** NestJS is a **host**, not a modular domain framework yet. All business logic lives in Express route handlers and `lib/*`.

---

## 2. Current technology stack

| Area | Technology | Notes |
|------|------------|--------|
| Language | TypeScript (backend) | ES modules (`"type": "module"`) |
| API framework | Express 5 | Primary implementation |
| Process host | NestJS 11 | Listen-only adapter |
| ORM | Prisma 5 | Migrations under `prisma/migrations/` |
| DB | PostgreSQL | Neon or local Docker `5434` |
| Auth | JWT in httpOnly cookie + optional Bearer | `jsonwebtoken`, `bcryptjs` |
| OAuth | Google OAuth | `google-auth-library` |
| Email | Nodemailer SMTP | Password reset |
| Validation | Zod | Request bodies |
| Security middleware | helmet, cors, rate-limit | CSP allows inline scripts for landing |
| Tests | Vitest | Unit tests for env/rbac/roles/privacy/datetime/nest-host |
| Frontend | Vanilla HTML + CSS + JS | No React/Next build for product UI |
| i18n | Custom `landing/js/i18n.js` | en / am / om |
| Deploy | Docker + Render Blueprint; static Pages/Vercel | Full product = backend host |

**Not in use (despite target vision):** Redis, BullMQ, Swagger/OpenAPI, Next.js app router, multi-tenant schema, FHIR libraries, file-upload pipeline (multer appears only as Nest transitive dependency; no app upload routes).

---

## 3. Existing modules (domain coverage)

| Domain | Status | Evidence |
|--------|--------|----------|
| Auth (login/signup/logout/me) | **Complete** (single-facility) | `routes/auth.ts` |
| Google OAuth | **Complete** | `lib/google.ts`, auth routes |
| Password reset | **Complete** | `PasswordResetToken`, mail, forgot/reset pages |
| Staff & roles (admin creates doctor/nurse) | **Partial** | `POST /staff/accounts`, `PATCH /staff/:id` |
| Patients (list/filter by RLS) | **Partial** | Thin `Patient` model; no full EMR |
| Appointments | **Partial** | CRUD-ish + status; string date/time |
| Duty shifts & exchanges | **Partial** | Admin publish, peer approve |
| Public doctors / schedules | **Partial** | Landing + authenticated schedules |
| Notifications | **Basic** | List by user/role |
| Dashboard stats / activity / reports | **Basic** | Aggregates + audit-ish activity |
| Contact / marketing bookings | **Basic** | Public forms |
| Departments | **Minimal** | Name list only |
| Lab / pharmacy / inventory | **Missing** | No models/routes |
| Billing / invoices | **Missing** | — |
| Inpatient / bed mgmt | **Stub fields only** | `Patient.ward`, `Patient.bed` |
| Clinical notes / EMR | **Missing** | Permission `notes:write_own` unused in schema |
| Queue management | **Missing** | — |
| Multi-facility / tenants | **Missing** | No `facilityId` / `tenantId` |
| AI features | **Missing** | — |
| FHIR / national exchange | **Missing** | — |

---

## 4. Existing frontend pages

| Page | Path | Role |
|------|------|------|
| Marketing home | `landing/index.html` | Public |
| Login | `landing/login.html` (`/login`) | Public |
| Signup | `landing/signup.html` (`/signup`) | Public (patient only) |
| Forgot password | `landing/forgot-password.html` | Public |
| Reset password | `landing/reset-password.html` | Token link |
| Workspace | `landing/app.html` (`/app`) | Authenticated SPA-like shell |

### Frontend JS

| File | Responsibility |
|------|----------------|
| `landing/js/config.js` | Optional `FILFILU_API_BASE` for static hosts |
| `landing/js/auth.js` | API client, cookie session, RBAC mirrors, hydrate, workspace helpers |
| `landing/js/i18n.js` + `locales/*` | en/am/om |
| `landing/js/firebase.js` | Legacy remnant — product auth is **not** Firebase |

### Role workspaces in `app.html`

| Role | Nav views (implemented in HTML/JS) |
|------|-------------------------------------|
| admin | overview, staff, schedule, appointments, exchanges, reports |
| doctor | overview, schedule, patients, appointments, exchanges, notifications |
| nurse | overview, ward, schedule, appointments, exchanges, notifications |
| patient | overview, appointments, doctors, availability, notifications, profile |

**Not present in UI:** receptionist, lab tech, pharmacist, cashier, facility admin, super admin, multi-facility switcher.

---

## 5. Existing backend endpoints

Base: `/api` (mounted in `app.ts`).

### Public / health (`routes/public.ts`)

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/health` | None |
| GET | `/api/departments` | None |
| GET | `/api/doctors` | Optional |
| GET | `/api/doctor-schedules` | Required |
| GET | `/api/specialties` | None |

### Auth (`routes/auth.ts` → `/api/auth`)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/login` | Rate limited |
| POST | `/signup` | Patient only; issues session |
| POST | `/forgot-password` | Generic response; SMTP |
| POST | `/reset-password` | One-time token |
| GET | `/google` | OAuth start |
| GET | `/google/callback` | OAuth finish |
| GET/POST | `/logout` | Cookie clear + tokenVersion bump |
| GET | `/me` | Current user |

### Forms (`routes/contact.ts`)

| Method | Path |
|--------|------|
| POST | `/api/contact` |
| POST | `/api/bookings` |

### Resources (`routes/resources.ts`) — authenticated / permission-gated

| Method | Path |
|--------|------|
| GET | `/api/staff` |
| POST | `/api/staff/accounts` |
| PATCH | `/api/staff/:id` |
| GET | `/api/patients` |
| GET/POST | `/api/appointments` |
| PATCH | `/api/appointments/:id` |
| POST | `/api/appointments/cleanup-duplicates` |
| GET | `/api/shifts` |
| PATCH | `/api/shifts/:id/publish` |
| POST | `/api/shifts/publish-drafts` |
| GET/POST | `/api/exchanges` |
| PATCH | `/api/exchanges/:id` |
| POST | `/api/exchanges/approve-pending` |
| GET | `/api/notifications` |
| GET | `/api/activity` |
| GET | `/api/dashboard/stats` |
| GET | `/api/reports/summary` |

### Legacy

| File | Status |
|------|--------|
| `routes/hmsDb.ts` | Empty router; comment says legacy SQL demo removed |

---

## 6. Database structure

### Models (Prisma)

`User`, `PasswordResetToken`, `Department`, `Staff`, `Patient`, `Appointment`, `Shift`, `Exchange`, `DoctorPublic`, `DoctorSchedule`, `Notification`, `ContactMessage`, `BookingRequest`, `AuditLog`

### Migrations present

1. `20261026150000_init`
2. `20261026150100_drop_legacy_sql_tables`
3. `20261026160000_indexes_and_hot_fks`
4. `20261026170000_appointment_slot_unique`

### Structural observations

- **No tenant/facility key** on any table — single shared database namespace.
- Roles stored as **strings**, not enums.
- Appointment/shift dates are **strings**, not `DateTime` (limits querying/reporting).
- `DoctorSchedule.slotsJson` is a string blob — not normalized slots.
- Patient clinical data is shallow (`condition`, demographics) — not an EMR chart.
- `emailVerified` exists; email OTP verification was explored then **not shipped**.
- Seed (`CONFIRM_SEED=YES`) **wipes** demo data — must never run in production.

---

## 7. Authentication and authorization status

### Auth — working

- Email/password with bcrypt.
- Google OAuth (login existing; signup creates patient).
- httpOnly session cookie; `tokenVersion` revocation on logout/reset/deactivate.
- Password reset via hashed one-time tokens + SMTP.
- Production guards: JWT secret strength, secure cookies, SMTP required in prod, Google redirect checks.

### Auth — gaps for commercial SaaS

- No MFA / 2FA.
- No email verification gate on password signup (field exists; not enforced in current login path).
- No facility-scoped identity.
- No invitation/onboarding flows for staff beyond admin create.
- Static-host login fails without `FILFILU_API_BASE` (expected).
- Login “Remember me” checkbox is non-functional (not wired to cookie/session lifetime).
- Reset token travels in URL query string (`reset-password.html?token=`) — history/Referer exposure risk.

### Authorization — working (coarse RBAC)

- Server: `PERMISSIONS` in `lib/rbac.ts` + `requirePermission` middleware; data scoping via Prisma `where` (not Postgres RLS).
- Client: mirrored permissions + in-memory `rls.*` helpers in `auth.js` for UI filtering only.
- Patient self-signup locked to patient role; staff created by admin.

### Authorization — gaps

- Permissions like `notes:write_own`, `vitals:write_ward`, `profile:write_own`, `departments:write` have little or no resource implementation.
- Client `can()` uses hardcoded `PERMISSIONS[role]` and does not prefer server-returned `session.permissions`.
- No object-level ABAC (e.g. “this exact chart encounter”).
- No break-glass / emergency access model.
- Activity feed exposes action slugs (operational, not clinical audit UX).
- No global rate limit on authenticated APIs (only selected auth/public routes).

### Frontend session trust issue (critical for UI integrity)

`bootWorkspace()` in `landing/js/auth.js` trusts `sessionStorage` when `cookieAuth` is set and **skips** `GET /auth/me` in that case. `sanitizeStoredSession` always forces `cookieAuth: true`. A forged session blob can open the privileged workspace **chrome** (empty data; API calls fail via `allSettled`). API remains the real security boundary, but this is a **UI integrity / phishing-of-self** defect to fix early in Section 2 (always revalidate with `/auth/me` before painting role chrome).

---

## 8. Completed functionality (verified)

- Single-port product boot (Nest listen + Express app + landing).
- Health check with DB status.
- Cookie session auth + Google + password reset email.
- Role-based workspace shell (4 roles).
- Staff account creation/deactivation.
- Appointments request/manage with basic uniqueness index.
- Shifts publish + shift exchange workflow.
- Public doctor directory / schedules for patients.
- Contact + booking request capture.
- Audit log writes + retention purge on startup.
- Helmet/CSP/CORS/rate limits.
- Docker, Render blueprint, backup scripts, CI workflow.
- i18n (English, Amharic, Afaan Oromoo) for auth/marketing copy.

---

## 9. Incomplete functionality

- Full EMR (encounters, diagnoses, allergies, meds list, documents).
- Lab orders/results, pharmacy dispensing, inventory.
- Billing, payments, insurance, receipts.
- Inpatient ADT / bed board (fields only).
- Queue / triage.
- Receptionist / cashier / lab / pharmacy role UIs.
- Multi-tenant facility isolation.
- Swagger, Redis/BullMQ jobs, Nest domain modules.
- Next.js (or React) component architecture.
- File uploads (lab reports, ID scans, imaging).
- FHIR / national digital health exchange.
- Automated cross-tenant security tests (N/A until tenancy).
- Comprehensive API/integration/E2E test suites (mostly unit helpers today).

---

## 10. Technical debt

1. **Nest branding vs Express reality** — docs say Nest; domain code is Express routers. Risk of dual mental models.
2. **Monolithic `resources.ts`** — large mixed-domain file; hard to modularize later without extraction plan.
3. **Vanilla mega-`app.html`** — all role UIs in one HTML file; poor scalability for new clinical modules.
4. **Duplicated RBAC** — permissions defined in backend `rbac.ts` and again in `landing/js/auth.js`.
5. **String dates/times** — reporting and timezone correctness suffer.
6. **CSP `unsafe-inline`** — required by current landing; weakens XSS posture.
7. **Legacy Firebase JS / old chat references to Vite:5173 / API:4000** — confuse operators; product is `:8080` only.
8. **`hmsDb.ts` empty stub** — leftover surface.
9. **Shallow Patient model** vs permission names that imply clinical features.
10. **Static deploy paths** (Pages/Vercel) look like “the app” but cannot authenticate without a separate API host.

---

## 11. Security weaknesses (engineering view — not a compliance attestation)

| Area | Finding |
|------|---------|
| Transport | Depends on host TLS (Render/nginx); app enforces secure cookies in production |
| At-rest encryption | Relies on Postgres/Neon provider; no app-level field encryption for PHI |
| Session | Solid cookie + tokenVersion; no absolute idle timeout policy documented in code |
| AuthZ | Role RBAC only; incomplete enforcement for unused permissions |
| Audit | Present for auth/staff actions; not comprehensive clinical access logging |
| Uploads | None — future risk if added without scanning/type limits |
| Secrets | `.env` gitignored; examples avoid real secrets — good |
| Multi-tenant | **Absent** — single DB = total data mix if multiple facilities onboarded |
| Demo seed | Destructive; operational risk if mis-run |
| Legal | PDPP 1321/2024 implications need **legal review** — engineering controls alone ≠ compliance |

---

## 12. Performance concerns

- Workspace hydrate fans out many parallel GETs (improved by role-scoped paths, still chatty).
- No Redis caching for hot public doctor lists / schedules.
- String date filters prevent efficient range indexes on real timestamps.
- `DoctorSchedule.slotsJson` forces app-side parsing.
- No background job system for email/retention (retention runs synchronously at startup).
- Single Node process — fine for MVP clinics; needs horizontal plan for SaaS scale.

---

## 13. Duplicated functionality

| Duplication | Locations |
|-------------|-----------|
| Role permission lists | `backend/src/lib/rbac.ts` ↔ `landing/js/auth.js` |
| Role metadata / nav | Backend roles ↔ frontend `ROLE_META` / `NAV` |
| Auth session shaping | `publicUser` / JWT payload ↔ `toSession` |
| Static vs product hosts | README documents both; operators may use wrong URL |
| Nest vs Express | Nest empty module vs full Express routers |

---

## 14. Critical problems (prioritized for commercial readiness)

1. **No multi-tenancy** — cannot safely sell to multiple facilities on one deployment.
2. **Not an EMR** — clinical/legal risk if marketed as full HMS without charting, orders, meds.
3. **Nest modular monolith not started** — migration must be planned carefully to avoid dual APIs.
4. **Frontend architecture ceiling** — vanilla `app.html` will not carry lab/pharmacy/billing UIs cleanly.
5. **PHI model immature** — insufficient access logging, retention for clinical records, encryption strategy.
6. **Permission/feature mismatch** — named capabilities without implementations invite false confidence.
7. **Compliance claims** — must not assert PDPP/HIPAA/etc. compliance from current controls.
8. **Workspace boot trusts sessionStorage** — must revalidate via `/auth/me` before role UI (see above).
9. **Docs drift** — some README mentions (e.g. historical `demo-accounts`, “Postgres RLS” wording) do not match source; Nest is listen-host only.

---

## 15. Tests inventory

| Test file | Focus |
|-----------|--------|
| `env.test.ts` | Env parsing / production rules |
| `roles.test.ts` | Role helpers |
| `rbac.test.ts` | Permission matrix |
| `privacy.test.ts` | Audit meta redaction |
| `datetime.test.ts` | Date helpers |
| `nest-host.test.ts` | Nest listen adapter smoke |

**Missing:** route integration tests, auth E2E, RLS regression suite, load tests.

---

*End of PROJECT_AUDIT.md — Section 1*
