# HavenStay — Docker Development Guide

**Version:** 1.0
**Last Updated:** June 26, 2026

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Quick Start](#2-quick-start)
3. [Makefile Command Reference](#3-makefile-command-reference)
4. [Override File](#4-override-file)
5. [Primary/Replica Topology](#5-primaryreplica-topology)
6. [Troubleshooting](#6-troubleshooting)
7. [Hybrid Dev Mode (Native Ubuntu)](#7-hybrid-dev-mode-native-ubuntu)

---

## 1. Prerequisites

- **Docker Desktop** (v4.x+) with Docker Compose v2
- **WSL2** (Windows only) — recommended for bind mount performance
- **Make** — pre-installed on Linux/macOS; on Windows use WSL2 or `choco install make`

## 2. Quick Start

```bash
# 1. Clone and enter
git clone https://github.com/markalvincadangin/havenstay.git
cd havenstay

# 2. Create environment files from templates
cp .env.example .env                  # Root orchestrator vars (Docker Compose, passwords, host ports)
cp backend/.env.example backend/.env  # Laravel-specific app vars (APP_KEY, logging, mail config)
#    ⚠ Edit .env and change all 'changeme_*' passwords

# 3. Enable local hot-reloading (optional but recommended)
cp docker-compose.override.yml.example docker-compose.override.yml

# 4. Start all services
make up

# 5. Verify
make logs
```

| Service | URL |
|:---|:---|
| Frontend | [http://localhost:3000](http://localhost:3000) |
| Backend API | [http://localhost:8000/api/health](http://localhost:8000/api/health) |
| MySQL Primary | `localhost:3306` |
| MySQL Replica | `localhost:3307` |

## 3. Makefile Command Reference

All team members should use `make` commands instead of raw `docker compose` to ensure consistent flags and behavior.

| Command | Description |
|:---|:---|
| `make up` | Start all containers in detached mode |
| `make down` | Stop and remove containers |
| `make build` | Rebuild all images from scratch (no cache) |
| `make logs` | Follow live logs from all services |
| `make clean` | Stop containers, remove volumes, and prune unused Docker resources |
| `make config` | Render and validate the merged `docker-compose` configuration |
| `make test-backend` | Run `php artisan test` inside the backend container |
| `make test-frontend` | Run `npm test` inside the frontend container |

## 4. Override File

The project uses Docker Compose's [override mechanism](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/) to separate stable infrastructure from local development tweaks.

| File | Committed | Purpose |
|:---|:---|:---|
| `docker-compose.yml` | ✅ Yes | Base config — services, ports, healthchecks, dependencies |
| `docker-compose.override.yml` | ❌ No (gitignored) | Local dev — bind mounts, hot-reload polling |
| `docker-compose.prod.yml` | ✅ Yes | Production overrides — optimized build targets |

**How it works:** Docker Compose automatically merges `docker-compose.override.yml` on top of `docker-compose.yml` when you run any `docker compose` command. No extra flags needed.
- **Backend**: Set `APP_ENV=local` inside `docker-compose.yml`.
- **Frontend**: The `frontend/Dockerfile` was optimized for native Linux. Note that WSL2/Windows users may need to manually re-add `ENV WATCHPACK_POLLING=true` if hot-reloading fails, but for Native Linux this is omitted to drastically save CPU.

**To customize:** Copy the example and edit as needed:
```bash
cp docker-compose.override.yml.example docker-compose.override.yml
```

## 5. Primary/Replica Topology

> ⚠ **Do not remove the `db-primary` and `db-replica` services from `docker-compose.yml`.**

The primary/replica MySQL architecture is a core design feature of the application. It is intentionally part of the base compose file — not an optional override — so that the topology is always present and demonstrable.

**How it works:**
- The **Primary** (`db-primary`, port 3306) handles all write operations.
- The **Replica** (`db-replica`, port 3307) receives changes via GTID-based replication and handles read queries.
- Laravel's read/write split in `config/database.php` routes `SELECT` queries to `DB_READ_HOST` (the replica) and writes to `DB_WRITE_HOST` (the primary).

**CI vs Manual Verification:**
- **CI (`smart-build.yml`)** verifies topology *presence* — `make config` confirms both database services render correctly in the compose output.
- **Replication *behavior*** (data flowing from primary → replica, `Replica_IO_Running: Yes`) is verified **manually/locally** per the steps in `docs/DISTRIBUTED_DB_SETUP.md`. This is a deliberate scope boundary: fast CI tests run against SQLite for speed, while the full replication demonstration is a local/demo exercise.

For detailed setup instructions, see [docs/DISTRIBUTED_DB_SETUP.md](docs/DISTRIBUTED_DB_SETUP.md).

## 6. Troubleshooting

### Port Conflicts

If `make up` fails with "address already in use":
```bash
# Check what's using the port
lsof -i :3306  # or :3307, :8000, :3000

# Stop the conflicting process, or change the port mapping in docker-compose.override.yml
```

### WSL2 File Watching / High CPU

If hot-reload causes high CPU usage, your project is likely on the Windows filesystem (`/mnt/c/...`). Move it to the native WSL2 filesystem:
```bash
# Move to WSL2 native path (much faster I/O)
mv /mnt/c/projects/havenstay ~/projects/havenstay
```

Then disable polling in your `docker-compose.override.yml`:
```yaml
environment:
  - WATCHPACK_POLLING=false
  - CHOKIDAR_USEPOLLING=false
```

### Replica Lag / Replication Errors

If the replica falls behind or shows `Error 1236`:
1. Check replication status: `docker compose exec db-replica mysql -uroot -p -e "SHOW REPLICA STATUS\G"`
2. If binary logs are purged, follow the recovery steps in [docs/DISTRIBUTED_DB_SETUP.md § Troubleshooting](docs/DISTRIBUTED_DB_SETUP.md#6-troubleshooting-error-1236).

### Backend Won't Start (Database Connection Timeout)

The backend entrypoint waits up to 60 seconds for the database. If it times out:
```bash
# Check if the database is actually healthy
docker compose ps
make logs
```

## 7. Hybrid Dev Mode (Native Ubuntu)

For faster local iteration without Docker filesystem overhead, you can run only the databases in Docker and run the Laravel backend and Next.js frontend natively.

> [!IMPORTANT]
> This mode is for **development speed only**. The full containerized setup (`make up`) remains the authoritative source of truth for full environment parity and CI testing.

### Setup

1. Configure your `.env` for native development:
   ```bash
   make env-native
   # Ensures backend/.env expects the DB at 127.0.0.1:3306 and 3307
   ```

2. Start only the databases:
   ```bash
   make db-up
   ```

3. Run the development servers in separate terminals:
   ```bash
   make dev-backend
   make dev-frontend
   ```

### Switching Back to Full-Container Mode

If you need to verify the full distributed setup before pushing code:

1. Stop hybrid servers and reset your `.env`:
   ```bash
   make db-down
   make env-docker
   # Points the backend/.env back to `db-primary` and `db-replica` hostnames
   ```

2. Start the full cluster:
   ```bash
   make up
   ```

---

*Document Author: HavenStay Infrastructure*
