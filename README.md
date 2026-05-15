# HavenStay BHMS

A web-based Boarding House Management System built for bed-level occupancy tracking, lease lifecycle management, and metered utility billing. The database layer enforces a 45-trigger forensic audit engine so every data change is permanently attributed to a user and workflow.

![HavenStay Dashboard Mockup](assets/havenstay_dashboard.png)

[![Backend](https://img.shields.io/badge/Laravel-13-red)](https://laravel.com)
[![Frontend](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![Infrastructure](https://img.shields.io/badge/Docker-Compose-blue)](https://www.docker.com/)
[![Audit](https://img.shields.io/badge/Forensics-Trigger--Based-teal)](docs/DATABASE.md)

---

## Quick Start (Docker)

1.  **Clone & enter**
    ```bash
    git clone https://github.com/markalvincadangin/havenstay.git
    cd havenstay
    ```

2.  **Spin up containers**
    ```bash
    docker compose up --build -d
    ```

3.  **Seed the database** (first time only)
    ```bash
    docker compose exec backend php artisan migrate:fresh --seed
    ```

4.  **Open in browser**
    - Frontend — [http://localhost:3000](http://localhost:3000)
    - API health check — [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## Demo Accounts

After seeding, you can log in with any of these:

| Role | Email | Password |
| :--- | :--- | :--- |
| Admin | `havenstay.admin@havenstay.com` | `HavenStay123!` |
| Staff | `havenstay.staff@havenstay.com` | `HavenStay123!` |
| Viewer | `viewer@havenstay.com` | `HavenStay123!` |

---

## Documentation

Everything lives in `docs/`. Here's what's there:

**Specifications**
- [Business Rules](docs/BUSINESS_RULES.md) — the actual logic the system enforces
- [SRS](docs/SRS.md) — functional and non-functional requirements
- [SDD](docs/SDD.md) — architecture, data flow, component design
- [Database](docs/DATABASE.md) — schema, triggers, views, and ERD

**Developer Guides**
- [Dev Setup](docs/DEV_SETUP.md) — Docker, manual install, and tunnel profiles
- [API Reference](docs/API_REFERENCE.md) — every endpoint, request/response shapes
- [Backend Blueprint](docs/BACKEND_CODING_BLUEPRINT.md) — Laravel conventions
- [Frontend Blueprint](docs/FRONTEND_CODING_BLUEPRINT.md) — Next.js conventions

**Operations**
- [Deployment](docs/DEPLOYMENT.md) — Render + Vercel + Aiven production setup
- [Runbook](docs/OPERATIONS_RUNBOOK.md) — maintenance and temporal logic

---

## Architecture

The system is split into three layers:

- **Backend** — Laravel 13 (PHP 8.3+), MySQL 8.4 with Primary-Replica replication
- **Frontend** — Next.js 16 (App Router), React 19, Tailwind CSS v4
- **Audit** — 45 database triggers on the MySQL primary for row-level change tracking
