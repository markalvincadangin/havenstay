# HavenStay API Reference

**Version:** 5.3  
**Last Updated:** May 02, 2026  
**Status:** Canonical integration contract for backend services; forensic alignment baseline (v5.0 engine)

REST API for HavenStay BHMS (Laravel, Sanctum). Base path: **`/api`**.

## 1. Document Boundary
This document defines the technical interface contract between the HavenStay presentation layer and the application services. It specifies the endpoints, security schemes, request/response structures, and error modalities required to realize the capabilities defined in [**SRS.md**](../docs/SRS.md).

---

## 2. API Standards and Conventions

### 2.1 Standard Response Payloads
- **Success:** Most `GET` list endpoints return a paginated object:
    - `{ "data": [...], "meta": { "current_page": 1, "last_page": 5, "total": 120 } }`
- **Errors:** All error responses follow a consistent structural pattern per SRS Section 3.2:
    - **General Error (401, 403, 404, 500):**
      `{ "message": "User does not have the right roles." }`
    - **Validation Error (422):**
      `{ "message": "The given data was invalid.", "errors": { "tenant_id": ["The tenant_id field is required."] } }`

### 2.2 Global Parameters
- **Pagination:** `page` (integer ≥ 1), `per_page` (integer 1–100; default 25).
- **Correlation:** Every write operation generates a `correlation_id` which is returned in the response headers. This ID is used to link application actions to forensic audit log entries.

### 2.3 Authentication and Role-Based Access
- **Scheme:** Bearer Token via Laravel Sanctum.
- **Header:** `Authorization: Bearer <token>`
- **Role Enforcement:** Access is validated via `AuthorizationService`.

| Role | Operational Scope |
| :--- | :--- |
| **Admin** | Full system management (Users, Audit, Finance) |
| **Staff** | Operational management (Tenants, Rooms, Contracts, Billing, Meters) |
| **Viewer** | Read-only access to operational data and reports |

### 2.4 Data Privacy (NFR-015)
In accordance with **NFR-015**, PII (Personally Identifiable Information) masking is enforced on all API responses for the **Viewer** role. Sensitive fields such as contact numbers and addresses are redacted or masked in list and detail views to protect tenant privacy.

### 2.5 Idempotency Protection
- **Header:** `Idempotency-Key: <UUID>`
- **Scope:** Required for all write operations (`POST`, `PUT`, `PATCH`) on Contracts, Billings, and Payments.
- **Behavior:** Ensures that if a request is retried due to network lag, the system will not create duplicate financial or contractual records. Valid for 24 hours per key.

---

## 3. Core Resource Endpoints

### 3.1 Authentication and Public Access
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | FR-001 | Issue session token via credentials |
| `GET` | `/api/auth/google/redirect` | Public | FR-003 | Initiate Google OAuth flow |
| `GET` | `/api/auth/google/callback` | Public | FR-003 | Handle OAuth callback, issue Sanctum token |
| `POST` | `/api/auth/logout` | All | FR-001 | Revoke current token |
| `GET` | `/api/auth/me` | All | FR-002 | Get current user and role profile |
| `GET` | `/api/health` | Public | — | Liveness / health check (DB connectivity) |
| `GET` | `/api/ping` | Public | — | Lightweight keep-alive ping |

