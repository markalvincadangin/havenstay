# HavenStay Deployment Guide

This guide provides the necessary steps to deploy HavenStay BHMS in both development and production-like environments.

---

## Table of Contents
1. [Environment Profiles](#environment-profiles)
2. [Backend Deployment (Laravel)](#backend-deployment-laravel)
3. [Frontend Deployment (Next.js)](#frontend-deployment-nextjs)
4. [Critical Variables](#critical-variables)
5. [Smoke Test Checklist](#smoke-test-checklist)

---

## 1. Environment Profiles

### Local Development (SQLite)
Default profile for rapid development and functional testing.
- **Database**: SQLite
- **Auth**: Sanctum (Token-based)

### Production-like (MySQL)
Profile used for release validation and performance audits.
- **Database**: MySQL 8.4+ (Authoritative Schema)
- **Hardening**: `APP_DEBUG=false`, optimized caches.
- Standard database migrations are used for schema initialization.

---

## 2. Backend Deployment (Laravel)

> [!CAUTION]
> Never run `migrate:fresh` in a production-like environment unless you explicitly intend to purge all data.

1. **Install Dependencies**:
   ```bash
   cd backend
   composer install --no-dev --optimize-autoloader
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   php artisan key:generate
   ```

3. **Initialize Database**:
   ```bash
   php artisan migrate --force
   ```

4. **Optimize Runtime**:
   ```bash
   php artisan config:cache
   php artisan route:cache
   ```

---

## 5. Smoke Test Checklist

After deployment, verify the system health using the following endpoints:

| Check | Endpoint | Expected Result |
| :--- | :--- | :--- |
| **App Health** | `/health` | `200 OK` |
| **API Connectivity** | `/api/health` | `200 OK` |
| **Auth Flow** | `POST /auth/login` | Valid JWT/Sanctum Payload |

---

*For detailed database setup, see [**DISTRIBUTED_DB_SETUP.md**](DISTRIBUTED_DB_SETUP.md).*
