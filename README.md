# Filfilu HMS

Hospital Duty Schedule Management System — **Express API + landing UI** on one port.

## Quick start

PostgreSQL connection is read from `backend/.env` (never commit `.env`):

- Host `localhost`, port `5433`, database `hms`, user `postgres`

### 1. Start the database

**Option A — Docker (recommended if Windows Postgres password is unknown):**

1. Stop Windows service **postgresql-x64-18** (Services app) so port **5433** is free.
2. Start Docker Desktop, then:

```bash
cd backend
docker compose -f docker-compose.hms.yml up -d
```

**Option B — Windows PostgreSQL 18:** set the `postgres` user password to match `.env`, create database `hms`, keep service running on port 5433.

### 2. Run the API

```bash
cd backend
npm install
npm run dev
```

On startup the app creates tables if missing: `users`, `patients`, `doctors`, `appointments`, `medical_records`, `bills`.

Open **http://127.0.0.1:8080/login** · health: **http://127.0.0.1:8080/api/health**

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