### 3.2 User Management
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/users` | Admin | FR-005 | Query user accounts (filter by role/status) |
| `GET` | `/api/users/roles` | Admin | FR-005 | List all available system roles |
| `GET` | `/api/users/summary` | Admin | FR-005 | System-wide user KPI statistics |
| `POST` | `/api/users` | Admin | FR-005 | Provision new user account |
| `GET` | `/api/users/{id}` | Admin | FR-005 | Retrieve detailed user profile (includes archived) |
| `PUT` | `/api/users/{id}` | Admin | FR-005 | Update profile (optional password change) |
| `POST` | `/api/users/{id}/deactivate` | Admin | FR-006 | Soft-deactivate user (rejected on login) |
| `POST` | `/api/users/{id}/reactivate` | Admin | FR-006 | Restore access for a deactivated account |
| `POST` | `/api/users/{id}/archive` | Admin | FR-007 | Hard-archive / forensic soft-delete account |
| `POST` | `/api/users/{id}/restore` | Admin | FR-007 | Un-archive a soft-deleted account |
| `POST` | `/api/users/{id}/assign-role` | Admin | FR-005 | Change a user's system role |

### 3.3 Tenant Management
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/tenants` | All | FR-011 | List tenants with occupancy context and balances |
| `GET` | `/api/tenants/summary` | All | FR-011 | Tenant count KPI statistics |
| `GET` | `/api/tenants/search` | All | FR-011 | Wildcard search (LIKE) by name/contact |
| `POST` | `/api/tenants` | Staff | FR-008 | Register new tenant profile |
| `GET` | `/api/tenants/{id}` | All | FR-008 | View tenant profile and history (includes archived) |
| `PUT` | `/api/tenants/{id}` | Staff | FR-008 | Update tenant contact/profile |
| `POST` | `/api/tenants/{id}/archive` | Staff | BR-TEN-005 | Forensic soft-archive tenant (sets `deleted_at`) |
| `POST` | `/api/tenants/{id}/restore` | Staff | FR-009 | Restore a soft-deleted archived tenant |
| `POST` | `/api/tenants/{id}/reactivate` | Staff | FR-009 | Reactivate a moved-out tenant profile |

### 3.4 Room and Bed Inventory
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/rooms` | All | FR-016 | List rooms with aggregated bed capacity |
| `GET` | `/api/rooms/stats` | All | FR-016 | Room-level aggregate statistics (KPI card data) |
| `GET` | `/api/rooms/availability` | All | FR-016 | Filter beds by vacant status |
| `POST` | `/api/rooms` | Staff | FR-013 | Create new room entity |
| `GET` | `/api/rooms/{id}` | All | FR-013 | Room detail with nested bed spaces |
| `PUT` | `/api/rooms/{id}` | Staff | FR-013 | Update room details (name, type, rate) |
| `POST` | `/api/rooms/{id}/bed-spaces` | Staff | FR-015 | Add a bed space to an existing room |
| `POST` | `/api/rooms/bed-spaces/{id}/occupy` | Staff | FR-015 | Mark a bed space as occupied |
| `POST` | `/api/rooms/{id}/archive` | Staff | FR-017 | Archive room (denied if any beds are occupied) |
| `POST` | `/api/rooms/{id}/restore` | Staff | FR-017 | Restore a soft-deleted (archived) room |
| `GET` | `/api/rooms/{id}/meters` | All | FR-024 | List meters currently assigned to a room |

### 3.5 Operational Lifecycle (Contracts)
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/contracts` | All | FR-021 | Query operational contracts (by tenant/status) |
| `POST` | `/api/contracts` | Staff | FR-018 | Execute new contract (Check-in / Two-Phase reservation) |
| `GET` | `/api/contracts/{id}` | All | FR-021 | Retrieve specific contract and row context (includes archived) |
| `PUT` | `/api/contracts/{id}` | Staff | FR-021 | Update contract metadata (deposit, notes, override rate) |
| `POST` | `/api/contracts/{id}/activate` | Staff | FR-019 | Transition contract from `pending_payment` → `active` |
| `POST` | `/api/contracts/{id}/move-out` | Staff | FR-022 | Finalize move-out (requires zero balance — Gate Pass Clearance) |
| `POST` | `/api/contracts/{id}/void` | Admin | BR-CON-012 | Void a contract (creation-error correction, zero billing history required) |
| `POST` | `/api/contracts/{id}/archive` | Admin | — | Soft-archive a completed/terminated contract |
| `POST` | `/api/contracts/{id}/restore` | Admin | — | Restore a soft-deleted contract |

> **Note:** Security deposit payments (bond, rollover, refund) are posted via `POST /api/payments` with `contract_id` as the XOR target (no `billing_id`). There are no contract-specific deposit/refund/rollover sub-routes.

