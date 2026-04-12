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
├── docs/                        # Domain & Tech Documentation
├── design-system/               # Visual & Component Design Spec
└── backend/                     # Laravel Core & Database
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
- MySQL 8.4+ (primary) / SQLite (dev)
- Laravel Sanctum for auth

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

**Demo credentials:**
- Admin: `admin@havenstay.local` / `HavenStay123!`
- Staff: `staff@havenstay.local` / `HavenStay123!`
- Viewer: `viewer@havenstay.local` / `HavenStay123!`

---

## ✅ Pre-Commit Checklist

**Backend:**
- [ ] Ran `php artisan test` (all pass)
- [ ] Verified CCR compliance if database work
- [ ] Called `setAuditUserContext()` before MySQL transactions
- [ ] Updated schema file if database changes

**Frontend:**
- [ ] Ran `npm run lint` (passes)
- [ ] Ran `npm run build` (succeeds)
- [ ] Verified design system compliance

**Documentation:**
- [ ] Updated traceability matrix if new FR
- [ ] Updated CLAUDE.md if architecture changed
- [ ] Updated spec tasks if working from spec

---

## 🔧 Kiro-Specific Tips

### Efficient File Reading

```
# Use readCode for code files (not readFile)
readCode(path="backend/app/Services/BillingService.php")

# Read multiple files at once
readMultipleFiles(paths=["file1.php", "file2.php"])

# Use context-gatherer for complex exploration
invokeSubAgent(name="context-gatherer", prompt="Find all billing-related files")
```

### Multi-File Changes

```
# Use strReplace in parallel for independent changes
strReplace(path="file1.php", oldStr="...", newStr="...")
strReplace(path="file2.php", oldStr="...", newStr="...")

# Use semanticRename for symbol renaming
semanticRename(path="file.php", line=42, character=15, 
               oldName="old", newName="new")

# Use smartRelocate for file moves (auto-updates imports)
smartRelocate(sourcePath="old/path.js", destinationPath="new/path.js")
```

### Testing and Validation

```
# Always use getDiagnostics (not bash commands)
getDiagnostics(paths=["backend/app/Services/BillingService.php"])

# Run tests
executePwsh(command="php artisan test", cwd="backend")
executePwsh(command="npm run lint", cwd="frontend")
```

---

## 📖 Key Concepts

### Course Compliance Requirements (CCR)

8 non-negotiable requirements for academic submission:
- CCR-001: ≥6 entities (we have 11)
- CCR-002: Distributed DB (MySQL primary-replica)
- CCR-003: SQL CRUD operations
- CCR-004: SQL operators (AND, OR, BETWEEN, LIKE)
- CCR-005: SQL joins (use views)
- CCR-006: Transactions (COMMIT/ROLLBACK)
- CCR-007: Transaction logs
- CCR-008: Triggers (AFTER INSERT/UPDATE/DELETE)

**Never break these!**

### Audit Context Pattern

Before any MySQL transaction that writes to trigger-covered tables:

```php
if (DB::connection()->getDriverName() === 'mysql') {
    self::setAuditUserContext($actor->id);
}
```

This sets `@app_user_id` so triggers can write the acting user to `audit_logs`.

### Design System Hierarchy

**Happy coding!** 🚀
