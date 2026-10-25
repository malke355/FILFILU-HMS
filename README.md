# Filfilu HMS

Hospital Duty Schedule Management System — **Express API + landing UI** on one port.

## Quick start

```bash
cd backend
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Open **http://127.0.0.1:8080/login** (or `/login.html`).

Demo password for every seeded account: `filfilu`

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
