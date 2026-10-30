# Filfilu HMS

Demonstration **Hospital Duty Schedule Management System**.

- **Phase 1** — React + Vite frontend (`src/`) and premium landing (`landing/`)
- **Phase 2** — NestJS + Prisma + SQLite API with JWT auth and RBAC/RLS (`backend/`)

## Live demo

**https://malke355.github.io/FILFILU-HMS/**

Deployed automatically to GitHub Pages on every push to `main`.

## Quick start

The product UI and API are one server on port **8080**.

```bash
cd backend
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Open **http://127.0.0.1:8080/login.html**. Demo password for every seeded account: `filfilu`.

The Phase 1 Vite UI is separate: from the repo root, `npm install` then `npm run dev` (usually http://localhost:5173).

### Other scripts

| Command | Purpose |
|---------|---------|
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | TypeScript project build check |
| `npm run lint` | Oxlint on `src` |
| `npm test` | Vitest (schedule, directory, exchange, demo login) |

## Demo roles

Use the amber **Demonstration mode** banner (or `/login`) to switch:

- **Admin** — staff, departments/shifts, duty schedule, reports, exchange approval
- **Doctor / Nurse** — personal schedule, shift exchanges, notifications
- **Patient** — dashboard, saved doctors, notifications, profile

Public visitors can browse **Find a Doctor** and **Doctors on Duty** without signing in.

> Role switching is **not security**. It is an in-browser demo.

## What Phase 1 includes

- Navy/teal healthcare UI, responsive shell, demo banner
- Public homepage + published doctor directory (drafts never public)
- Doctors on Duty with schedule disclaimer; nurse schedules private by default
- Staff management, departments & shift types (including overnight)
- Duty schedule day/week/month with draft/publish and conflict warnings
- Shift exchange workflow: request → peer accept/reject → admin approve/deny
- Notifications persisted via typed services + `localStorage`
- Role dashboards and admin CSV export

## Architecture

```
src/
  app/            # router, role guards
  components/     # ui + layout
  features/       # auth and feature modules
  pages/          # route screens
  services/       # typed mock services (Phase-2 replaceable)
  types/          # shared domain types
  data/           # seed demonstration data
```

Components do **not** mutate global mock arrays; all reads/writes go through services.

## Full-stack product (landing + API)

**Product UI:** http://127.0.0.1:8080/login.html

`npm run dev` inside `backend/` serves the landing pages and `/api` on that same port. Login calls `/api` on the page’s own host, so a second terminal is not required. See [`backend/README.md`](backend/README.md).

Still out of scope for later: PostgreSQL RLS, EMR/billing modules, email/SMS delivery.

## License

Demonstration project — see repository owners for licensing.
