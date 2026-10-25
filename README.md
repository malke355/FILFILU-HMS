# Filfilu HMS

Hospital Duty Schedule Management System — **Express API + landing UI** on one port.

## Quick start

PostgreSQL is configured only via `backend/.env` (never commit `.env`).

Current working local setup (Docker):

| Setting | Value |
|---------|--------|
| Host | `localhost` |
| Port | `5434` (Windows PostgreSQL already uses `5433`) |
| Database | `hms` |
| User | `postgres` |
| Password | see `backend/.env` (`PGPASSWORD`) |

### 1. Start the database

```bash
cd backend
# Docker Desktop must be running
$env:HMS_PG_PORT=5434
docker compose -f docker-compose.hms.yml up -d
```

### 2. Run the API

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

On startup the app creates tables if missing: `users`, `patients`, `doctors`, `appointments`, `medical_records`, `bills`.

- App: **http://127.0.0.1:8080/login**
- Health: **http://127.0.0.1:8080/api/health**

### pgAdmin

New server → Host `127.0.0.1`, Port **`5434`**, Database `hms`, User `postgres`, Password from `.env`.

| Email | Role |
|-------|------|
| admin@filfilu.com | admin |
| doctor@filfilu.com | doctor |
| nurse@filfilu.com | nurse |
| patient@filfilu.com | patient |

## What’s in this repo

```
backend/   Express + Prisma API (and serves the UI)
landing/   Login, signup, and app pages
```

Google Sign-In and full API docs: [`backend/README.md`](backend/README.md).

## Live static pages

**https://malke355.github.io/FILFILU-HMS/** serves the `landing/` files from GitHub Pages.  
Full login/API (including Google OAuth and the database) runs locally via `backend` on port **8080**.

## License

Demonstration project — see repository owners for licensing.
