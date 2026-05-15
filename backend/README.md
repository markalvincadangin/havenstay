# HavenStay Backend (Laravel API)

The HavenStay backend is a RESTful API built with Laravel 13, following a 5-Tier Extended MVC architecture.

## 🛠️ Stack
- **Framework:** Laravel 13.x
- **PHP Version:** 8.3+
- **Auth:** Laravel Sanctum
- **Database:** MySQL 8.4 (Primary-Replica) / SQLite (Tests)

## 🚀 Quick Start (Local Development)

1. **Install Dependencies**
   ```bash
   composer install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   php artisan key:generate
   ```

3. **Database Initialization**
   ```bash
   # Ensure your local MySQL is running or use SQLite
   php artisan migrate:fresh --seed
   ```

4. **Serve**
   ```bash
   php artisan serve
   ```

## 🧪 Testing
```bash
php artisan test       # Unit and Feature tests
composer test:mysql    # Integration tests against MySQL
```

## 📂 Documentation
- [**Main Project README**](../README.md)
- [**API Reference**](../docs/API_REFERENCE.md)
- [**Backend Coding Blueprint**](../docs/BACKEND_CODING_BLUEPRINT.md)
- [**Database Documentation**](../docs/DATABASE.md)
