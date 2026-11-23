# Audit Logging Design (Section 3)

## Storage

`AuditLog` rows are append-oriented. Facility users have **no** API to update or delete audit rows. Retention cleanup (`AUDIT_RETENTION_DAYS`, default 90) is a server job only.

## Writer

`writeAudit()` in `backend/src/lib/audit.ts`:

- Sanitizes metadata via `sanitizeAuditMeta` (strips secrets/PHI-heavy fields).
- Optionally merges request IP, User-Agent, and correlation id (`x-request-id` / `x-correlation-id`) into meta JSON.

## Events recorded (security / admin)

| Action | When |
|--------|------|
| `auth.login` / `auth.login_failed` | Password login success/failure |
| `auth.signup` | Patient registration |
| `auth.google` / `auth.google_signup` | Google OAuth |
| `auth.logout` / `auth.logout_all` | Session end |
| `auth.refresh` / `auth.refresh_reuse` | Refresh rotation / reuse attack signal |
| `auth.forgot_password` / `auth.reset_password` / `auth.change_password` | Password workflows |
| `auth.switch_facility` | Facility context change |
| `staff.create_account` / `staff.update` / `staff.deactivate` / `staff.reactivate` | Staff admin |
| `user.activate` / `user.deactivate` | Account status |
| `patients.clinical_access` | Sensitive clinical note read |

## Fields

- `actorId`, `facilityId`, `action`, `entity`, `metaJson`, `createdAt`
- Do **not** log passwords, raw tokens, full clinical notes, or reset token values.

## Access

Audit trails are for platform/ops and future admin reporting. Ordinary facility APIs must not expose editable audit collections.
