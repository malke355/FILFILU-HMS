# Filfilu HMS — Database Migration Guide

## Section 2 migration

**Name:** `20261123120000_multi_tenant_foundation`

### What it does (non-destructive)

1. Creates `Facility`, `FacilitySettings`, `FacilitySubscription`, `FacilityMembership`, `Permission`, `RolePermission`.
2. Inserts default facility `fac_filfilu_default` / slug `filfilu-default`.
3. Adds nullable `facilityId` (and related) columns to existing tables.
4. Backfills all existing operational rows + user memberships to the default facility.
5. Sets `NOT NULL` where required; replaces global `Department.name` unique with `(facilityId, name)`.
6. Creates patient extension tables.

### What it does **not** do

- No `DROP TABLE` of business data.
- No `prisma migrate reset`.
- No production seed wipe.

## Apply (development / staging / production)

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

Use `migrate deploy` everywhere except local experimentation with `migrate dev`.

## Rollback considerations

Prisma does not auto-rollback. If you must reverse Section 2:

1. Restore from a Postgres backup taken **before** the migration (preferred).
2. Manual down SQL would drop new tables and columns — **data loss risk** for any rows created only in new facilities; not provided as an automated script.

Always backup before production migrate (`scripts/backup-db.ps1` / `.sh`).

## Existing data preservation

Pre-Section-2 users, patients, appointments, etc. remain and gain `facilityId = fac_filfilu_default`. Memberships are created from legacy `User.role`.

## Demo seed (local only)

```powershell
cd backend
$env:CONFIRM_SEED="YES"
npm run db:seed
```

Creates two facilities (`filfilu-default`, `bole-care-demo`), platform admin, facility admins, cross-membership doctor, sample patients. **Destructive** — blocked in production unless `ALLOW_DESTRUCTIVE_SEED=1`.

## Compatibility notes

- API responses add `facilityId` and `facilities[]` (additive).
- Clients without facility switcher keep working via default membership.
- JWT without `facilityId` is refreshed on next login/`/me` path through middleware resolution.
