# Filfilu HMS

Hospital Duty Schedule Management System — **NestJS process + landing UI** on one port.

The product is the app in `backend/` (serves `landing/` and `/api`). NestJS listens; the existing route handlers keep PostgreSQL, cookie sessions, Google sign-in, and password reset.  
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

## Static frontend deploy (Vercel / GitHub Pages)

The brochure UI is in `landing/`. Root `vercel.json` builds that folder into `deploy-static/` so hosts do **not** 404 on an empty app root.

**Vercel:** Import the GitHub repo → Deploy (leave Root Directory empty / `.`).  
Do **not** set Root Directory to `backend`. After deploy, open `/` or `/login`.

**GitHub Pages:** **https://malke355.github.io/FILFILU-HMS/** (Actions workflow uploads `landing/`).

Static hosts have **no** Postgres/API unless you set `FILFILU_API_BASE` to a real HTTPS API and configure `CORS_ORIGIN` on that API. Full login needs the `backend` deployed separately.

## License

Demonstration project — see repository owners for licensing.
