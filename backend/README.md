# HavenStay Backend (Laravel API)

Backend service for HavenStay BHMS.

## Stack

- Laravel 13
- PHP 8.3+
- Sanctum authentication
- SQLite (local dev) and MySQL (production-like/evidence)

## Setup

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan db:seed
```

## Run

```bash
php artisan serve --host=127.0.0.1 --port=8000
```

## Test

```bash
php artisan test
```

## API Highlights

- Health: `/health`, `/api/health`
- Auth: `/api/auth/*`
- Core modules: `/api/tenants`, `/api/rooms`, `/api/contracts`, `/api/billing`, `/api/payments`, `/api/reports`

## Documentation

- Project root guide: `../README.md`
- Deployment: `../docs/DEPLOYMENT.md`
- Requirements/design/tests: `../docs/SRS.md`, `../docs/SDD.md`, `../docs/TEST_PLAN.md`
