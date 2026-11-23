# Auth API Reference (Section 3)

Base path: `/api`. OpenAPI: `/api/openapi/auth.yaml`.

All browser calls should use `credentials: "include"`. Tokens are cookies — do not expect JWT bodies for SPA storage.

## Authentication

### `POST /auth/login`

Body: `{ email, password, role? }`  
Success `200`: `{ user }` + Set-Cookie access/refresh  
Errors: `401` invalid credentials, `403` inactive / role mismatch, `429` rate limited

### `POST /auth/signup`

Patient-only. Body: `{ first, last, email, password }`  
Success `201`: `{ user }` + cookies  
Errors: `409` email exists, `403` non-patient role attempted

### `POST /auth/logout`

Revokes current refresh cookie; clears cookies. Does not invalidate other devices.

### `POST /auth/logout-all`

Requires auth. Revokes all `AuthSession` rows and bumps `tokenVersion`.

### `POST /auth/refresh`

Uses `filfilu_refresh` cookie (or body `refreshToken`). Rotates refresh; issues new access cookie.  
`401` on missing/expired/reuse.

### `POST /auth/change-password`

Auth required. Body: `{ currentPassword, newPassword }`. Revokes all sessions; client must re-login.

### `POST /auth/forgot-password` / `POST /auth/reset-password`

Enumeration-safe forgot. Reset consumes one-time hashed token; revokes all sessions.

### `GET /auth/me`

Auth required. Returns user, `facilityId`, `facilities[]`, `permissions[]`, `platformRole`, `status`.

### `GET /auth/facilities`

Auth required. `{ facilities, activeFacilityId }`

### `POST /auth/switch-facility`

Auth required. Body: `{ facilityId }`. Membership validated server-side. Re-issues cookies.

### Google OAuth

`GET /auth/google?intent=login|signup` → callback sets cookies → redirect `app.html`.

## User administration

### `PATCH /users/:userId/status`

Permission: `users.manage` or `staff:write`. Body: `{ status: "active"|"inactive" }`.  
Cannot target self or platform accounts.

### `POST /staff/accounts` / `PATCH /staff/:id`

Facility staff create/update. Cannot assign platform roles or change own role.

## Clinical

### `GET /patients/:id/clinical`

Requires clinical permission; audited as `patients.clinical_access`.

## Common errors

| Status | Meaning |
|--------|---------|
| 401 | Missing/invalid/expired session or credentials |
| 403 | Authenticated but forbidden (permission, facility, inactive) |
| 429 | Rate limited |
| 400 | Validation / self-deactivation |
