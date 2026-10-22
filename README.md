# Filfilu HMS — Phase 1 (Frontend)

Demonstration frontend for the **Filfilu Hospital Duty Schedule Management System**.

Phase 1 is **frontend only**: React + TypeScript + Vite + Tailwind + React Router + Lucide + React Hook Form + Zod. There is **no backend**, Prisma, PostgreSQL, or real authentication.

## Live demo

**https://malke355.github.io/FILFILU-HMS/**

Deployed automatically to GitHub Pages on every push to `main`.

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Local dev uses Vite’s root; production builds use `base: '/FILFILU-HMS/'` for project Pages.

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

## Phase 2 boundaries (not in this PR)

- Real API / auth (JWT/OAuth), Prisma, PostgreSQL
- Server-side RBAC and audit logging
- Clinical modules (medical records, pharmacy, billing, EMR)
- Verified hospital contact details or production credentials
- Email/SMS/WhatsApp delivery of notifications

## License

Demonstration project — see repository owners for licensing.
