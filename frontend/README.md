# HavenStay Frontend (Next.js)

The HavenStay frontend is a modern SPA built with Next.js 16 (App Router), adhering to the Modular Feature-Based App Router architecture.

## 🛠️ Stack

- **Framework:** Next.js 16.x (React 19)
- **Styling:** Tailwind CSS v4 + HS-Utilities
- **Data Fetching:** SWR (Stale-While-Revalidate)
- **Forms:** React Hook Form + Zod

## 🚀 Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```
2. **Environment Setup**
   Ensure `.env.local` is present (it defaults to same-origin proxying).
3. **Run Development Server**
   ```bash
   npm run dev
   ```

## 📂 Documentation

- [**Main Project README**](../README.md)
- [**Frontend Coding Blueprint**](../docs/FRONTEND_CODING_BLUEPRINT.md)
- [**Design System**](../design-system/havenstay/MASTER.md)

---

## 🗺️ Implemented Route Map

### Core

- `/dashboard` — Main operational metrics.
- `/tenants` — Tenant lifecycle management (`/new`, `/[id]`, `/[id]/edit`).
- `/rooms` — Inventory management (`/new`, `/[id]`, `/[id]/edit`).
- `/contracts` — Lease management (`/new`, `/[id]`).
- `/billing` — Utility and rent invoicing (`/new`, `/[id]`).
- `/payments` — Collections and receipting (`/new`).

### Reports

- `/reports` — Hub for all operational reporting.
- `/reports/occupancy` — Real-time room capacity.
- `/reports/active-contracts` — Current lease agreements.
- `/reports/outstanding-balances` — AR aging and delinquencies.
- `/reports/tenant-ledger` — Detailed financial history per tenant.

### Administration

- `/users` — Role-based access control (Admin only).
- `/audit-logs` — Forensic row-level change tracking (Admin only).

---

## ✅ Quick UAT Checklist

- [ ] **Auth**: Login/Logout and route guarding work.
- [ ] **Navigation**: Sidebar and keyboard shortcuts (G+letter) work.
- [ ] **Forms**: Validation and submission (Tenants/Rooms/Contracts) work.
- [ ] **Audit**: Actions are correctly attributed in the Audit Log.
- [ ] **UI**: All status badges use the correct semantic colors.
- [ ] **UX**: Loading states use Skeletons (no spinners).
