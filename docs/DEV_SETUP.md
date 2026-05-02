# HavenStay — Development Setup Guide

This is the canonical guide for running HavenStay locally. Pick the profile that
matches your workflow. All three profiles produce the same result: a working
frontend at **localhost:3000** talking to a Laravel API at **localhost:8000**.

---

## Table of Contents

1. [Profile A — Docker (Recommended)](#profile-a--docker-recommended)
2. [Profile B — Manual (No Docker)](#profile-b--manual-no-docker)
3. [Profile C — Port-Forwarding / Tunnel](#profile-c--port-forwarding--tunnel)
4. [Environment Variable Reference](#environment-variable-reference)
5. [Common Commands Cheat Sheet](#common-commands-cheat-sheet)
6. [Pre-Commit Checklist](#pre-commit-checklist)

---

## Profile A — Docker (Recommended)

Spins up all four containers (primary DB, replica DB, backend, frontend) with hot-reload.
Mirrors the Render + Aiven production topology locally.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (WSL2 backend on Windows)
- Docker Desktop must be **running** (green tray icon)

### Start

```bash
# From project root
docker compose up --build -d
```

**Containers started:**

| Container | Internal port | External port | Role |
|---|---|---|---|
| `havenstay-db-primary` | 3306 | 3306 | Write DB |
| `havenstay-db-replica` | 3306 | 3307 | Read-only replica |
| `havenstay-backend` | 80 | 8000 | Laravel API |
| `havenstay-frontend` | 3000 | 3000 | Next.js app |

### First-time DB init

Run once after the first `docker compose up`:

```bash
docker compose exec backend php artisan migrate:fresh --seed
```

> [!WARNING]
> `migrate:fresh` **wipes all data**. Subsequent container restarts run `php artisan migrate` (safe).

### Access

| Service | URL | Credentials |
|---|---|---|
| Frontend | http://localhost:3000 | admin@havenstay.ph / HavenStay123! |
| Backend health | http://localhost:8000/api/health | — |
| Primary DB | localhost:3306 | root / root |
| Replica DB | localhost:3307 | root / root (read-only) |

### Hot-reload

- **Frontend** — file changes in `./frontend` reflect immediately (Next.js dev + bind mount).
- **Backend** — logic changes in `./backend` reflect on next request (bind mount).

### Simulate production build locally

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

This bakes the frontend into a standalone image and disables hot-reload, matching
the Vercel build output.

---

## Profile B — Manual (No Docker)

Use this when Docker is unavailable or you prefer to manage processes separately.
Requires PHP 8.3+, Composer, Node.js 20+, and a local MySQL 8.4 instance.

### Backend setup

```bash
cd backend
composer install
cp .env.example .env
# Edit .env: set DB_CONNECTION=mysql and all DB_* variables for your local MySQL
php artisan key:generate
php artisan migrate:fresh --seed
php artisan serve          # runs on http://127.0.0.1:8000
```

Minimum `.env` diff from default for MySQL:

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_WRITE_HOST=127.0.0.1
DB_WRITE_PORT=3306
DB_READ_HOST=127.0.0.1
DB_READ_PORT=3306        # Switch to 3307 once replica is healthy
DB_DATABASE=havenstay_db
DB_USERNAME=root
DB_PASSWORD=             # your local root password
```

> See `docs/DISTRIBUTED_DB_SETUP.md` to set up the local Primary-Replica pair.

### Frontend setup

```bash
cd frontend
npm install
cp .env.example .env.local
# .env.local is pre-configured for local dev — no edits needed
npm run dev              # runs on http://localhost:3000
```

### Demo credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@havenstay.ph | HavenStay123! |
| Staff | staff@havenstay.local | HavenStay123! |
| Viewer | viewer@havenstay.local | HavenStay123! |

---

## Profile C — Port-Forwarding / Tunnel

Use this when a **remote browser** needs to reach your local dev server — for
example:

- Testing with Vercel Preview deployments calling a local backend
- TestSprite / Playwright cloud runners
- Testing on a mobile device over the internet

### Tools

| Tool | Free tier | Command |
|---|---|---|
| [ngrok](https://ngrok.com) | 1 static domain, 40 conn/min | `ngrok http 8000` |
| [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) | Unlimited, no account needed for quick tunnels | `cloudflared tunnel --url http://localhost:8000` |

### Zero-Touch Tunneling (New!)

Because the backend is configured to accept wildcard CORS and Sanctum requests for `*.trycloudflare.com` and `*.ngrok-free.app`, you **do not** need to update your `.env` files every time you generate a new tunnel URL.

Here is the fastest way to share your local environment:

**1. Start your local servers**
Make sure Laravel is running on `8000` and Next.js is running on `3000`.

**2. Open ONE tunnel to the frontend**
```bash
cloudflared tunnel --url http://localhost:3000
```

**3. Share the link!**
Send the `https://<random-words>.trycloudflare.com` link to anyone. 

*How it works*: The browser hits the frontend tunnel. Next.js proxies the `/api/*` requests internally to your local Laravel server at `127.0.0.1:8000`. Laravel sees the request came from `*.trycloudflare.com` and automatically allows the CORS and Auth cookies because of the wildcard patterns in `config/cors.php` and `SANCTUM_STATEFUL_DOMAINS`!

> [!NOTE]
> If you are testing webhooks or an external service that needs to hit the backend directly, you will still need to open a second tunnel to `localhost:8000`.

### Tunnel with Docker

If using Docker Compose, run the tunnel on the **host machine** and point it at
the forwarded port (`localhost:3000` for frontend).
The containers publish these ports to the host, so the tunnel sees them correctly.

---

## Environment Variable Reference

### Frontend (`frontend/.env.local`)

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | *(empty)* | Browser-side API base. Empty = same-origin `/api/*` rewrites. Set to an absolute URL only for direct cross-origin calls. |
| `BACKEND_INTERNAL_URL` | `http://127.0.0.1:8000` | Where Next.js server-side rewrites proxy `/api/*`. Set to tunnel URL for remote testing. |
| `ALLOWED_DEV_ORIGINS` | *(empty)* | Comma-separated additional origins for Next.js dev server (no protocol). Add your frontend tunnel host here. |

### Backend (`backend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `FRONTEND_URL` | `http://localhost:3000` | Allowed CORS origin. Must match the browser origin hitting the API. |
| `SANCTUM_STATEFUL_DOMAINS` | `localhost:3000,...` | Domains allowed to send stateful Sanctum requests. Add tunnel domains here. |
| `DB_WRITE_HOST` | `127.0.0.1` | Primary DB host (all writes). |
| `DB_READ_HOST` | `127.0.0.1` | Replica DB host (reads). Set to `127.0.0.1:3307` after replica is healthy. |
| `DB_STICKY` | `true` | Keeps the same connection for a request that writes then reads immediately. |

---

## Common Commands Cheat Sheet

### Docker

```bash
docker compose up -d                              # Start (existing images)
docker compose up --build -d                      # Rebuild and start
docker compose stop                               # Stop containers (data preserved)
docker compose down -v                            # Destroy containers + volumes (full reset)
docker compose logs -f frontend                   # Tail frontend logs
docker compose logs -f backend                    # Tail backend logs
docker compose exec backend php artisan migrate   # Safe migration (no data loss)
docker compose exec backend php artisan migrate:fresh --seed  # Wipe + reseed
docker compose exec backend php artisan config:clear          # Clear config cache
docker compose exec backend php artisan test                  # Run backend tests
```

### Backend (manual)

```bash
cd backend
php artisan serve                  # Dev server on :8000
php artisan migrate                # Run pending migrations
php artisan migrate:fresh --seed   # Wipe + reseed
php artisan config:clear           # Clear config cache
php artisan test                   # All tests (SQLite)
composer test:mysql                # All tests against MySQL
```

### Frontend (manual)

```bash
cd frontend
npm run dev        # Dev server on :3000 (Turbopack)
npm run build      # Production build
npm run lint       # ESLint check
npm run test       # Vitest unit tests
npm run test:e2e   # Playwright E2E (requires running app)
```

---

## Pre-Commit Checklist

**Backend**
- [ ] `php artisan test` — all pass
- [ ] CCR compliance verified if schema changed
- [ ] `AuditService::setAuditUserContext()` called before all transactional writes
- [ ] Both `db/havenstay_schema.sql` and `backend/database/sql/havenstay_schema.sql` updated if schema changed

**Frontend**
- [ ] `npm run lint` — no errors
- [ ] `npm run build` — succeeds
- [ ] All loading states use `Skeleton` components (no spinners)

**Documentation**
- [ ] `CLAUDE.md` (AI context file at project root — not a formal docs artifact) updated if architecture or conventions changed
- [ ] Relevant coding blueprint (`docs/BACKEND_CODING_BLUEPRINT.md` or `docs/FRONTEND_CODING_BLUEPRINT.md`) version-bumped if patterns changed
- [ ] `docs/SDD.md` version bumped if design changed
- [ ] `docs/SRS.md` traceability matrix updated if new features added
