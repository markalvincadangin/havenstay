# HavenStay BHMS — Docker Engineering & Operations Guide

**Infrastructure Reference for Contributors & Technical Reviewers**  
*Covers Multi-Container Orchestration, GTID Replication, Multi-Stage Builds, and Operations*

---

## Table of Contents

1. [Prerequisites & System Architecture](#1-prerequisites--system-architecture)
2. [Quick Start (One-Command Onboarding)](#2-quick-start-one-command-onboarding)
3. [Environment Configuration Reference](#3-environment-configuration-reference)
4. [Makefile Command Reference](#4-makefile-command-reference)
5. [Scripts & Tooling Architecture (`scripts/`)](#5-scripts--tooling-architecture-scripts)
6. [Development vs. Production Topology](#6-development-vs-production-topology)
7. [MySQL 8.4 Primary/Replica GTID Replication](#7-mysql-84-primaryreplica-gtid-replication)
8. [Automated Smoke Tests & Verification](#8-automated-smoke-tests--verification)
9. [Troubleshooting & Diagnostics](#9-troubleshooting--diagnostics)
10. [Hybrid Dev Mode (Optional Native Run)](#10-hybrid-dev-mode-optional-native-run)

---

## 1. Prerequisites & System Architecture

- **Docker Engine** (v24.x+) & **Docker Compose v2** (included with Docker Desktop)
- **Make** (pre-installed on Linux/macOS; on Windows use WSL2 or `choco install make`)
- Minimum recommended hardware: 4 GB available RAM, 10 GB disk space

### Container Topology
```
┌────────────────────────────────────────────────────────────────────────┐
│                        Docker Bridge Network                           │
│                                                                        │
│   havenstay-frontend (Next.js 16 SPA, Port 3000)                       │
│           │                                                            │
│           ▼ (Reverse Proxy rewrite: /api/*)                            │
│   havenstay-backend (Laravel 13 API, Port 8000, PHP 8.4, Apache)       │
│           │                                                            │
│     ┌─────┴────────────────────────┐                                   │
│     ▼ (Writes & Mutations)         ▼ (Read Queries)                    │
│   havenstay-db-primary           havenstay-db-replica                  │
│   (MySQL 8.4, Port 3306)  ─────► (MySQL 8.4, Port 3307)                │
│   [45 Forensic Triggers]  GTID   [Read-Only Replica Node]              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Quick Start (One-Command Onboarding)

```bash
# 1. Clone repository
git clone https://github.com/markalvincadangin/havenstay.git
cd havenstay

# 2. Automated setup (creates .env from templates, verifies tools, builds & starts stack)
./scripts/setup.sh
# Alternatively: make setup && make up

# 3. Verify health & replication
make smoke-test
```

### Service Access Table
| Service | Local URL | Container Target | Healthcheck |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | [http://localhost:3000](http://localhost:3000) | `development` (Hot-Reload) | `wget http://127.0.0.1:3000` |
| **Backend API** | [http://localhost:8000/api/health](http://localhost:8000/api/health) | `development` (Apache/PHP 8.4) | `curl http://127.0.0.1/api/health` |
| **MySQL Primary** | `localhost:3306` | MySQL 8.4 (GTID Binlog ON) | `mysqladmin ping` |
| **MySQL Replica** | `localhost:3307` | MySQL 8.4 (Read-Only) | `mysqladmin ping` |

---

## 3. Environment Configuration Reference

The repository maintains standardized `.env.example` templates:

| File | Scope | Description |
| :--- | :--- | :--- |
| `.env` (root) | Docker Compose Orchestration | Global service ports, DB passwords, shared network config |
| `backend/.env` | Laravel Application Config | App key, DB host routing (`db-primary` vs `db-replica`), log drivers |
| `frontend/.env.local` | Next.js Client Overrides | Optional tunnel dev origins (`ALLOWED_DEV_ORIGINS`) |

To reset configs to the Docker standard:
```bash
make setup
```

---

## 4. Makefile Command Reference

All daily development workflows are standardized through `make`:

```bash
make help  # Displays formatted color-coded command menu
```

| Command | Action | Execution Target |
| :--- | :--- | :--- |
| `make setup` | Initialize `.env` and `backend/.env` from templates | Local host |
| `make up` | Start development stack in detached mode | Docker Compose |
| `make down` | Stop and remove development containers | Docker Compose |
| `make restart` | Gracefully restart running containers | Docker Compose |
| `make build` | Rebuild images from scratch (no cache) | Docker Compose |
| `make logs` | Follow aggregated real-time container logs | Docker Compose |
| `make ps` | Inspect running container health statuses | Docker Compose |
| `make clean` | Stop containers, remove named volumes, prune caches | Docker Compose |
| `make smoke-test` | Execute automated 6-point verification suite | `./scripts/smoke-test.sh` |
| `make test` | Run both backend (PHPUnit) and frontend (Vitest) suites | Container internal |
| `make test-backend` | Run backend test suite with in-memory SQLite parity | Backend container |
| `make test-frontend`| Run frontend Vitest suite (JSDOM environment) | Frontend container |
| `make format` | Code formatting with Laravel Pint and Prettier | Container internal |
| `make lint` | Static analysis with PHPStan and ESLint | Container internal |
| `make refresh` | Destructive wipe, re-migrate, and seed demo records | `./scripts/refresh.sh` |
| `make share` | Launch secure Cloudflare Tunnel for live remote demo | `./scripts/share.sh` |
| `make prod-up` | Launch standalone isolated production cluster | `docker-compose.prod.yml` |
| `make prod-down` | Stop and tear down production cluster | `docker-compose.prod.yml` |

---

## 5. Scripts & Tooling Architecture (`scripts/`)

All automation scripts are centralized in `scripts/` with backward-compatible wrappers in the project root:

```
scripts/
├── setup.sh       # Automated zero-friction onboarding script
├── smoke-test.sh  # Comprehensive 6-point endpoint and replication test
├── refresh.sh     # Database purge and demo seeding with replica-bypass
└── share.sh       # Cloudflare Tunnel for live portfolio demonstration
```

---

## 6. Development vs. Production Topology

HavenStay provides two fully distinct, purpose-built compose specifications:

### 6.1 Development (`docker-compose.yml`)
- **Target**: `target: development`
- **Hot-Reloading**: Source code bind-mounted (`./backend:/var/www/html`, `./frontend:/app`).
- **Cache Isolation**: Anonymous volumes `/app/node_modules`, `/app/.next`, and `/var/www/html/vendor` protect container dependencies from host filesystem conflicts.
- **Developer Tolerances**: MySQL buffer pool tuned for WSL2/Docker memory efficiency.

### 6.2 Production (`docker-compose.prod.yml`)
- **Target**: `target: production` (Backend) & `target: runner` (Frontend).
- **Zero Bind Mounts**: Images are 100% self-contained and immutable.
- **Unprivileged Security**: Frontend runs as non-root `nextjs:nodejs` (UID 1001).
- **OPcache Enabled**: Production PHP OPcache active with precompiled opcode caching.
- **Isolated Storage**: Uses dedicated production volumes (`prod-db-primary-data`, `prod-db-replica-data`).

To launch production locally:
```bash
make prod-up
```

---

## 7. MySQL 8.4 Primary/Replica GTID Replication

### 7.1 Replication Architecture
1. **Primary (`db-primary`)**:
   - `server-id=1`, `log-bin=mysql-bin`, `gtid-mode=ON`, `enforce-gtid-consistency=ON`.
   - Provisions `replica_user` with modern `caching_sha2_password` authentication via `docker/primary-init.sql`.
2. **Replica (`db-replica`)**:
   - `server-id=2`, `read-only=ON`, `relay-log-recovery=ON`.
   - Auto-connects to `db-primary` using GTID auto-positioning via `docker/replica-init.sql`.
3. **Application Routing**:
   - Laravel routes `SELECT` statements to `DB_READ_HOST` (`db-replica`, port 3307).
   - Laravel routes mutations/writes to `DB_WRITE_HOST` (`db-primary`, port 3306).
   - `DB_STICKY=true` guarantees that read-after-write requests in the same request lifecycle read from the primary.

### 7.2 Inspecting Live Replication
```bash
docker compose exec db-replica mysql -uroot -pchangeme_root_password -e "SHOW REPLICA STATUS\G"
```

Expected output:
```
Replica_IO_Running: Yes
Replica_SQL_Running: Yes
Seconds_Behind_Source: 0
```

---

## 8. Automated Smoke Tests & Verification

Verify the entire multi-container environment with one command:

```bash
make smoke-test
```

Output:
```
======================================================
🧪 HavenStay BHMS — Production & Dev Smoke Tests
======================================================

  [PASS] Backend API Direct Health (http://127.0.0.1:8000/api/health -> 200 OK)
  [PASS] Frontend Next.js Server (http://127.0.0.1:3000 -> 200 OK)
  [PASS] Next.js API Rewrite Proxy (http://127.0.0.1:3000/api/health -> proxied successfully)
  [PASS] MySQL Primary Connectivity (Port 3306 mysqld alive)
  [PASS] MySQL Replica Connectivity (Port 3307 mysqld alive)
  [PASS] MySQL GTID Replication (IO: Yes, SQL: Yes, Lag: 0s)

------------------------------------------------------
Total Tests: 6 | Passed: 6 | Failed: 0
------------------------------------------------------
```

---

## 9. Troubleshooting & Diagnostics

### 9.1 Port Conflicts (3306, 3307, 8000, 3000)
If local MySQL or web servers occupy standard ports, override ports in `.env`:
```dotenv
FRONTEND_PORT=3001
BACKEND_PORT=8001
DB_PORT=3308
DB_REPLICA_PORT=3309
```
Then run `docker compose up -d`.

### 9.2 WSL2 / Windows High CPU File Watching
If hot-reload causes high CPU on Windows, ensure the project lives in native WSL2 (`~/projects/havenstay`, not `/mnt/c/...`). Optionally enable polling in `docker-compose.override.yml`:
```yaml
services:
  frontend:
    environment:
      - WATCHPACK_POLLING=true
```

### 9.3 Permissions on Storage / Logs
The entrypoint (`backend/docker-entrypoint.sh`) automatically enforces `www-data` ownership on `storage` and `bootstrap/cache` at container startup. If host file editing causes permission issues:
```bash
docker compose exec backend chown -R www-data:www-data storage bootstrap/cache
```

---

## 10. Hybrid Dev Mode (Optional Native Run)

If you prefer running PHP and Next.js directly on your host machine while keeping MySQL in Docker:

```bash
# 1. Switch backend environment to native ports (127.0.0.1:3306 and 3307)
make env-native

# 2. Start only databases
make db-up

# 3. Launch native servers in separate terminals
make dev-backend
make dev-frontend
```

To switch back to full container mode:
```bash
make db-down
make env-docker
make up
```
