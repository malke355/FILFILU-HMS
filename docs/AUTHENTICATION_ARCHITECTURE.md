# Authentication Architecture (Section 3)

## Model

Filfilu uses **cookie-based JWT access tokens** plus **hashed refresh-token sessions**.

| Cookie | Purpose | Lifetime (default) |
|--------|---------|-------------------|
| `filfilu_token` | Short-lived access JWT (HttpOnly, Secure*, SameSite=Lax) | 15 minutes (`ACCESS_TOKEN_TTL_SEC` / `JWT_EXPIRES_IN`) |
| `filfilu_refresh` | Opaque refresh token (HttpOnly); only SHA-256 hash stored in `AuthSession` | 7 days (`REFRESH_TOKEN_TTL_MS`) |

\* `Secure` is on in production or when `COOKIE_SECURE=1`.

**Why not localStorage?** Browser XSS cannot read HttpOnly cookies. Access tokens are never returned in JSON for SPA storage.

## Password hashing

- Algorithm: **bcrypt** (bcryptjs), cost factor **12** (`BCRYPT_COST`, range 10–15).
- Argon2id was considered; bcrypt matches the existing stack without a native dependency. Work factor raised from 10 → 12.

## Session lifecycle

1. **Login / signup / Google OAuth** → `establishSession()` issues access JWT + creates `AuthSession` + sets refresh cookie.
2. **Refresh** (`POST /api/auth/refresh`) → validates refresh hash, **rotates** (revokes old, issues new in same `familyId`), sets new cookies.
3. **Reuse detection** → presenting a revoked refresh token revokes the entire family and bumps `tokenVersion` (forces re-login everywhere).
4. **Logout** → revokes current refresh only (other devices remain).
5. **Logout-all / password change / reset / deactivate** → revoke all sessions + increment `tokenVersion`.

Access JWT claims include `sub`, `role` (facility-scoped), `facilityId`, `platformRole`, `tv` (must match `User.tokenVersion`).

## Account status

- `User.status`: `active` | `inactive`.
- Inactive users cannot login and fail `requireAuth` even with a previously issued JWT.
- Staff `inactive` still blocks sessions (pre-existing).

## Facility context

- Active facility is taken from the **validated JWT / membership**, optionally narrowed by `X-Facility-Id` **only if** membership (or platform `super_admin`) allows it.
- `POST /api/auth/switch-facility` re-validates membership and re-issues cookies. Client-supplied facility IDs are never trusted alone.

## Onboarding

- Public signup / Google signup → **patient** only.
- Staff accounts → `POST /api/staff/accounts` by facility admins (creatable facility roles only).
- Facility admins **cannot** grant `platformRole` (`super_admin` / `support`).

## Related docs

- [RBAC_PERMISSION_MATRIX.md](./RBAC_PERMISSION_MATRIX.md)
- [SECURITY_IMPLEMENTATION.md](./SECURITY_IMPLEMENTATION.md)
- [AUDIT_LOGGING_DESIGN.md](./AUDIT_LOGGING_DESIGN.md)
- [AUTH_API_REFERENCE.md](./AUTH_API_REFERENCE.md)
