# HavenStay API Reference

**Version:** 3.8  
**Last Updated:** April 20, 2026  
**Status:** Canonical integration contract for backend services; forensic alignment baseline (v4.8 engine)

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

---

## 3. Core Resource Endpoints

### 3.1 Authentication and Public Access
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | FR-001 | Issue session token via credentials |
| `POST` | `/api/auth/logout` | All | FR-001 | Revoke current token |
| `GET` | `/api/auth/me` | All | FR-002 | Get current user and role profile |
| `GET` | `/api/health` | Public | — | Liveness/Health check |

### 3.2 User Management
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/users` | Admin | FR-005 | Query user accounts (filter by role/status) |
| `POST` | `/api/users` | Admin | FR-005 | Provision new user account |
| `GET` | `/api/users/{id}` | Admin | FR-005 | Retrieve detailed user profile |
| `PUT` | `/api/users/{id}` | Admin | FR-005 | Update profile (optional password change) |
| `POST` | `/api/users/{id}/deactivate`| Admin | FR-006 | Soft‑deactivate user (rejection on login) |
| `POST` | `/api/users/{id}/archive` | Admin | FR-007 | Hard‑archive / Soft‑delete account record |

### 3.3 Tenant Management
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/tenants` | All | FR-011 | List tenants with occupancy context and balances |
| `GET` | `/api/tenants/search` | All | FR-011 | Wildcard search (LIKE) by name/contact |
| `POST` | `/api/tenants` | Staff | FR-008 | Register new tenant profile |
| `GET` | `/api/tenants/{id}` | All | FR-008 | View tenant profile and history |
| `PUT` | `/api/tenants/{id}` | Staff | FR-008 | Update tenant contact/profile |
| `PATCH` | `/api/tenants/{id}/archive` | Staff | BR-TEN-005 | Change operational status to `archived` |
| `DELETE`| `/api/tenants/{id}` | Staff | FR-009 | Archive tenant profile (forensic soft-delete) |

### 3.4 Room and Bed Inventory
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/rooms` | All | FR-016 | List rooms with aggregated bed capacity |
| `GET` | `/api/rooms/availability`| All | FR-016 | Filter beds by vacant status |
| `POST` | `/api/rooms` | Staff | FR-013 | Create new room entity |
| `GET` | `/api/rooms/{id}` | All | FR-013 | Room detail with nested bed spaces |
| `POST` | `/api/rooms/{id}/bed-spaces`| Staff| FR-015 | Add a bed space to an existing room |
| `POST` | `/api/rooms/{id}/archive`| Staff | FR-017 | Archive room (denied if beds are occupied) |

### 3.5 Operational Lifecycle (Contracts)
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/contracts` | All | FR-021 | Query operational contracts (by tenant/status) |
| `POST` | `/api/contracts` | Staff | FR-018 | Execute new contract (Check‑in) |
| `GET` | `/api/contracts/{id}` | All | FR-021 | Retrieve specific contract and row context |
| `PUT` | `/api/contracts/{id}` | Staff | FR-021 | Update contract metadata (e.g. deposit, notes) |
| `POST` | `/api/contracts/{id}/deposit` | Staff | BR-CON-006 | Record direct deposit/bond payment |
| `POST` | `/api/contracts/{id}/refund` | Admin | BR-PAY-008 | Record security deposit refund disbursement |
| `POST` | `/api/contracts/{id}/rollover`| Staff | BR-PAY-009 | Record security deposit rollover for renewal |
| `POST` | `/api/contracts/{id}/move-out`| Staff | FR-022 | Finalize move‑out processing |

