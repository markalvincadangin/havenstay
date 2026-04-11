# HavenStay BHMS

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Laravel](https://img.shields.io/badge/Backend-Laravel%2013-red)](https://laravel.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black)](https://nextjs.org)

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

## Quickstart

### 1. Backend Setup
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

### 2. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Demo Credentials (Development)
The local seeder provides the following credentials for evaluation:
- **Admin**: `admin@havenstay.local` / `HavenStay123!`
- **Staff**: `staff@havenstay.local` / `HavenStay123!`
- **Viewer**: `viewer@havenstay.local` / `HavenStay123!`

---

### Repository Standards

- **`.ai-docs/`**: Reserved for AI operational planning and evidence workflows.
- **`docs/`**: Contains product engineering specs (SRS, SDD, Test Plan).
- **Audit Logging**: Mandatory for all transactional writes via the `AuditService`.

---

*HavenStay is released under the [MIT License](LICENSE).*