### 3.6 Meter and Utility Asset Management
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/utilities` | All | FR-024 | List all supported utilities (Electricity, Water, etc.) |
| `POST` | `/api/utilities` | Admin | FR-024 | Register a new billable utility service type |
| `GET` | `/api/utilities/{id}` | All | FR-024 | Retrieve a specific utility and its rates |
| `PUT` | `/api/utilities/{id}` | Admin | FR-024 | Update a utility type (name, description) |
| `POST` | `/api/utilities/{id}/archive` | Admin | FR-024 | Archive a utility type |
| `POST` | `/api/utilities/rates` | Admin | FR-028 | Create a new utility rate (effective-from date) |
| `GET` | `/api/meters` | All | FR-024 | Query physical meter registry |
| `GET` | `/api/meters/{id}` | All | FR-024 | Retrieve meter detail and assignment history |
| `POST` | `/api/meters/{id}/assign` | Staff | FR-025 | Map a meter to a specific room (with effective date) |
| `GET` | `/api/meters/{id}/readings` | All | FR-026 | List all readings for a meter (paginated) |
| `GET` | `/api/meters/{id}/last-billed` | All | FR-026 | Get the most recent billed reading for a meter |
| `POST` | `/api/meters/{id}/readings` | Staff | FR-026 | Record a point-in-time consumption reading |

> **Deprecation Note:** `POST /api/meters/{id}/decommission` is not implemented. Meter decommissioning is handled by transitioning `status` to `replaced` via the meter update workflow.

> **Rate Path Note:** Utility rates are created via `POST /api/utilities/rates` (nested under `/utilities`), **not** `POST /api/utility-rates`.

### 3.7 Financial Management (Billing)
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/billing` | All | FR-032 | List billing cycles with status and aging metadata |
| `POST` | `/api/billing` | Staff | FR-032 | Create a billing cycle (itemized line items) |
| `GET` | `/api/billing/{id}` | All | FR-033 | Detail view of billing cycle and itemized charges |
| `PATCH` | `/api/billing/{id}/status` | Admin | FR-033 | Manually patch billing status (e.g., mark overdue) |
| `POST` | `/api/billing/initialize/{contractId}` | Staff | FR-034 | Initialize a blank billing cycle for a contract |
| `POST` | `/api/billing/forecast` | Staff | FR-029 | Preview utility charge apportionment for a room (no billing ID required) |
| `POST` | `/api/billing/commit-utility` | Staff | FR-029 | Commit calculated utility line items to an existing billing cycle |

### 3.8 Transaction Processing (Payments)
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/payments` | All | FR-044 | Global payment ledger (Dual-path context resolution) |
| `POST` | `/api/payments` | Staff | FR-039 | Post payment (XOR target: `billing_id` OR `contract_id`) |
| `GET` | `/api/payments/{id}` | All | FR-039 | View payment details (with Tenant/Room dual-path resolution) |
| `POST` | `/api/payments/{id}/void` | Staff | FR-043 | Soft-void payment (requires `void_reason`; forensic retain) |

### 3.9 Analytical Reports (Admin Only)
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/reports/occupancy` | Admin | FR-045 | Aggregated room-level occupancy metrics |
| `GET` | `/api/reports/occupancy-status` | Admin | FR-045 | Bed-level availability matrix |
| `GET` | `/api/reports/active-contracts` | Admin | FR-049 | List all currently active contracts |
| `GET` | `/api/reports/billing-summary` | Admin | FR-046 | Financial overview by date range |
| `GET` | `/api/reports/outstanding-balances` | Admin | FR-047 | Receivables aging and balance report |
| `GET` | `/api/reports/collections-performance` | Admin | FR-048 | Payment volume by method and period |
| `GET` | `/api/reports/tenant-ledger` | Admin | FR-051 | Detailed transactional profile for one tenant |
| `GET` | `/api/reports/tenant-history` | Admin | FR-050 | Historical contract list by tenant |
| `GET` | `/api/reports/security-pulse` | Admin | FR-054 | Security event summary (logins, failures, access denials) |
| `GET` | `/api/reports/user-summary` | Admin | FR-005 | User account KPI snapshot |
| `GET` | `/api/reports/meter-summary` | Admin | FR-024 | Meter coverage and reading status overview |
| `GET` | `/api/reports/occupancy/export` | Admin | FR-053 | CSV export — occupancy report |
| `GET` | `/api/reports/occupancy-status/export` | Admin | FR-053 | CSV export — bed availability matrix |
| `GET` | `/api/reports/active-contracts/export` | Admin | FR-053 | CSV export — active contracts |
| `GET` | `/api/reports/billing-summary/export` | Admin | FR-053 | CSV export — billing summary |
| `GET` | `/api/reports/outstanding-balances/export` | Admin | FR-053 | CSV export — outstanding balances |
| `GET` | `/api/reports/collections-performance/export` | Admin | FR-053 | CSV export — collections performance |
| `GET` | `/api/reports/tenant-ledger/export` | Admin | FR-053 | CSV export — tenant ledger |
| `GET` | `/api/reports/tenant-history/export` | Admin | FR-053 | CSV export — tenant history |

