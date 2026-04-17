# HavenStay Boarding House Management System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Laravel](https://img.shields.io/badge/Backend-Laravel%2013-red?logo=laravel)](https://laravel.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black?logo=next.js)](https://nextjs.org)
[![Docker](https://img.shields.io/badge/Infrastructure-Docker-blue?logo=docker)](https://www.docker.com/)

HavenStay is a centralized, high-performance boarding house management system designed for operational efficiency and audit compliance.

### 🚀 Live Environments
*   **Production Application**: [https://havenstay-theta.vercel.app/](https://havenstay-theta.vercel.app/)
*   **Production API**: [https://havenstay-qhun.onrender.com/api/health](https://havenstay-qhun.onrender.com/api/health)

---

## 🛠️ Getting Started (Local Development)

The easiest way to get HavenStay running locally is via **Docker**. This ensures your environment perfectly matches production, including the primary-replica database architecture.

Please follow the **[DOCKER_SETUP.md](./DOCKER_SETUP.md)** guide for a 5-minute installation.

### Legacy Setup (Optional)
If you prefer not to use Docker, see the **[QUICK_START.md](./QUICK_START.md)** for manual installation via Laravel Herd or XAMPP.

**HavenStay** is a high-performance Boarding House Management System (BHMS) designed for property managers who require precision, auditability, and ease of use. It handles the entirely of the tenant lifecycle—from onboarding and contract management to granular billing, payment processing, and operational reporting.

## Key Features

- **Distributed Architecture**: Multi-node database strategy using a **MySQL Primary-Replica** topology on Docker/Render/Aiven, ensuring high availability and read-heavy optimization.
- **Forensic UI/UX**: A professional, high-trust interface using **Structural Skeletons** instead of generic loading spinners, providing instantaneous layout stability and analytical clarity.
- **Forensic Auditing**: Complete row-level audit trail powered by 24 MySQL database triggers.
- **Transaction Reliability**: Robust workflow logging (started, committed, failed) for all financial operations.
- **Relational Integrity**: Strict schema enforcement with foreign keys and multi-table reporting views.
- **Distributed Architecture**: Containerized deployment with Primary-Replica database replication.
- **Role-Based Security**: Fine-grained access control with explicit Authorization Services. Admin, Staff, and Viewer levels, decoupled from generic framework policies for maximum security.
- **Operational Intelligence**: Real-time dashboards and professional CSV reports for occupancy, revenue, and outstanding balances using SQL Joins and Views.

## Technical Architecture

HavenStay is built on a mission-critical stack designed for data integrity and performance.

- **Frontend**: [Next.js 16](https://nextjs.org/) (App Router) + [React 19](https://react.dev/) + [Tailwind CSS](https://tailwindcss.com/) (Forensic UX Standard).
- **Backend**: [Laravel 13](https://laravel.com/) (PHP 8.3+) with a Service-Oriented Architecture and Read/Write DB splitting.
- **Infrastructure**: [Docker](https://www.docker.com/) (Local) | [Render](https://render.com/) (Backend) | [Vercel](https://vercel.com/) (Frontend).
- **Database**: [MySQL 8.4](https://www.mysql.com/) Primary (Read/Write) + MySQL 8.4 Replica (Read-Only).

## Documentation

- [**docs/DATABASE.md**](docs/DATABASE.md): Schema overview, reporting views, and audit triggers.
- [**docs/API_REFERENCE.md**](docs/API_REFERENCE.md): Endpoint listing and authentication guide.
- [**DOCKER_SETUP.md**](DOCKER_SETUP.md): Start the full distributed stack in 5 minutes.
- [**CONTRIBUTING.md**](CONTRIBUTING.md): Guidelines for development standards.

## Demo Credentials (Development)
The local seeder provides the following credentials for evaluation:
- **Admin**: `admin@havenstay.ph` / `HavenStay123!`
- **Staff**: `staff@havenstay.local` / `HavenStay123!`
- **Viewer**: `viewer@havenstay.local` / `HavenStay123!`

---

### Repository Standards

*   **`docs/`**: Technical documentation, SRS, and architecture (SDD).
*   **`backend/`**: Laravel core, API services, and migrations.
*   **`frontend/`**: Next.js source and design tokens.
*   **Forensic UX**: All loading states must use structural Skeletons (`_components/ui/Skeleton.js`).
*   **Data Integrity**: Explicit `DB::transaction()` with `AuditService` context is mandatory for all writes.

---

*HavenStay is released under the [MIT License](LICENSE).*
