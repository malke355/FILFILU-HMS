# Filfilu HMS

Hospital Duty Schedule Management System — **Express API + landing UI** on one port.

The product is the Express app in `backend/` (serves `landing/` and `/api`).  
GitHub Pages is an optional **static brochure** only — login/booking need the API host.

## Quick start

PostgreSQL is configured only via `backend/.env` (never commit `.env`).

| Setting | Value |
|---------|--------|
| Host | `127.0.0.1` (loopback only) |
| Port | `5434` |
| Database | `hms` |
| App user | `filfilu` (not the postgres superuser) |
| Passwords | see `backend/.env` |

### 1. Start the database

```bash
cd backend
$env:HMS_PG_PORT=5434
docker compose -f docker-compose.hms.yml --env-file .env up -d
```

### 2. Migrate, seed (optional), run

```bash
npm install
npm run db:generate
npm run db:deploy
# Destructive demo seed (wipes tables) — local only:
$env:CONFIRM_SEED="YES"; npm run db:seed
npm run dev
```

Schema changes go through **Prisma migrations** (`npm run db:migrate` locally, `npm run db:deploy` everywhere else). Runtime `CREATE TABLE` dual-schema is removed.

- App: **http://127.0.0.1:8080/login**
- Health: **http://127.0.0.1:8080/api/health**

After a local demo seed (never for production), sample logins use password `filfilu`:

| Email | Role |
|-------|------|
| admin@filfilu.com | admin |
| doctor@filfilu.com | doctor |
| nurse@filfilu.com | nurse |
| patient@filfilu.com | patient |

## What’s in this repo

```
backend/   Express + Prisma API (serves the UI)
landing/   Login, signup, and app pages
```

## GitHub Pages

**https://malke355.github.io/FILFILU-HMS/** may publish `landing/` as static files.  
That host has **no** Postgres/API unless you set repository variable `FILFILU_API_BASE` to a real HTTPS API and configure `CORS_ORIGIN` on that API.

## License

Demonstration project — see repository owners for licensing.
