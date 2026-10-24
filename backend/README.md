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

App: **http://127.0.0.1:8080/login.html** (UI and `/api` on the same port)

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

The API serves the landing pages. One process is the whole product:

- http://127.0.0.1:8080/login.html
- Workspace: http://127.0.0.1:8080/app.html (JWT session required)
- Health: http://127.0.0.1:8080/api/health

## CORS

`.env` `CORS_ORIGIN` allows landing (`:8080`) and Vite (`:5173`).

## Google Sign-In (OAuth 2.0 / OpenID Connect)

Uses the existing **Sign in with Google** button on `landing/login.html`. Stack: **Express + Prisma + landing HTML** (not Flutter/Django).

### 1. Google Cloud Console

1. Create (or open) a project at [Google Cloud Console](https://console.cloud.google.com/).
2. **APIs & Services → OAuth consent screen** → configure External (or Internal) app.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
4. Register these **Authorized redirect URIs** exactly:

```
http://127.0.0.1:4000/api/auth/google/callback
http://localhost:4000/api/auth/google/callback
```

5. (Optional) Authorized JavaScript origins:

```
http://127.0.0.1:8080
http://localhost:8080
```

6. Copy the Client ID and Client Secret into `backend/.env`.

### 2. Backend env

```bash
cd backend
cp .env.example .env   # if needed
```

Set:

```env
FRONTEND_ORIGIN="http://127.0.0.1:8080"
GOOGLE_CLIENT_ID="....apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="...."
GOOGLE_REDIRECT_URI="http://127.0.0.1:4000/api/auth/google/callback"
```

Then:

```bash
npm install
npx prisma db push
npm run dev
```

### 3. Flow

1. User clicks **Sign in with Google** → browser goes to `GET /api/auth/google`.
2. Google shows its account chooser (`openid email profile` only).
3. Callback `GET /api/auth/google/callback` exchanges the code, verifies the **ID token** with `google-auth-library` (signature, audience, expiry), requires `email_verified`, upserts the user by Google `sub`, and sets an **httpOnly** `filfilu_token` cookie.
4. Redirect to workspace: `http://127.0.0.1:8080/app.html` (Filfilu dashboard).
5. Failures / cancel redirect to `login.html?error=...`.
6. Logout: `POST /api/auth/logout` (or `GET /api/auth/logout`) clears the cookie.

Protected API routes accept either the session cookie or `Authorization: Bearer <jwt>`.

### 4. Local test checklist

1. Start API (`:4000`) and landing (`:8080`).
2. Open http://127.0.0.1:8080/login.html
3. Click **Sign in with Google** → pick an account.
4. You should land on `app.html` as a **patient** workspace (new Google users).
5. Click **Sign out** → cookie cleared, back to login.
6. Cancel on Google’s screen → login shows a clear error message.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | tsx watch on `:8080` (UI + API) |
| `npm run build` / `start` | Compile + run `dist` |
| `npm run db:push` | Sync Prisma schema to SQLite |
| `npm run db:seed` | Load demo data |
| `npm run db:reset` | Wipe DB + reseed |
