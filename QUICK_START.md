# HavenStay Quick Start Guide

> Get started with HavenStay development.

---

## 🐋 Docker "Fast Track" (Recommended)
The easiest way to get HavenStay running locally is via **Docker**. This ensures your environment perfectly matches production, including the primary-replica database architecture required for CCR-002.

**1. Start Docker Desktop**
**2. Run everything with one command:**
```bash
docker compose up --build -d
```
**3. Initialize data:**
```bash
docker compose exec backend php artisan migrate:fresh --seed
```
**4. Visit [localhost:3000](http://localhost:3000)** (Admin: `admin@havenstay.ph` / `HavenStay123!`)

---

## 📚 Documentation Structure

```
havenstay/
├── DOCKER_SETUP.md              # ⭐ Docker guide (distributed DB)
├── QUICK_START.md               # ⭐ This file
│
    ├── docs/               # System documentation (SRS, SDD, etc.)
    ├── frontend/           # Next.js web application
    └── backend/            # Laravel REST API
        ├── database/sql/   # Authoritative MySQL schema
        └── ...
```

---

## 🚀 Traditional Setup (Manual)

**Start here:**
1. Follow the [DOCKER_SETUP.md](./DOCKER_SETUP.md) for local installation.
2. Review the Technical specifications in `docs/SRS.md`.
- `design-system/havenstay/MASTER.md` — When building UI (primary visual + component spec)

### 2. Understand the Tech Stack

**Backend:**
- Laravel 13 (PHP 8.3+)
- **Database**: MySQL 8.4+ (Source of Truth/Audit Triggers)
- **Frontend**: Next.js 16 + Tailwind CSS v4for auth

**Frontend:**
- Next.js 16.2.1 (App Router)
- React 19.2.4
- Tailwind CSS v4

**Locked — No exceptions!**

### 3. Set Up Your Environment

**Backend:**
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan db:seed
php artisan serve
```

**Frontend:**
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

- **Admin**: `admin` / `HavenStay123!` (email: `admin@havenstay.ph`)
- **Staff**: `staff` / `HavenStay123!` (email: `elena.santos@havenstay.ph`)
- **Viewer**: `viewer` / `HavenStay123!` (email: `rdalisay@havenstay.ph`)

---

## ✅ Pre-Commit Checklist

**Backend:**
- [ ] Ran `php artisan test` (all pass)
- [ ] Verified CCR compliance if database work
- [ ] Called `AuditService::setAuditUserContext()` before transactions
- [ ] Updated schema file if database changes

**Frontend:**
- [ ] Ran `npm run lint` (passes)
- [ ] Ran `npm run build` (succeeds)
- [ ] All loading states use Skeletons (no Spinners)

**Documentation:**
- [ ] Updated traceability matrix if new FR implemented
- [ ] Updated CLAUDE.md if architecture changed

---

## 📖 Key Concepts

### Course Compliance Requirements (CCR)

The following 8 requirements are non-negotiable for academic submission:
- **CCR-001**: ≥6 entities (HavenStay has 11)
- **CCR-002**: Distributed DB (MySQL Primary-Replica topology)
- **CCR-003**: SQL CRUD operations (SELECT, INSERT, UPDATE, DELETE)
- **CCR-004**: SQL operators (AND, OR, BETWEEN, LIKE)
- **CCR-005**: SQL joins (implemented via 6 Canonical Reporting Views)
- **CCR-006**: Transactions (Explicit `COMMIT`/`ROLLBACK` control)
- **CCR-007**: Transaction logs (Manual workflow tracking in `transaction_logs`)
- **CCR-008**: SQL Triggers (24 `AFTER` triggers for automated auditing)

### Audit Context Pattern

Before any transactional write to trigger-covered tables on MySQL:

```php
AuditService::setAuditUserContext($actor->id);
```

- **Triggers**: 24 database triggers capture row-level changes into `audit_logs` using the MySQL session variable `@current_user_id`.archy

HavenStay follows a "Stability First" design policy:
1. **Skeleton First**: Every data-loading card must show a structural skeleton immediately.
2. **Tabular Numerics**: All financial data and IDs use `font-mono` for vertical alignment.
3. **No Spinning Icons**: Use pulse animations for refreshing, not spinning icons.

**Happy coding!** 🚀
