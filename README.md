# HavenStay

HavenStay is a management system for boarding house operations focused on forensic data integrity and automated utility billing. It provides a centralized solution for tracking bed-level occupancy, lease lifecycles, and pro-rated utility consumption across shared residential units.

![HavenStay Dashboard Mockup](assets/havenstay_dashboard.png)

[![Backend](https://img.shields.io/badge/Laravel-13-red)](https://laravel.com)
[![Frontend](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![Infrastructure](https://img.shields.io/badge/Docker-Compose-blue)](https://www.docker.com/)
[![Audit](https://img.shields.io/badge/Forensics-Trigger--Based-teal)](docs/DATABASE.md)


## System Architecture

HavenStay utilizes a decoupled three-tier architecture optimized for scalability and reliability.

### Backend (The Core)
- **Framework:** Laravel 13.x (PHP 8.3+)
- **Database:** MySQL 8.4 (Primary-Replica Topology)
- **Security:** Laravel Sanctum (Token-Based Auth) + Centralized RBAC
- **Audit:** 45 Database Triggers + Session-Aware Correlation IDs

### Frontend (The Interface)
- **Framework:** Next.js 16.x (App Router) + React 19
- **Styling:** Tailwind CSS v4 + Custom "HS Glass" Utility Layer
- **State:** SWR (Stale-While-Revalidate) for high-performance data fetching
- **Typography:** Plus Jakarta Sans & DM Sans

---

## ⚙️ Quick Start

HavenStay is fully containerized for a seamless development experience.

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Git](https://git-scm.com/)

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/markalvincadangin/havenstay.git
    cd havenstay
    ```

2.  **Orchestrate Services**
    ```bash
    docker compose up -d
    ```

3.  **Bootstrap Environment**
    ```bash
    # Run migrations and seed the demo dataset
    docker compose exec backend php artisan migrate:fresh --seed
    ```

4.  **Access the Dashboard**
    - **Frontend:** [http://localhost:3000](http://localhost:3000)
    - **API Health:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## 📂 Documentation

| Documentation | Description |
| :--- | :--- |
| [**Business Rules**](docs/BUSINESS_RULES.md) | The authoritative logic manual for system operations. |
| [**System Design (SDD)**](docs/SDD.md) | Technical architecture and data relationship maps. |
| [**API Reference**](docs/API_REFERENCE.md) | Comprehensive RESTful endpoint documentation. |
| [**Dev Runbook**](docs/DEV_SETUP.md) | Detailed installation and troubleshooting guide. |

---

## 🤝 Demo Accounts

| Role | Email | Password |
| :--- | :--- | :--- |
| **System Admin** | `havenstay.admin@havenstay.com` | `HavenStay123!` |
| **Property Staff** | `havenstay.staff@havenstay.com` | `HavenStay123!` |
| **Viewer (Audit)** | `viewer@havenstay.com` | `HavenStay123!` |

---

*Built with precision by [Mark Alvin Cadangin](https://github.com/markalvincadangin).*
