# Filfilu HMS — Phase 2 Backend

Express + TypeScript + Prisma + SQLite API with JWT auth and server-side RBAC/RLS.

## Quick start

```bash
cd backend
cp .env.example .env   # if needed
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

API: **http://127.0.0.1:4000**

Demo password for all seeded users: `filfilu`

| Email | Role |
|-------|------|
| admin@filfilu.com | admin |
| doctor@filfilu.com | doctor |
| nurse@filfilu.com | nurse |
| patient@filfilu.com | patient |

## Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/health` | — | Health check |
| POST | `/api/auth/login` | — | `{ email, password, role? }` → JWT |
| POST | `/api/auth/signup` | — | Create account + JWT |
| GET | `/api/auth/me` | Bearer | Current user + permissions |
| GET | `/api/auth/demo-accounts` | — | Demo credentials list |
| GET | `/api/doctors` | optional | Public doctor directory |
| GET | `/api/doctor-schedules` | Bearer | Clinic slots (patient/admin) |
| GET | `/api/departments` | — | Active departments |
| GET | `/api/specialties` | — | Specialty list |
| POST | `/api/contact` | — | Contact form |
| POST | `/api/bookings` | — | Landing booking request |
| GET | `/api/staff` | Bearer | RLS by role |
| GET | `/api/patients` | Bearer | RLS by role |
| GET | `/api/appointments` | Bearer | RLS by role |
| POST | `/api/appointments` | Bearer | Request / create visit |
| GET | `/api/shifts` | Bearer | Duty roster |
| PATCH | `/api/shifts/:id/publish` | admin | Publish shift |
| GET | `/api/exchanges` | Bearer | Shift swaps |
| PATCH | `/api/exchanges/:id` | Bearer | Update swap status |
| GET | `/api/notifications` | Bearer | Role/user alerts |
| GET | `/api/dashboard/stats` | Bearer | Role KPI cards |
| GET | `/api/reports/summary` | admin | Report totals |
| GET | `/api/activity` | Bearer | Recent audit activity |
| POST | `/api/exchanges` | staff | Request shift swap |
| POST | `/api/exchanges/approve-pending` | admin | Approve all pending swaps |
| POST | `/api/shifts/publish-drafts` | admin | Publish all draft shifts |
| PATCH | `/api/appointments/:id` | Bearer | Update appointment status |

## Product frontend

The real product UI is the landing app:

- http://127.0.0.1:8080/login.html
- Workspace: `landing/app.html` (JWT session required)

```bash
# terminal 1
cd backend && npm run dev

# terminal 2
cd landing && python3 -m http.server 8080 --bind 0.0.0.0
```

## CORS

`.env` `CORS_ORIGIN` allows landing (`:8080`) and Vite (`:5173`).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | tsx watch on `:4000` |
| `npm run build` / `start` | Compile + run `dist` |
| `npm run db:push` | Sync Prisma schema to SQLite |
| `npm run db:seed` | Load demo data |
| `npm run db:reset` | Wipe DB + reseed |
