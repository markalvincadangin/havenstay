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

- **Tenant Lifecycle Management**: Seamless journey from onboarding to move-out, including contract automation.
- **Granular Financial Control**: Multi-line billing items (Rent, Utilities, Adjustments) with integrated payment tracking and receipting.
- **High-Trust Audit Compliance**: Core tables use 24 dedicated `AFTER` triggers (eight entities × insert/update/delete) writing to `audit_logs`, plus application-level `AuditService` and `transaction_logs` for workflows.
- **Enterprise RBAC**: Rigid Role-Based Access Control implementing **Admin**, **Staff**, and **Viewer** levels, decoupled from generic framework policies for maximum security.
- **Operational Intelligence**: Real-time dashboards and professional CSV reports for occupancy, revenue, and outstanding balances.

## Technical Architecture

HavenStay is built on a modern, decoupled architecture designed for stability and scalability.

- **Frontend**: [Next.js 16](https://nextjs.org/) (App Router) + [React 19](https://react.dev/) + [Tailwind CSS](https://tailwindcss.com/).
- **Backend**: [Laravel 13](https://laravel.com/) (PHP 8.3+) with a RESTful Service-oriented architecture.
- **Security**: [Laravel Sanctum](https://laravel.com/docs/sanctum) for API authentication.
- **Database**: [MySQL 8.4](https://www.mysql.com/) (Authoritative Schema with Views and Audit Triggers).

## Documentation

- [**docs/DATABASE.md**](docs/DATABASE.md): Schema overview, six reporting views, and 24 audit triggers.
- [**docs/API_REFERENCE.md**](docs/API_REFERENCE.md): Endpoint listing and authentication guide.
- [**CONTRIBUTING.md**](CONTRIBUTING.md): Guidelines for developers joining the project.

## Demo Credentials (Development)
The local seeder provides the following credentials for evaluation:
- **Admin**: `admin@havenstay.local` / `HavenStay123!`
- **Staff**: `staff@havenstay.local` / `HavenStay123!`
- **Viewer**: `viewer@havenstay.local` / `HavenStay123!`

---

### Repository Standards

*   **`docs/`**: Technical documentation, SRS, and architecture (SDD).
*   **`design-system/`**: Authoritative UI/UX specifications and component library.
*   **`backend/`**: Laravel core, API services, and migrations.
*   **`frontend/`**: Next.js source and design tokens.
- **Audit Logging**: Mandatory for all transactional writes via the `AuditService`.

---

*HavenStay is released under the [MIT License](LICENSE).*
