# HavenStay — Deployment Guide

Covers production deployment to **Render** (backend) + **Vercel** (frontend)
with **Aiven** as the managed MySQL database.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database — Aiven MySQL](#database--aiven-mysql)
3. [Backend — Render](#backend--render)
4. [Frontend — Vercel](#frontend--vercel)
5. [Environment Variables Reference](#environment-variables-reference)
6. [First-Deploy Sequence](#first-deploy-sequence)
7. [Subsequent Deploys](#subsequent-deploys)
8. [Smoke Test Checklist](#smoke-test-checklist)

---

## Architecture Overview

```
Browser
  └─► Vercel (Next.js)  ──/api/*──►  Render (Laravel API)
                                           │
                                    Aiven MySQL
                                    ├── Primary  (read/write)
                                    └── Replica  (read-only, optional)
```

| Layer | Platform | Plan |
|---|---|---|
| Frontend | [Vercel](https://vercel.com) | Free (Hobby) |
| Backend | [Render](https://render.com) | Free web service (Docker) |
| Database | [Aiven](https://aiven.io) | Free trial / Startup MySQL |

> [!NOTE]
> Render free-tier web services **spin down** after 15 minutes of inactivity.
> The first request after sleep takes ~30 s. Upgrade to a paid plan for
> always-on availability.

---

## Database — Aiven MySQL

### Create the service

1. Log in to [Aiven Console](https://console.aiven.io).
2. **Create service → MySQL → Free trial** (or Startup-4 for production).
3. Choose region **asia-southeast1** (Singapore) to minimize latency with Render.
4. Wait for status to become **Running**.

### Get connection details

In the Aiven service page → **Overview → Connection information**:

| Field | Where to copy |
|---|---|
| Host | `DB_WRITE_HOST` / `DB_READ_HOST` in Render |
| Port | `DB_PORT` |
| Database | `DB_DATABASE` |
| User | `DB_USERNAME` |
| Password | `DB_PASSWORD` |
| SSL CA cert | Download `ca.pem` → paste into `DB_SSL_CA` if required |

### Initialize the schema

Aiven does not run Laravel migrations automatically. Trigger them via Render on
first deploy using `DB_SEED=true` (see [First-Deploy Sequence](#first-deploy-sequence)).

---

## Backend — Render

### Service configuration

Render reads `render.yaml` from the repository root. It defines a single web
service (`havenstay-backend`) that builds the backend Docker image.

If deploying manually via the Render dashboard:

| Field | Value |
|---|---|
| **Name** | `havenstay-backend` |
| **Environment** | Docker |
| **Root directory** | `backend` |
| **Dockerfile path** | `Dockerfile` |
| **Docker target** | `production` |
| **Health check path** | `/api/health` |
| **Region** | Singapore (or nearest to Aiven) |

### Required environment variables (set in Render dashboard)

> [!CAUTION]
> Set these in the Render dashboard → **Environment** tab. Never commit secrets.

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_KEY=                          # Generate: php artisan key:generate --show
APP_URL=https://havenstay-qhun.onrender.com

DB_CONNECTION=mysql
DB_HOST=<aiven-host>
DB_PORT=<aiven-port>
DB_DATABASE=<aiven-db-name>
DB_USERNAME=<aiven-user>
DB_PASSWORD=<aiven-password>

# For Primary-Replica (if Aiven provides a read replica endpoint):
DB_WRITE_HOST=<aiven-primary-host>
DB_WRITE_PORT=<aiven-port>
DB_READ_HOST=<aiven-replica-host>   # Same as primary if no replica
DB_READ_PORT=<aiven-port>
DB_STICKY=true

# CORS — must match your Vercel deployment URL exactly
FRONTEND_URL=https://havenstay-theta.vercel.app

LOG_CHANNEL=errorlog
SESSION_DRIVER=database
CACHE_STORE=database

# First deploy only — set to true to run migrate:fresh --seed, then flip to false
DB_SEED=false
```

### Auto-deploy from GitHub

In Render service settings → **Build & Deploy → Auto-Deploy: Yes**.
Every push to `main` triggers a redeploy.

---

## Frontend — Vercel

### Import project

1. [vercel.com/new](https://vercel.com/new) → Import Git repository → select `havenstay`.
2. **Framework preset**: Next.js (auto-detected).
3. **Root directory**: `frontend`.
4. **Build command**: `npm run build` (default).
5. **Output directory**: `.next` (default — Next.js standalone output is handled automatically).

### Environment variables (set in Vercel dashboard)

> **Settings → Environment Variables → Production** (and optionally Preview/Development).

```dotenv
# Server-side: where Next.js proxies /api/* (must be accessible from Vercel's servers)
BACKEND_INTERNAL_URL=https://havenstay-qhun.onrender.com

# Browser-side: leave empty to use same-origin /api/* rewrites (recommended)
NEXT_PUBLIC_API_BASE_URL=
```

> [!IMPORTANT]
> `BACKEND_INTERNAL_URL` is a **server-side** variable (no `NEXT_PUBLIC_` prefix).
> It is never exposed to the browser. The browser always calls `/api/*` on the
> same Vercel origin — Next.js rewrites it to Render server-to-server.

### Preview deployments

Each PR gets a preview URL (e.g. `https://havenstay-git-feature-xyz.vercel.app`).
These preview deployments also use the production `BACKEND_INTERNAL_URL` unless
you override it per-branch in Vercel's environment variable settings.

---

## Environment Variables Reference

### Backend (Render)

| Variable | Required | Notes |
|---|---|---|
| `APP_KEY` | ✅ | Generate with `php artisan key:generate --show` |
| `APP_ENV` | ✅ | `production` |
| `APP_DEBUG` | ✅ | `false` |
| `APP_URL` | ✅ | Your Render service URL |
| `FRONTEND_URL` | ✅ | Your Vercel deployment URL (for CORS) |
| `DB_CONNECTION` | ✅ | `mysql` |
| `DB_HOST` / `DB_WRITE_HOST` | ✅ | Aiven primary host |
| `DB_READ_HOST` | ✅ | Aiven replica host (or same as primary) |
| `DB_PORT` | ✅ | Aiven port (usually 3306) |
| `DB_DATABASE` | ✅ | Aiven database name |
| `DB_USERNAME` | ✅ | Aiven username |
| `DB_PASSWORD` | ✅ | Aiven password |
| `DB_STICKY` | ✅ | `true` |
| `LOG_CHANNEL` | ✅ | `errorlog` (streams to Render logs) |
| `SESSION_DRIVER` | ✅ | `database` |
| `CACHE_STORE` | ✅ | `database` |
| `DB_SEED` | ⚠️ | `true` first deploy only, then `false` |

### Frontend (Vercel)

| Variable | Required | Notes |
|---|---|---|
| `BACKEND_INTERNAL_URL` | ✅ | Render service URL — server-side only |
| `NEXT_PUBLIC_API_BASE_URL` | ❌ | Leave empty unless doing direct cross-origin calls |

---

## First-Deploy Sequence

Follow this order exactly on initial deployment.

```
1. Create Aiven MySQL service → note all connection credentials
2. Deploy backend on Render:
   a. Set all env vars including DB_SEED=true
   b. Push to main → Render builds & deploys
   c. entrypoint.sh runs: migrate:fresh --seed
   d. Check /api/health → 200 OK
   e. Change DB_SEED=false in Render env vars → Save (triggers redeploy)
3. Deploy frontend on Vercel:
   a. Import repo, set BACKEND_INTERNAL_URL to Render URL
   b. Deploy → Vercel builds Next.js standalone
   c. Visit production URL → login with admin@havenstay.ph
4. Verify smoke tests (see below)
```

---

## Subsequent Deploys

### Backend (Render)

Push to `main`. Render auto-rebuilds the Docker image and runs `entrypoint.sh`,
which calls `php artisan migrate` (safe — no data loss) unless `DB_SEED=true`.

```bash
git push origin main   # triggers Render auto-deploy
```

To force a manual deploy without a code push:
**Render dashboard → Manual Deploy → Deploy latest commit**.

### Frontend (Vercel)

Push to `main`. Vercel auto-deploys and invalidates edge cache.

```bash
git push origin main   # triggers Vercel auto-deploy
```

---

## Smoke Test Checklist

After every production deployment:

| Check | Method | Expected |
|---|---|---|
| Backend health | `GET /api/health` | `200 OK` |
| Login | `POST /api/auth/login` | Valid Sanctum token |
| Dashboard loads | Visit `/dashboard` in browser | No 5xx, skeletons resolve |
| Replica reads | Dashboard KPIs display | Data visible (not empty) |
| Write operation | Create a test tenant | Saved successfully, audit log entry created |
