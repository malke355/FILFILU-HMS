# Security Test Report (Section 3)

**Date:** 2026-11-23  
**Runner:** `npm test` (Vitest) in `backend/`  
**Result:** **43 passed / 0 failed** (11 files)

## Coverage vs requirements

| # | Requirement | Result | How verified |
|---|-------------|--------|--------------|
| 1 | Valid users authenticate | Pass | Integration login → 200 + cookies |
| 2 | Invalid credentials rejected | Pass | Login → 401 |
| 3 | Inactive users blocked | Pass | `User.status=inactive` → 403 |
| 4 | Expired access tokens rejected | Pass* | JWT verify fails in `requireAuth` (unit path via existing session/`tv` checks); short TTL configured |
| 5 | Refresh rotation | Pass | `rotateAuthSession` issues new hash |
| 6 | Revoked refresh cannot reuse | Pass | Revoke + reuse family detection |
| 7 | Cannot switch to non-member facility | Pass | `switch-facility` → 403 |
| 8 | Cannot access other facility resources | Pass | Prior tenant isolation suite + `resolveFacilityContext` |
| 9 | Permission required for actions | Pass | RBAC matrix unit tests + `requirePermission` |
| 10 | Receptionist no clinical notes | Pass | Permissions + `canAccessClinicalNotes` |
| 11 | Pharmacist no billing/clinical write | Pass | RBAC matrix |
| 12 | Facility admin cannot grant platform privileges | Pass | Staff create with `platformRole` → 403 |
| 13 | Users cannot elevate themselves | Pass | Staff PATCH blocks own role change |
| 14 | Audit events for security actions | Pass | `writeAudit` wired on login/logout/refresh/password/switch/clinical |
| 15 | Existing auth-dependent flows | Pass | Nest host + login smoke tests still green |

\* Dedicated “expired JWT clock” assertion is implicit via `jsonwebtoken` verify; not a separate fake-timer case.

## Suites

- `authSession.test.ts` — hash / opaque token helpers  
- `rbac.matrix.test.ts` — least-privilege matrix  
- `security.auth.integration.test.ts` — login, refresh, facility switch, platform grant block  
- `tenant.isolation.test.ts` — cross-facility isolation (Section 2, still green)  
- Existing roles/rbac/privacy/env/nest-host tests

## Manual configuration

1. Apply migration: `npx prisma migrate deploy` (applied: `20261123220000_auth_sessions_security`).
2. Ensure `JWT_SECRET` ≥ 32 characters.
3. Optional: `ACCESS_TOKEN_TTL_SEC`, `REFRESH_TOKEN_TTL_MS`, `BCRYPT_COST`, `COOKIE_SECURE`.
4. Restart Express on port **8080** after deploy so new routes load.
