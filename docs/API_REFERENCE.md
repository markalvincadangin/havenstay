# HavenStay API Reference

**Version:** 2.2  
**Last Updated:** April 17, 2026  
**Status:** Canonical integration contract for backend services; forensic alignment baseline

REST API for HavenStay BHMS (Laravel 13, Sanctum). Base path: **`/api`**.

## 1. Document Boundary
This document defines the technical interface contract between the HavenStay presentation layer and the application services. It specifies the endpoints, security schemes, request/response structures, and error modalities required to realize the capabilities defined in [**SRS.md**](SRS.md).

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
- **Correlation:** Every write operation generates a `correlation_id` which is returned in the response headers. This ID is used to link application actions to forensic audit and transaction logs.

### 2.3 Authentication and Role-Based Access
- **Scheme:** Bearer Token via Laravel Sanctum.
- **Header:** `Authorization: Bearer <token>`
- **Role Enforcement:** Access is validated via `AuthorizationService`.

| Role | Operational Scope |
| :--- | :--- |
| **Admin** | Full system management (Users, Audit, Finance) |
| **Staff** | Operational management (Tenants, Rooms, Contracts, Billing) |
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
| `GET` | `/api/users/roles` | Admin | FR-005 | List assignable roles |
| `GET` | `/api/users/{id}` | Admin | FR-005 | Retrieve detailed user profile |
| `PUT` | `/api/users/{id}` | Admin | FR-005 | Update profile (optional password change) |
| `POST` | `/api/users/{id}/deactivate`| Admin | FR-006 | Soft‑deactivate user (rejection on login) |
| `POST` | `/api/users/{id}/archive` | Admin | FR-007 | Hard‑archive / Soft‑delete account record |

### 3.3 Tenant Management
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/tenants` | All | FR-011 | List tenants (paginated) with occupancy context and outstanding balance fields |
| `GET` | `/api/tenants/search` | All | FR-011 | Wildcard search (LIKE) by name/contact |
| `GET` | `/api/tenants/summary` | All | FR-011a | KPI-optimized tenant listing |
| `POST` | `/api/tenants` | Staff | FR-008 | Register new tenant profile |
| `GET` | `/api/tenants/{id}` | All | FR-008 | View tenant profile and history |
| `PUT` | `/api/tenants/{id}` | Staff | FR-008 | Update tenant contact/profile |
| `POST` | `/api/tenants/{id}/deactivate` | Staff | FR-009 | Mark tenant as moved_out (blocked when active contract exists) |
| `POST` | `/api/tenants/{id}/reactivate` | Staff | FR-009 | Return moved_out tenant to active operational state |
| `POST` | `/api/tenants/{id}/archive` | Staff | FR-009 | Archive tenant (soft-delete) |
| `POST` | `/api/tenants/{id}/restore` | Staff | FR-009 | Restore archived tenant record from soft-delete |

### 3.4 Room and Bed Inventory
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/rooms` | All | FR-015 | List rooms with aggregated bed capacity |
| `GET` | `/api/rooms/stats` | All | FR-015a | Occupancy-optimized room metrics |
| `GET` | `/api/rooms/availability`| All | FR-015 | Filter beds by vacant status |
| `POST` | `/api/rooms` | Staff | FR-012 | Create new room entity |
| `GET` | `/api/rooms/{id}` | All | FR-012 | Room detail with nested bed spaces |
| `POST` | `/api/rooms/{id}/bed-spaces`| Staff| FR-014 | Add a bed space to an existing room |
| `POST` | `/api/rooms/{id}/archive`| Staff | FR-013 | Archive room (denied if beds are occupied) |

---

### 3.5 Operational Lifecycle (Contracts)
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/contracts` | All | FR-016 | Query operational contracts (by tenant/status) |
| `POST` | `/api/contracts` | Staff | FR-016 | Execute new contract (Check‑in) |
| `GET` | `/api/contracts/{id}` | All | FR-016 | Retrieve specific contract and row context |
| `PUT` | `/api/contracts/{id}` | Staff | FR-018 | Update contract metadata (e.g. deposit, notes) |
| `POST` | `/api/contracts/{id}/move-out`| Staff | FR-019 | Finalize move‑out (Move‑out timestamp) |

### 3.6 Financial Management (Billing)
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/billing` | All | FR-023 | List bill cycles with status and aging meta |
| `POST` | `/api/billing` | Staff | FR-020 | Bulk or manual bill cycle generation |
| `GET` | `/api/billing/{id}` | All | FR-021 | Detail view of billing and itemized charges |
| `PATCH` | `/api/billing/{id}/status` | Staff | FR-025a | Manually override cycle status |

### 3.7 Transaction Processing (Payments)
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/payments` | All | FR-027 | Global payment ledger (filter by void status) |
| `POST` | `/api/payments` | Staff | FR-024 | Post individual payment to a bill cycle |
| `GET` | `/api/payments/{id}` | All | FR-024 | View posted payment details |
| `DELETE` | `/api/payments/{id}` | Staff | FR-026 | Soft‑void payment and trigger recalculation |

---

### 3.8 Analytical Reports
All operational reports query standardized database views (CCR-005) and support optional pagination for large datasets. In accordance with **NFR-015**, PII (Personally Identifiable Information) data is masked/redacted for the Viewer role.

| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/reports/occupancy` | All | FR-028 | Aggregated room-level metrics |
| `GET` | `/api/reports/occupancy-status`| All | FR-028 | Bed‑level availability matrix |
| `GET` | `/api/reports/billing-summary` | All | FR-029 | Financial overview by date range |
| `GET` | `/api/reports/outstanding-balances`| All| FR-030 | Receivables aging and balance report |
| `GET` | `/api/reports/tenant-ledger` | All | FR-031 | Detailed transactional profile for one tenant |
| `GET` | `/api/reports/collections-performance`| All| FR-032 | Payment volume by method and period |
| `GET` | `/api/reports/*/export` | All | FR-028–032 | Streamed CSV datasets for all reports |

### 3.9 Forensic Auditing
| Method | Path | Access | FR | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/audit-logs` | Admin | FR-034 | Row‑level change logs (trigger‑written) |
| `GET` | `/api/audit-logs/export` | Admin | FR-034 | Full forensic change log in CSV format |
| `GET` | `/api/transaction-logs` | Admin | FR-035 | Workflow outcome logs (started/committed) |

---

## 4. Error Modalities

| HTTP | Message Pattern | Rationale |
| :--- | :--- | :--- |
| **401** | `Unauthenticated.` | Missing or expired Sanctum token |
| **403** | `User does not have the right roles.` | Role‑based permission violation |
| **404** | `Not Found.` | Resource (ID) does not exist |
| **409** | `Conflict.` | State machine violation (e.g. archiving occupied room) |
| **422** | `The given data was invalid.` | Payload validation failure (includes `errors` map) |

---

*Aligned to: SRS.md v4.7 · SDD.md v3.2 · routes/api.php*  
*Last Updated: April 17, 2026 (v2.2 — final audit alignment pass)*