### 3.10 Forensic Auditing
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/audit-logs` | Admin | FR-054 | Row-level change logs (trigger-written, paginated) |
| `GET` | `/api/audit-logs/export` | Admin | FR-053 | Export audit dataset to CSV for forensic review |

---

## 4. Error Modalities

| HTTP | Message Pattern | Rationale |
| :--- | :--- | :--- |
| **401** | `Unauthenticated.` | Missing or expired Sanctum token |
| **403** | `User does not have the right roles.` | Role-based permission violation |
| **404** | `Not Found.` | Resource (ID) does not exist |
| **409** | `Conflict.` | State machine violation (e.g. archiving occupied room) or Unique Constraint violation |
| **422** | `The given data was invalid.` | Payload validation failure (includes `errors` map) |

---

## 5. Standard Payloads

### 5.1 Record a Meter Reading
`POST /api/meters/{id}/readings`
```json
{
  "reading_date": "2026-04-18",
  "reading_value": 145.67,
  "is_rollover": false
}
```
*Note: `is_rollover` is required to explicitly flag dial resets per BR-MET-005. The backend will automatically infer `recorded_by` from the Sanctum token.*

### 5.2 Create a New Bill Cycle (Itemized)
`POST /api/billing`
```json
{
  "contract_id": 12,
  "billing_period_from": "2026-04-01",
  "billing_period_to": "2026-04-30",
  "due_date": "2026-05-05",
  "reading_ids": [45, 46],
  "line_items": [
    { "item_type": "base_rent", "amount": 5500.00 },
    { "item_type": "utility", "item_description": "Water (145.67 - 140.23) - Shared 50%", "amount": 75.00 }
  ]
}
```
*Note: `reading_ids` are for forensic linkage; amounts are calculated per BR-MET-007 and BR-MET-010.*

### 5.3 Configure a Utility Rate
`POST /api/utilities/rates`
```json
{
  "utility_id": 1,
  "base_rate": 15.50,
  "effective_from": "2026-05-01"
}
```
*Note: Utility rates are temporal. The system applies the most recent rate whose `effective_from` date is on or before the billing period start (BR-MET-006). Never update an existing rate; insert a new one.*

### 5.4 Void a Payment
`POST /api/payments/{id}/void`
```json
{
  "void_reason": "Incorrect amount entered; resident actually paid ₱500.00 via GCash."
}
```
*Note: Voiding is a forensic operation. The system retains the original record but excludes it from balance computations per BR-PAY-007.*

### 5.5 Post a Security Deposit (Contract-Linked Payment)
`POST /api/payments`
```json
{
  "contract_id": 8,
  "billing_id": null,
  "amount_paid": 5500.00,
  "payment_date": "2026-04-01",
  "payment_method": "cash",
  "category": "deposit",
  "reference_number": "REC-2026-001"
}
```
*Note: Security deposits use `contract_id` as the XOR target — `billing_id` must be `null`. This is the Dual-Path mechanism per BR-PAY-011.*

---

*Aligned to: SRS.md v5.2 · SDD.md v5.3 · DATABASE.md v5.3 · BUSINESS_RULES.md v2.3*  
*Last Updated: May 02, 2026 (v5.3 — Endpoint Expansion: Added all implemented endpoints from routes/api.php. Fixed HTTP methods for tenant archive. Corrected utility rate path. Added OAuth, restore, reactivate, billing wizard, and all report/export endpoints.)*
