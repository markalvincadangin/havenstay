# HavenStay Quick Start Guide

> [!TIP]
> This is the "Fast Track" guide. For a full breakdown of development modes (including manual and tunnel/port-forwarding), see the **[Development Setup Guide](./docs/DEV_SETUP.md)**.

---

## 🐋 Docker "Fast Track" (Recommended)

The easiest way to get HavenStay running locally is via **Docker**. This ensures your environment perfectly matches production.

**1. Start Docker Desktop**

**2. Spin up the containers:**
```bash
docker compose up --build -d
```

**3. Initialize data (run once):**
```bash
docker compose exec backend php artisan migrate:fresh --seed
```

**4. Visit [localhost:3000](http://localhost:3000)**
- **Admin**: `admin@havenstay.ph` / `HavenStay123!`

---

## 📚 Project Structure

```
havenstay/
├── docs/               # System documentation (SRS, SDD, DEV_SETUP)
├── frontend/           # Next.js web application
└── backend/            # Laravel REST API
```

---

## ✅ Pre-Commit Checklist

- **Backend**: `php artisan test` (SQLite) or `composer test:mysql`.
- **Frontend**: `npm run lint` and `npm run build`.
- **Documentation**: Update `CLAUDE.md` and `docs/SDD.md` if architecture changes.

For detailed manual installation (XAMPP/Herd) or Port-Forwarding setup, see **[docs/DEV_SETUP.md](./docs/DEV_SETUP.md)**.
