# Security Implementation (Section 3)

## Controls in place

| Control | Implementation |
|---------|----------------|
| Password hashing | bcrypt cost 12 (`BCRYPT_COST`) |
| Access tokens | Short-lived JWT in HttpOnly cookie |
| Refresh tokens | Opaque; SHA-256 in `AuthSession`; rotation + family reuse detection |
| Rate limiting | Login, signup, forgot/reset password, Google OAuth, contact/booking |
| CORS | Allowlist from `CORS_ORIGIN`; `credentials: true` |
| HTTP headers | Helmet CSP, referrer-policy, CORP |
| Input validation | Zod on auth and mutation bodies |
| Mass assignment | Client `facilityId` stripped; `platformRole` rejected on staff create |
| IDOR / tenancy | Facility resolved from membership; resources filtered by `facilityId` |
| Account status | `User.status` checked on login and every protected request |
| Self-elevation | Cannot change own role/status; cannot grant platform privileges |
| Clinical least privilege | Condition redaction + `/patients/:id/clinical` permission gate |
| Safe errors | Generic 500 in production; no password/token logging |
| Secrets | `JWT_SECRET` ≥32 chars; weak placeholders rejected at sign/verify |

## Cookie / CSRF notes

SameSite=Lax mitigates classic cross-site POST CSRF for cookie auth on top-level navigations. State-changing APIs are JSON POST with SameSite cookies. If cross-site embedding is ever required, add CSRF tokens before relaxing SameSite.

## File uploads

No general upload API in Section 3. When added, authorize by facility membership + content-type/size limits.

## Environment

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Access JWT HMAC (≥32, not a placeholder) |
| `JWT_EXPIRES_IN` / `ACCESS_TOKEN_TTL_SEC` | Access TTL |
| `REFRESH_TOKEN_TTL_MS` | Refresh TTL |
| `BCRYPT_COST` | Hash work factor |
| `COOKIE_SECURE` | Force Secure cookie flag |
| `CORS_ORIGIN` | Allowed browser origins |
| `TRUST_PROXY` | Rate-limit real client IP |

## Incomplete / deferred

- Full Argon2id migration (bcrypt retained intentionally).
- Postgres RLS (deferred; Neon pooler constraints from Section 2).
- Dedicated CSRF token middleware (SameSite=Lax currently).
- Platform `support` role capability matrix beyond identity.
- Automated E2E browser suite (Vitest unit + API integration covered).
