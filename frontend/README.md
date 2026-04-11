# HavenStay Frontend

Next.js frontend for HavenStay BHMS, aligned to **`../design-system/havenstay/MASTER.md`** (design system) and **`../docs/SRS.md`** / **`../docs/SDD.md`** (requirements and architecture).

For project-level setup, deployment, and verification, see:

- `../README.md`
- `../docs/DEPLOYMENT.md`

## Stack

- Next.js App Router
- React + React Hook Form
- Tailwind CSS (v4)

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

3. Run dev server:

```bash
npm run dev
```

4. Open:

- Frontend: `http://localhost:3000`
- Backend API should be running separately (Laravel).

## Useful Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Authentication and Route Guarding

- Auth token is stored in:
  - `localStorage` (`havenstay_token`)
  - cookie (`havenstay_token`) for middleware checks
- Middleware file: `src/middleware.js`
- Behavior:
  - `/` redirects to `/login` (or `/dashboard` when authenticated)
  - protected routes redirect to `/login` if unauthenticated
  - authenticated users are redirected away from `/login` and `/signin`

## Implemented Route Map

### Public/Auth

- `/login`
- `/signin` (alias of login)

### Core

- `/dashboard`
- `/tenants`
- `/tenants/new`
- `/tenants/[id]`
- `/tenants/[id]/edit`
- `/rooms`
- `/rooms/new`
- `/rooms/[id]`
- `/rooms/[id]/edit`
- `/contracts`
- `/contracts/new`
- `/contracts/[id]`
- `/billing`
- `/billing/new`
- `/billing/generate` (alias of billing new)
- `/billing/[id]`
- `/payments`
- `/payments/new`

### Reports

- `/reports` (hub listing six report areas)
- `/reports/occupancy`
- `/reports/billing-summary`
- `/reports/outstanding-balances`
- `/reports/receivables` (redirect/alias to outstanding balances)
- `/reports/collections` (collections performance; `vw_collections_summary`)
- `/reports/tenant-ledger`
- `/reports/tenant-history` (contract history; `GET /api/reports/tenant-history`)

### Admin

- `/users` (Admin only; create/edit where implemented)
- `/audit-logs` (Admin only; `GET /api/audit-logs`)
- `/transaction-logs` (Admin only; `GET /api/transaction-logs`)

## Role Access (UI)

- **Admin**
  - Full access to operations + administration modules
- **Staff**
  - Operations modules (create/update where allowed)
  - No administration modules
- **Viewer**
  - Read-only experience
  - Create/edit/post actions are hidden or disabled with read-only guidance

## Current Notes

- Backend API base URL: `NEXT_PUBLIC_API_BASE_URL` (see `../docs/API_REFERENCE.md`).
- Reporting UIs call the Laravel report endpoints; CSV export uses the matching `/export` routes.

## Quick UAT Checklist

Use this as a fast smoke/UAT pass for the frontend.

### Auth and Guarding

- [ ] Unauthenticated user visiting `/dashboard` is redirected to `/login`
- [ ] Login succeeds and redirects to `/dashboard`
- [ ] Authenticated user visiting `/login` is redirected to `/dashboard`
- [ ] Logout clears session and returns user to `/login`

### Core Navigation

- [ ] Sidebar links load: Dashboard, Tenants, Rooms, Contracts, Billing, Payments, Reports
- [ ] Admin account additionally sees: Users, Audit Logs, and Transaction Logs (where present in nav)
- [ ] Root route `/` redirects correctly based on auth state

### Module Pages

- [ ] Tenants list/search/filter render correctly
- [ ] Tenants create/detail/edit pages submit and navigate correctly
- [ ] Rooms list/filter and create/detail/edit pages work correctly
- [ ] Contracts create and detail/move-out flows work
- [ ] Billing list/create/detail flows work
- [ ] Payments list and post-payment flow work

### Reports

- [ ] Reports home loads all six report links
- [ ] Occupancy, billing summary, outstanding/receivables, collections, tenant ledger, and tenant history pages load data
- [ ] CSV export buttons download files
- [ ] Print view hides app chrome and prints readable table borders

### Role Behavior

- [ ] Admin can access all modules including `/users` and `/audit-logs`
- [ ] Staff can access operations but not admin modules
- [ ] Viewer sees read-only guidance and cannot access create/edit/post actions

### Accessibility and UX

- [ ] First field autofocus works on key forms (login/create/edit flows)
- [ ] Unsaved-changes warning appears on dirty form refresh/tab close
- [ ] Tables expose accessible labels/captions
- [ ] Alerts announce properly (error assertive, info/status polite)

