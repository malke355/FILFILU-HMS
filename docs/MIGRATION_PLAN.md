# Filfilu HMS — Express → Nest Modular Migration Plan

**Status:** Design only (Section 1)  
**Constraint:** Do not delete Express routers until Nest replacements are verified. Prevent duplicate business logic and API conflicts.

---

## 1. Current state summary

| Component | Status |
|-----------|--------|
| NestJS | Listen host only (`nest-host.ts`, empty `FilfiluHttpModule`) |
| Express | All HTTP business routes |
| Nest controllers | **None** |
| Shared listen port | `8080` via `ExpressAdapter` |

There is **no** parallel Nest route surface today — only Express. Migration risk is introducing a second implementation of the same paths.

---

## 2. Existing Express routes (inventory)

### Mounted in `app.ts`

- `/api` → `publicRoutes`, `contactRoutes`, `resourceRoutes`
- `/api/auth` → `authRoutes`
- Static + clean URLs for landing pages

### Auth (`/api/auth`)

`POST /login`, `POST /signup`, `POST /forgot-password`, `POST /reset-password`,  
`GET /google`, `GET /google/callback`, `GET|POST /logout`, `GET /me`

### Public / forms

`GET /health`, `GET /departments`, `GET /doctors`, `GET /doctor-schedules`, `GET /specialties`,  
`POST /contact`, `POST /bookings`

### Resources

`GET|POST|PATCH` staff, patients, appointments, shifts, exchanges, notifications, activity, dashboard stats, reports summary, cleanup-duplicates, publish-drafts, approve-pending

### Legacy

`hmsDb.ts` — empty; safe to keep unused until Nest cleanup pass.

---

## 3. Existing NestJS routes

**None.** Migration starts from zero Nest controllers.

---

## 4. Migration priorities

| Priority | Domain | Why first |
|----------|--------|-----------|
| P0 | Platform shell | Nest modules, global filters, Swagger, config — no path moves |
| P1 | Identity (`/api/auth/*`) | Highest security sensitivity; clear boundary |
| P2 | Public health/doctors | Low coupling; good Nest practice run |
| P3 | Staff + RBAC | Needed before clinical expansion |
| P4 | Appointments + schedules | Core product |
| P5 | Shifts/exchanges | Dependent on staff |
| P6 | Notifications/reports/contact | Supporting |
| P7 | New modules (tenant, EMR, …) | Build **only** as Nest — never Express |

**Rule for new features:** After P0, **new domains ship as Nest modules only**. Do not grow `resources.ts`.

---

## 5. Dependencies

```
P0 Platform
 └─► P1 Identity (session middleware ported to Nest guards)
      └─► P2 Public
      └─► P3 Staff
           └─► P4 Appointments
           └─► P5 Shifts/Exchanges
                └─► P6 Ancillary
```

Prisma client remains shared. Cookie names, JWT claims, and response JSON shapes stay stable during each cutover.

---

## 6. Safe cutover pattern (per route group)

For each route batch:

1. **Extract** pure service functions from Express handlers into `*.service.ts` (usable by both).
2. **Add** Nest controller that calls the same service (feature flag or internal-only first).
3. **Shadow test** — integration tests hit Nest path in CI.
4. **Switch mount** — Express router stops registering those paths; Nest handles them at **identical URLs**.
5. **Delete** Express handler only after soak (staging + prod monitoring).
6. **Never** run Express and Nest handlers for the same method+path simultaneously.

### Conflict prevention

- Single registration table maintained in docs/CI check: path → owner (`express`|`nest`).
- Fail CI if both register the same route.

---

## 7. Risks

| Risk | Mitigation |
|------|------------|
| Dual logic drift | Shared services; ban copy-paste handlers |
| Cookie/auth subtle breaks | Contract tests for `/login`, `/me`, Google callback |
| Large `resources.ts` extraction errors | Slice by resource with characterization tests |
| Frontend assumes Express error strings | Keep error JSON stable |
| Premature Nest complexity | Empty modules OK; don’t add CQRS/microservices |
| Big-bang rewrite | Forbidden — incremental only |

---

## 8. Testing and verification strategy

1. **Characterization tests** before moving a route (record status + key JSON fields).
2. **Auth suite:** login, logout, me, reset, Google (mocked).
3. **RBAC suite:** each role against staff/patients/appointments.
4. **Regression:** landing pages still load from same origin.
5. **Soak:** staging 48h with Nest-owned batch before Express deletion.
6. After multi-tenant: cross-tenant denial tests gate release.

---

## 9. Safe retirement strategy for Express

| Stage | Express role |
|-------|----------------|
| Now | Full API |
| During migration | Shrinks per cutover batch |
| End state | Optional thin static/file middleware only **or** fully replaced by Nest static + API |

Retirement checklist per batch:

- [ ] Nest controller + service live
- [ ] Same URL + method
- [ ] Tests green
- [ ] Express registration removed
- [ ] No orphaned imports
- [ ] README/API index updated

**Do not** remove Express dependency until zero business routers remain (Nest still may use Express adapter underneath — that is fine).

---

## 10. Frontend alignment during migration

- Keep `landing/js/auth.js` `API_BASE` same-origin `/api`.
- No forced `/api/v1` until a versioned dual-run is intentional.
- When Next/React shell arrives, point it at the same contracts.

---

## 11. Suggested first implementation slice (after Section approval)

1. Expand `FilfiluHttpModule` imports: `ConfigModule`, `PrismaModule`, `HealthController`.
2. Move `GET /api/health` to Nest (lowest risk).
3. Introduce Nest `AuthGuard` wrapping existing JWT cookie verification.
4. Stop. Review. Then Identity batch.

---

*End of MIGRATION_PLAN.md — Section 1*