### 3.6 Meter and Utility Asset Management
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/utilities` | All | FR-024 | List all supported utilities (Electricity, Water, etc.) |
| `POST` | `/api/utilities` | Admin | FR-024 | Register a new billable utility service type |
| `GET` | `/api/meters` | All | FR-024 | Query physical meter registry |
| `POST` | `/api/meters` | Admin | FR-024 | Register new physical meter |
| `GET` | `/api/utility-rates` | All | FR-028 | List current and historical utility rates |
| `POST` | `/api/utility-rates` | Admin | FR-028 | Create a new utility rate (effective-from) |
| `POST` | `/api/meters/{id}/assignments` | Staff | FR-025 | Map a meter to a specific room |
| `POST` | `/api/meters/{id}/readings` | Staff | FR-026 | Record point-in-time consumption |
| `POST` | `/api/meters/{id}/decommission` | Admin | FR-031 | Transition meter to `replaced` status |

### 3.7 Financial Management (Billing)
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/billing` | All | FR-032 | List bill cycles with status and aging meta |
| `POST` | `/api/billing` | Staff | FR-032 | Billing generation (itemized line items) |
| `GET` | `/api/billing/{id}` | All | FR-033 | Detail view of billing and itemized charges |
| `GET` | `/api/billing/{id}/forecast` | Staff | FR-029 | Preview utility charge apportionment for rooms |

### 3.8 Transaction Processing (Payments)
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/payments` | All | FR-044 | Global payment ledger (filter by void status) |
| `POST` | `/api/payments` | Staff | FR-039 | Post individual payment to a bill cycle |
| `GET` | `/api/payments/{id}` | All | FR-039 | View posted payment details |
| `POST` | `/api/payments/{id}/void` | Staff | FR-043 | Soft‑void payment (requires `void_reason`) |

### 3.9 Analytical Reports (Admin Only)
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/reports/occupancy` | Admin | FR-045 | Aggregated room-level metrics |
| `GET` | `/api/reports/occupancy-status`| Admin | FR-045 | Bed‑level availability matrix |
| `GET` | `/api/reports/billing-summary` | Admin | FR-046 | Financial overview by date range |
| `GET` | `/api/reports/outstanding-balances`| Admin | FR-047 | Receivables aging and balance report |
| `GET` | `/api/reports/tenant-ledger` | Admin | FR-051 | Detailed transactional profile for one tenant |
| `GET` | `/api/reports/collections-performance`| Admin | FR-048 | Payment volume by method and period |
| `GET` | `/api/reports/*/export` | Admin | FR-053 | Streamed CSV datasets for all reports |

### 3.10 Forensic Auditing
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/audit-logs` | Admin | FR-054 | Row‑level change logs (trigger‑written) |
| `GET` | `/api/audit-logs/export` | Admin | FR-053 | Export audit dataset to CSV for forensic review |

---

## 4. Error Modalities

| HTTP | Message Pattern | Rationale |
| :--- | :--- | :--- |
| **401** | `Unauthenticated.` | Missing or expired Sanctum token |
| **403** | `User does not have the right roles.` | Role‑based permission violation |
| **404** | `Not Found.` | Resource (ID) does not exist |
| **409** | `Conflict.` | State machine violation (e.g. archiving occupied room) or Unique Constraint violation (Active records only) |
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
*Note: `reading_ids` are for forensic linkage; amounts are calculated per BR-MET-008 and BR-MET-011.*

### 5.3 Configure a Utility Rate
`POST /api/utility-rates`
```json
{
  "utility_id": 1,
  "base_rate": 15.50,
  "effective_from": "2026-05-01"
}
```
*Note: Utility rates are temporal. The system applies the most recent rate whose `effective_from` date is on or before the billing period start.*

### 5.4 Void a Payment
`POST /api/payments/{id}/void`
```json
{
  "void_reason": "Incorrect amount entered; resident actually paid ₱500.00 via GCash."
}
```
*Note: Voiding is a forensic operation. The system retains the original record but excludes it from balance computations per BR-PAY-007.*

---

*Aligned to: SRS.md v4.6 · SDD.md v4.6 · DATABASE.md v4.8*  
*Last Updated: April 20, 2026 (v3.8 — 44-trigger forensic hardening pass)*
