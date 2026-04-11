# HavenStay API Reference

REST API for HavenStay BHMS (Laravel 13, Sanctum). Base path: **`/api`**. Request and response bodies are JSON unless noted.

## Authentication and access

- **Bearer token:** Send `Authorization: Bearer <token>` for every route except those listed under [Public routes](#public-routes).
- **Middleware:** Authenticated routes use `auth:sanctum` and `auth.check` (see `backend/routes/api.php`).
- **Authorization:** Enforced in controllers via `AuthorizationService` (not Gates/Policies). Roles are `admin`, `staff`, `viewer` on `users.role_id` → `roles.role_name`.

### Role shorthand (this document)

| Shorthand | Meaning |
| :--- | :--- |
| **Admin** | `admin` only (`AuthorizationService::canManageUsers`) |
| **Staff+** | `admin` or `staff` (operational write access where noted) |
| **All roles** | `admin`, `staff`, or `viewer` (read or allowed action) |
| **Reports** | All roles (`canViewReports`) |
| **Billing view** | All roles (`canViewBilling`) |

---

## Public routes

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Issue Sanctum token (body: credentials per `AuthController`). |
| `GET` | `/api/health` | Liveness JSON: `{ "status": "ok", "service": "havenstay-backend" }`. |

---

## Authenticated — session and user

| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/auth/me` | All authenticated | Current user (with `role` as loaded by controller). |
| `POST` | `/api/auth/logout` | All authenticated | Revoke current token(s). |
| `GET` | `/api/user` | All authenticated | Laravel default: returns `$request->user()` (same use-case as `auth/me`; prefer one client convention). |

---

## Users (`/api/users`)

**Admin only** — `canManageUsers` on every action.

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/users` | List users. |
| `GET` | `/api/users/roles` | List roles (`roles` table) for assignment UIs. |
| `GET` | `/api/users/{user}` | Get one user (with `role`). |
| `POST` | `/api/users` | Create user. |
| `PUT` | `/api/users/{user}` | Update user (optional `password`). |
| `POST` | `/api/users/{user}/deactivate` | Soft-deactivate. |
| `POST` | `/api/users/{user}/reactivate` | Reactivate. |
| `POST` | `/api/users/{user}/assign-role` | Assign role. |

`{user}` is the Eloquent key (typically `user_id` / route model binding).

---

## Tenants (`/api/tenants`)

| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tenants` | All authenticated | List tenants (`TenantService::allRich`). |
| `POST` | `/api/tenants` | Staff+ | Create tenant. |
| `GET` | `/api/tenants/search` | All authenticated | Search (query params: `q`, optional `status`). CCR-004 LIKE search in service. |
| `GET` | `/api/tenants/{tenant}` | All authenticated | Tenant detail. |
| `PUT` | `/api/tenants/{tenant}` | Staff+ | Update tenant. |
| `POST` | `/api/tenants/{tenant}/deactivate` | Staff+ | Deactivate (e.g. moved out). |
| `POST` | `/api/tenants/{tenant}/reactivate` | Staff+ | Reactivate. |

> **Route order:** `search` is a static segment and is registered before `{tenant}` so `/api/tenants/search` is not captured as a tenant ID.

---

## Rooms and bed spaces (`/api/rooms`)

| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/rooms` | All authenticated | List rooms with bed spaces. |
| `POST` | `/api/rooms` | Staff+ | Create room (optional nested `bed_spaces`). |
| `GET` | `/api/rooms/availability` | All authenticated | Availability payload (`RoomService::getAllAvailability`). |
| `GET` | `/api/rooms/{room}` | All authenticated | Room detail with bed spaces. |
| `PUT` | `/api/rooms/{room}` | Staff+ | Update room / bed space labels. |
| `POST` | `/api/rooms/{room}/bed-spaces` | Staff+ | Add a bed space (`bed_label` in body). |
| `POST` | `/api/rooms/bed-spaces/{bedSpace}/occupy` | Staff+ | Mark bed space occupied (route is under `rooms` prefix; `bedSpace` is `bed_space_id`). |

---

## Contracts (`/api/contracts`)

| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/contracts` | All roles with contract view | List contracts. Query: optional `tenant_id`, `status`. |
| `POST` | `/api/contracts` | Staff+ | Create contract (move-in). |
| `GET` | `/api/contracts/{contract}` | All roles with contract view | Contract detail (`ContractService::getById`). |
| `PUT` | `/api/contracts/{contract}` | Staff+ | Update contract fields (e.g. dates, deposit, status, notes). |
| `POST` | `/api/contracts/{contract}/move-out` | Staff+ | Process move-out (`actual_move_out`, optional `notes`). |

---

## Billing (`/api/billing`)

| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/billing` | Billing view | List billing records. |
| `POST` | `/api/billing` | Staff+ | Create billing + line items. |
| `GET` | `/api/billing/{billing}` | Billing view | Billing detail and line items. |
| `PATCH` | `/api/billing/{billing}/status` | Staff+ | Update status (validated in controller). |

---

## Payments (`/api/payments`)

| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/payments` | Billing view | List payments. |
| `POST` | `/api/payments` | Staff+ | Post payment against billing. |
| `GET` | `/api/payments/{payment}` | Billing view | Payment detail. |
| `DELETE` | `/api/payments/{payment}` | Staff+ | **Soft void** — HTTP DELETE for REST semantics; **does not** run SQL `DELETE` on `payments`. Sets `voided_at` / `voided_by` / `void_reason` (FR-026). |

---

## Reports (`/api/reports`)

**All roles** — `canViewReports`. Data comes from reporting views in `havenstay_schema.sql` (see [DATABASE.md](DATABASE.md)).

### JSON

| Method | Path | Query parameters (validated) | Primary view / notes |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/reports/occupancy` | — | `vw_room_occupancy` / occupancy composition in `ReportService::occupancy()` |
| `GET` | `/api/reports/billing-summary` | `start_date`, `end_date` (optional) | `vw_billing_summary` |
| `GET` | `/api/reports/outstanding-balances` | `tenant_id`, `due_from`, `due_to` (optional) | `vw_billing_summary` |
| `GET` | `/api/reports/collections-performance` | `start_date`, `end_date`, `payment_method` (optional) | `vw_collections_summary` |
| `GET` | `/api/reports/tenant-ledger` | **`tenant_id` required** | Tenant ledger aggregation |
| `GET` | `/api/reports/tenant-history` | `from`, `to`, `status` (`all` \| `active` \| `moved_out` \| `completed` \| `terminated`) | `vw_tenant_contract_history` |

**Tenant history JSON `rows[]` fields:** `contract_id`, `tenant_id`, `tenant_name`, `email`, `move_in_date`, `move_out_date`, `room_label`, `status`.

### CSV exports

Same query parameters as the matching JSON endpoint where applicable.

| Method | Path |
| :--- | :--- |
| `GET` | `/api/reports/occupancy/export` |
| `GET` | `/api/reports/billing-summary/export` |
| `GET` | `/api/reports/outstanding-balances/export` |
| `GET` | `/api/reports/collections-performance/export` |
| `GET` | `/api/reports/tenant-ledger/export` |
| `GET` | `/api/reports/tenant-history/export` |

Exports return streamed CSV (`text/csv`) with `Content-Disposition` attachment filenames set in `ReportController`.

---

## Audit and transaction logs

**Admin only** — `canManageUsers`.

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/audit-logs` | Row-level audit (`AuditService::listLogs`; supports query filters from request). |
| `GET` | `/api/transaction-logs` | Workflow transaction logs (`TransactionService::listLogs`). |

---

## Errors

| HTTP | When |
| :--- | :--- |
| `401` | Missing/invalid token (`Unauthenticated.`). |
| `403` | Authenticated but `AuthorizationService` denies action (message explains resource). |
| `422` | Validation error (`message` / `errors`). |
| `409` | Conflict (e.g. bed space occupy — see `RoomController`). |

---

## Primary key naming

APIs use explicit keys such as `tenant_id`, `contract_id`, `billing_id`, `payment_id`, `user_id` in JSON where applicable.

---

*Source of truth: `backend/routes/api.php` · Aligned to AuthorizationService and controllers · Last updated: April 2026*
