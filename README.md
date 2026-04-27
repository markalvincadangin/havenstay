# HavenStay Boarding House Management System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Laravel](https://img.shields.io/badge/Backend-Laravel%2014-red?logo=laravel)](https://laravel.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black?logo=next.js)](https://nextjs.org)
[![Docker](https://img.shields.io/badge/Infrastructure-Docker-blue?logo=docker)](https://www.docker.com/)

HavenStay is a centralized, high-performance boarding house management system designed for operational efficiency, audit compliance, and forensic data integrity.

### 🚀 Live Environments
*   **Production Application**: [https://havenstay-theta.vercel.app/](https://havenstay-theta.vercel.app/)
*   **Production API**: [https://havenstay-qhun.onrender.com/api/health](https://havenstay-qhun.onrender.com/api/health)

---

## 🛠️ Getting Started

We provide three ways to run HavenStay locally. Choose the one that fits your workflow.

1.  **[Docker Setup (Recommended)](./docs/DEV_SETUP.md#profile-a--docker-recommended)**: The fastest way to get the full distributed stack running.
2.  **[Manual Setup](./docs/DEV_SETUP.md#profile-b--manual-no-docker)**: For developers who prefer running processes natively on their host machine.
3.  **[Tunnel / Port-Forwarding Setup](./docs/DEV_SETUP.md#profile-c--port-forwarding--tunnel)**: For testing with remote services (Vercel previews, mobile devices, TestSprite) calling your local machine.

See the **[Development Setup Guide](./docs/DEV_SETUP.md)** for detailed instructions.

---

## Key Features

- **Distributed Architecture**: Multi-node database strategy using a **MySQL Primary-Replica** topology, ensuring high availability and read-heavy optimization (Satisfies CCR-002).
- **Forensic Auditing**: Complete row-level audit trail powered by 45 database triggers capturing full JSON snapshots (Satisfies CCR-007).
- **Forensic UI/UX**: Professional interface using **Structural Skeletons** for layout stability and analytical clarity.
- **Transaction Reliability**: Robust workflow logging and explicit `DB::transaction()` boundaries for all financial operations (Satisfies CCR-006).
- **Operational Intelligence**: Real-time dashboards and professional CSV reports using SQL Joins and Canonical Views (Satisfies CCR-005).

---

## Technical Architecture

HavenStay is built on a mission-critical stack designed for data integrity and performance.

- **Frontend**: [Next.js 16](https://nextjs.org/) (App Router) + [React 19](https://react.dev/) + [Tailwind CSS v4](https://tailwindcss.com/).
- **Backend**: [Laravel 14](https://laravel.com/) (PHP 8.3+) with Service-Oriented Architecture and Read/Write DB splitting.
- **Database**: [MySQL 8.4](https://www.mysql.com/) Primary (Read/Write) + MySQL 8.4 Replica (Read-Only).
- **Infrastructure**: [Docker](https://www.docker.com/) (Local) | [Render](https://render.com/) (Backend) | [Vercel](https://vercel.com/) (Frontend) | [Aiven](https://aiven.io/) (Database).

---

## Documentation Index

- [**docs/DEV_SETUP.md**](docs/DEV_SETUP.md): **Start Here.** Comprehensive local setup guide.
- [**docs/DEPLOYMENT.md**](docs/DEPLOYMENT.md): Production deployment guide (Render/Vercel/Aiven).
- [**docs/DATABASE.md**](docs/DATABASE.md): Schema overview, reporting views, and audit triggers.
- [**docs/API_REFERENCE.md**](docs/API_REFERENCE.md): Endpoint listing and authentication guide.
- [**docs/BUSINESS_RULES.md**](docs/BUSINESS_RULES.md): The "Laws of HavenStay" governing all logic.
- [**CLAUDE.md**](CLAUDE.md): Engineering reference and coding standards.

---

## Demo Credentials (Local/Dev)
- **Admin**: `admin@havenstay.ph` / `HavenStay123!`
- **Staff**: `staff@havenstay.local` / `HavenStay123!`
- **Viewer**: `viewer@havenstay.local` / `HavenStay123!`

---

*HavenStay is released under the [MIT License](LICENSE).*
