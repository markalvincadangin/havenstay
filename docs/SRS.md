# HavenStay Boarding House Management System (BHMS)
## Software Requirements Specification (SRS)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [External Interface Requirements](#3-external-interface-requirements)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Data Requirements](#6-data-requirements)
7. [Business Rules](#7-business-rules)
8. [Prioritized Product Backlog](#8-prioritized-product-backlog)
9. [Acceptance and Test Readiness](#9-acceptance-and-test-readiness)
10. [Risks and Mitigations](#10-risks-and-mitigations)
11. [Appendices](#11-appendices)

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) defines the functional and non-functional requirements for the HavenStay Boarding House Management System (BHMS). It serves as the baseline for design, development, testing, and academic evaluation of the system.

### 1.2 Scope
HavenStay BHMS is a centralized web-based system for managing boarding house operations. The system covers:
- Tenant profile management
- Room and bed inventory management
- Rental agreement lifecycle management
- Billing and payment recording (including void support)
- Occupancy and vacancy monitoring
- Role-based access control and audit logging
- Operational and financial reporting

Out of scope for Release 1:
- Online payment gateway integration
- SMS or email notification automation
- Native mobile application
- Self-service password reset

### 1.3 Intended Audience
- Product owner and property managers
- Developers and QA engineers
- UI/UX designers
- Academic evaluators and project stakeholders

### 1.4 Definitions and Acronyms

| Term | Definition |
| :--- | :--- |
| **BHMS** | Boarding House Management System |
| **SRS** | Software Requirements Specification |
| **SDD** | System Design Document |
| **RBAC** | Role-Based Access Control |
| **UAT** | User Acceptance Testing |
| **CCR** | Course Compliance Requirement |
| **FR** | Functional Requirement |
| **NFR** | Non-Functional Requirement |
| **Contract** | Rental agreement between a tenant and a bed space |
| **Bed-level occupancy** | Tracking occupancy per individual bed space within a room |
| **Void** | Soft cancellation of a posted payment; record retained for audit |

### 1.5 References
- [**CASE_STUDY.md**](CASE_STUDY.md) — Business context and problem statement
- [**SDD.md**](SDD.md) — System design and database architecture
- [**TEST_PLAN.md**](TEST_PLAN.md) — Test strategy and test case definitions
- [**PROJECT_PLAN.md**](PROJECT_PLAN.md) — Execution schedule and milestones
- [**havenstay_schema.sql**](../db/havenstay_schema.sql) — Authoritative database schema

### 1.6 Academic and Course Compliance Requirements

> [!IMPORTANT]
> **This section is a primary constraint of the project.** HavenStay is an academic deliverable for the Information Management course. The following course-mandated requirements (CCR) are binding technical constraints with equal priority to product functional requirements. All CCR items must be demonstrable with evidence during system evaluation and defense.

| ID | Requirement | Priority | Implementation Status |
| :--- | :--- | :--- | :--- |
| **CCR-001** | Include at least six (6) core entities in the relational data model. | **Required** | Satisfied — 11 tables in schema |
| **CCR-002** | Utilize a distributed database architecture (Primary-Replica model). | **Required** | Satisfied — documented in `docs/DISTRIBUTED_DB_SETUP.md` |
| **CCR-003** | Implement core SQL CRUD operations: SELECT, INSERT, UPDATE, DELETE. | **Required** | Satisfied — exercised across all service modules |
| **CCR-004** | Implement SQL operators including AND, OR, BETWEEN, and LIKE. | **Required** | Satisfied — LIKE in search; BETWEEN in date-range reports |
| **CCR-005** | Implement SQL joins for multi-table data retrieval. | **Required** | Satisfied — 6 reporting views with INNER and LEFT JOINs |
| **CCR-006** | Implement transaction control (START TRANSACTION, COMMIT, ROLLBACK). | **Required** | Satisfied — `DB::transaction()` on all critical write workflows |
| **CCR-007** | Maintain transaction logs to support reliability and auditability. | **Required** | Satisfied — `transaction_logs` table; `started` / `committed` / `rolled_back` / `failed` states |
| **CCR-008** | Implement database triggers for change logging on transactional tables. | **Required** | Satisfied — 24 AFTER triggers on 8 core tables |

**Compliance mapping:** All CCR items are mapped to specific functional requirements in Section 4.11, to design decisions in `docs/SDD.md`, and to test evidence in `docs/TEST_PLAN.md`.

---

## 2. Overall Description

### 2.1 Product Perspective
HavenStay BHMS replaces fragmented paper records and spreadsheets with a single relational database-backed application. It is intended for small-scale boarding house operations and supports single-branch deployment.

### 2.2 Product Functions (High-Level)
- Manage tenants and historical tenant records
- Manage room and bed inventory with real-time occupancy status
- Create and maintain rental contracts (linked to a specific bed space)
- Generate monthly billing with itemized line items and track due dates
- Record payments and compute outstanding balances dynamically
- Void payments while preserving the financial audit trail
- Generate reports (occupancy, receivables, collections)
- Manage users, roles, and audit trails

### 2.3 User Classes

**Owner / Admin**
- Full system access
- Manages users, roles, contracts, billing, and reports

**Staff / Manager**
- Daily operations access: tenant, room, contracts, billing, payments
- Cannot access user and role administration

**Viewer**
- Read-only access to reports and module lists
- Cannot create or modify any records

### 2.4 Operating Environment
- Web browser (latest Chrome, Edge, Firefox)
- Server-hosted web application
- Relational database: MySQL 8.4+ (primary) / SQLite (development only)
- Local network or internet access

---

## 3. External Interface Requirements

### 3.1 User Interface
- Responsive web UI built with Next.js 16 and Tailwind CSS v4
- Sidebar navigation with role-aware menu items
- Design system components: Card, Table, StatusBadge, Field, Button, Alert
- Mobile hamburger drawer at tablet breakpoint (768–1023px)
- Desktop layout: 240px fixed sidebar, content max-width 1280px

### 3.2 API Interface
- RESTful JSON API served by Laravel 13
- All protected endpoints require `Authorization: Bearer {token}` header
- Error responses follow the format: `{ message, errors? }`
- Authentication via `POST /api/auth/login` returning a Sanctum bearer token

---

## 4. Functional Requirements

### 4.1 Authentication and Access Control
- **FR-001:** The system shall require user authentication via username and password before granting access to any protected resource.
- **FR-002:** The system shall enforce role-based permissions (Admin, Staff, Viewer) on all modules via `AuthorizationService`.
- **FR-003:** The system shall log login, logout, and access-denied events to `audit_logs`.
- **FR-004:** The system shall reject login attempts from deactivated users (`is_active = 0`).

### 4.2 User Management
- **FR-005:** Admin users shall be able to create (with username, password, role, and email), deactivate, and reactivate system user accounts.
- **FR-006:** Admin users shall be able to assign and change user roles.
- **FR-007:** Usernames shall be unique across all user accounts.

### 4.3 Tenant Management
- **FR-008:** The system shall support creating and updating tenant profiles (name, contact, email, emergency contact, address).
- **FR-009:** Tenant records shall never be hard-deleted; they shall be soft-deactivated with status `moved_out` or `archived`.
- **FR-010:** The system shall maintain full tenant history including all past contracts.
- **FR-011:** The system shall support searching tenants by name, contact number, or status using LIKE pattern matching (CCR-004).

### 4.4 Room and Bed Space Management
- **FR-012:** The system shall support creating and updating room records (room number, type, capacity, monthly rate, status, amenities).
- **FR-013:** Room status shall be automatically synchronized with bed space occupancy via `RoomService::syncStatusAndCapacity()`. If a room has zero `vacant` bed spaces (i.e., all beds are `occupied` or `maintenance`), the room status shall be updated to `unavailable`.
- **FR-014:** Shared rooms shall support bed-level occupancy tracking via the `bed_spaces` entity. `bed_spaces.status` values are `vacant`, `occupied`, and `maintenance`.
- **FR-015:** The system shall provide real-time occupancy availability per room and per bed space.
- **FR-015a:** `rooms.status` ENUM values are `available`, `unavailable`, and `maintenance`. The value `occupied` is NOT valid for the `rooms` table (use `unavailable` instead), but it IS valid for the `bed_spaces` table.

### 4.5 Contract Management
- **FR-016:** The system shall create rental contracts linking a tenant to a specific bed space.
- **FR-016a:** Contracts link to a `bed_space_id`, not a `room_id`. Room context is derived via the bed space relationship.
- **FR-017:** The system shall prevent double-occupancy: one active contract per tenant and one active contract per bed space.
- **FR-018:** The system shall support viewing full contract details including tenant, bed space, room, move-in date, and deposit.
- **FR-019:** The system shall support move-out processing that marks the contract completed and releases the bed space to `vacant`.

### 4.6 Billing Management
- **FR-020:** The system shall generate billing cycle records for active contracts.
- **FR-021:** Billing entries shall support itemized charges via `billing_line_items` (types: `base_rent`, `utility`, `add_on`, `penalty`, `adjustment`).
- **FR-021a:** The `billing` table has no `amount_due` or `amount_paid` columns. Both values are computed dynamically from `billing_line_items` and non-voided `payments` respectively.
- **FR-021b:** Adjustment line items may have negative values (deductions), but the calculated total amount for a billing record MUST NOT be negative.
- **FR-022:** The system shall prevent duplicate billing cycles for the same contract and period.
- **FR-023:** Line item amounts shall not be zero (enforced by DB CHECK constraint). Over-billing (charging more than the contract rate without adjustment) is discouraged but permitted for utility/penalty flexibility.

### 4.7 Payment Processing
- **FR-024:** The system shall record payments against a billing record within an atomic transaction (CCR-006).
- **FR-025:** The system shall recompute billing status after every payment post and payment void via `BillingService::autoUpdateStatus()`.
- **FR-026:** The system shall support soft-voiding a payment. Voided payments set `voided_at`, `voided_by`, and `void_reason`; the row is never deleted.
- **FR-026a:** All balance computations must exclude voided payments (`WHERE voided_at IS NULL`).
- **FR-027:** The system shall maintain a history of all payments including voided records, filterable by tenant, contract, or billing ID.

### 4.8 Reporting
- **FR-028:** The system shall provide an occupancy report via `vw_room_occupancy` showing bed counts and occupancy rates per room.
- **FR-029:** The system shall provide a billing and collections summary via `vw_billing_summary` with date-range filtering (CCR-004: BETWEEN).
- **FR-030:** The system shall provide an outstanding balances report via `vw_billing_summary` filtered for records with `total_amount > total_paid`.
- **FR-031:** All report data shall be computed via SQL views to demonstrate CCR-005 JOIN compliance.
- **FR-032:** The system shall support CSV export for all report types.
- **FR-032a:** The system shall provide a Detailed Tenant Ledger view showing the full financial history (billings and payments) for a selected tenant.
- **FR-032b:** The system shall provide a Collections Performance report showing total payments collected within a specific date range.

### 4.9 Audit and Transaction Logging
- **FR-033:** All INSERT, UPDATE, and DELETE operations on core tables shall be captured in `audit_logs` via database-level **triggers** (CCR-008). This ensures no data change goes unrecorded, even if done via direct SQL.
- **FR-034:** All critical business and financial write workflows (tenant check-in, move-out, payment post, payment void) shall produce `transaction_logs` entries with `started` / `committed` / `rolled_back` / `failed` states (CCR-007). These are managed at the **application/service level** to track the success of complex logic.
- **FR-035:** Transaction log entries shall be inserted before `DB::transaction()` so that failure records persist through rollback.

### 4.10 Data Integrity
- **FR-036:** Foreign key constraints shall be enforced at the database level with explicit `ON DELETE` behavior.
- **FR-037:** The one-active-contract-per-tenant and one-active-contract-per-bed-space rules shall be enforced in `ContractService` before the transaction opens.
- **FR-038:** Monetary values shall use `DECIMAL(10,2)` and never fall below zero (CHECK constraints).
- **FR-039:** Room status shall always reflect actual bed space occupancy (enforced by `RoomService::syncStatusAndCapacity()`).

### 4.11 Course Compliance Requirements (CCR)
- **FR-040:** The system shall demonstrate SQL SELECT operations across all module list and get endpoints (CCR-003).
- **FR-041:** The system shall demonstrate SQL INSERT in contract creation, billing generation, and payment posting (CCR-003).
- **FR-042:** The system shall demonstrate SQL UPDATE in move-out processing, billing status transitions, and payment void (CCR-003).
- **FR-042a:** The system shall demonstrate SQL DELETE in room management when removing bed spaces from a shared room (CCR-003).
- **FR-043:** The system shall demonstrate LIKE, AND, OR, and BETWEEN operators in tenant search and report date filters (CCR-004).
- **FR-044:** The system shall demonstrate multi-table JOINs via the six reporting views (CCR-005).
- **FR-045:** The system shall demonstrate explicit transaction control and change logging via `DB::transaction()`, `transaction_logs`, and 24 AFTER triggers (CCR-006, CCR-007, CCR-008).

---

## 5. Non-Functional Requirements

### 5.1 Performance
- **NFR-001:** List endpoints shall respond within 2 seconds under normal load.
- **NFR-002:** Report endpoints shall respond within 5 seconds for datasets up to 1,000 records.

### 5.2 Security
- **NFR-003:** Passwords shall be stored as bcrypt hashes; plaintext passwords shall never be logged or returned.
- **NFR-004:** All API endpoints except login shall require a valid Sanctum bearer token.
- **NFR-005:** Role-based authorization shall be enforced via `AuthorizationService` on every protected endpoint.

### 5.3 Reliability
- **NFR-006:** Financial write operations shall be atomic; partial writes shall be prevented by `DB::transaction()`.
- **NFR-007:** The system shall maintain a complete audit trail of all data changes via database triggers.

### 5.4 Maintainability
- **NFR-008:** Business logic shall reside in service classes, not controllers or models.
- **NFR-009:** Authorization decisions shall use `AuthorizationService` exclusively; Laravel Gates and Policies shall not be used.

---

## 6. Data Requirements

### 6.1 Core Entities
See `docs/SDD.md` Section 4.2 for the complete entity table.

### 6.2 Key Constraints
- `billing_line_items.amount` ≠ 0 (DB CHECK)
- `payments.amount_paid` > 0 (DB CHECK)
- `rooms.monthly_rate` ≥ 0 (DB CHECK)
- `contracts.deposit_amount` ≥ 0 (DB CHECK)
- `uq_billing_cycle` — unique on `(contract_id, billing_period_from, billing_period_to)`
- `uq_bed_space_per_room` — unique on `(room_id, bed_label)`

### 6.3 Status Values

| Entity | Field | Valid Values |
| :--- | :--- | :--- |
| `tenants` | `status` | `active`, `moved_out`, `archived` |
| `rooms` | `status` | `available`, `unavailable`, `maintenance` |
| `bed_spaces` | `status` | `vacant`, `occupied`, `maintenance` |
| `contracts` | `status` | `active`, `completed`, `terminated` |
| `billing` | `status` | `unpaid`, `partial`, `paid`, `overdue` |
| `payments` | `payment_method` | `cash`, `gcash`, `bank_transfer`, `other` |
| `audit_logs` | `action` | `create`, `update`, `delete`, `login`, `logout`, `access_denied`, `status_change` |
| `transaction_logs` | `status` | `started`, `committed`, `rolled_back`, `failed` |

---

## 7. Business Rules

- **BR-001:** Rent is billed monthly per active contract as a `base_rent` line item.
- **BR-002:** Deposits are recorded as `deposit_amount` on the contract, not as billing line items.
- **BR-003:** Utilities and add-ons are added per billing cycle as separate line items.
- **BR-004:** A billing record is `overdue` when `total_paid = 0` and `due_date < today`.
- **BR-005:** Move-out requires the contract to have `status = active`; the process atomically completes the contract and releases the bed space.
- **BR-006:** Historical records (tenants, contracts, payments) are never hard-deleted.
- **BR-007:** Voiding a payment sets `voided_at` and triggers a billing status recalculation.
- **BR-008:** `BillingService::autoUpdateStatus()` is the single source of truth for billing status. The `Billing::updateStatus()` model method is deprecated and must not be called.

---

## 8. Prioritized Product Backlog

| Priority | Item | FR Reference | Status |
| :--- | :--- | :--- | :--- |
| P1 | Authentication and RBAC | FR-001–004 | Complete |
| P1 | Tenant CRUD and search | FR-008–011 | Complete |
| P1 | Room and bed space management | FR-012–015 | Complete |
| P1 | Contract creation and move-out | FR-016–019 | Complete |
| P1 | Billing generation with line items | FR-020–023 | Complete |
| P1 | Payment recording with transaction logs | FR-024–027 | Complete |
| P1 | Payment void | FR-026 | Complete |
| P1 | Reporting views (CCR-005) | FR-028–032 | Complete |
| P1 | Audit triggers (CCR-008) | FR-033–035 | Complete (24 triggers) |
| P2 | User management UI | FR-005–007 | Complete — list, register, edit, deactivate/reactivate, role assignment |
| P2 | Dashboard with live data | — | Complete — KPIs from reports/tenants/billing/payments APIs |
| P3 | Billing line items triggers | CCR-008 | Complete |
| P3 | Online payment gateway | — | Out of scope |

---

## 9. Acceptance and Test Readiness

Tests are defined in `docs/TEST_PLAN.md`. Critical test IDs that must pass:

| Test ID | Covers |
| :--- | :--- |
| TC-AUTH-001/002/003 | Login, rejection, RBAC |
| TC-CONTRACT-002 | Tenant overlap prevention |
| TC-CONTRACT-004 | Bed space overlap prevention |
| TC-BILLING-004 | Zero-amount line item rejection |
| TC-PAYMENT-003 | Invalid amount rejection |
| TC-TX-001/002/003 | Payment post commit and rollback paths |
| TC-TX-004/005/006 | Move-out commit and rollback paths |
| TC-TRIGGER-001/002/003 | AFTER INSERT/UPDATE/DELETE audit capture |
| TC-CCR-006 | Rollback prevents partial writes |
| TC-CCR-008 | Trigger-based CRUD logging |

---

## 10. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| CCR evidence not demonstrable on SQLite | Low | High | All CCR evidence captured on MySQL; SQLite used for unit tests only |
| Billing status inconsistency after void | Low | High | `autoUpdateStatus()` called after every payment write; model method deleted |
| `rooms.status` ENUM mismatch (`'occupied'`) | Low | Medium | `Room` model constants enforced; `syncStatusAndCapacity()` uses `STATUS_UNAVAILABLE` |
| Gate/Policy calls bypassing `AuthorizationService` | Low | High | Audited across all controllers; `AuthorizationService` is the only permitted path |

---

## 11. Appendices

### 11.1 Revision History

| Version | Date | Changes |
| :--- | :--- | :--- |
| v1.0 | 2026-03-27 | Initial SRS created. |
| v1.1 | 2026-03-27 | Added CCR compliance section. |
| v1.2 | 2026-03-27 | Added trigger-based CRUD logging requirements. |
| v1.3 | 2026-03-27 | Added test readiness section. |
| v1.4 | 2026-03-27 | Added business rules and backlog. |
| v1.5 | 2026-04-09 | Major restructure: Table of Contents, functional links, professional formatting. |
| v1.6 | 2026-04-09 | Professional overhaul and formatting standardization. |
| v1.7 | 2026-04-10 | Schema-accurate corrections: FR-016a (contracts use `bed_space_id`, no `room_id`); FR-021a (billing has no amount columns); FR-015a (rooms ENUM corrected to `unavailable`); FR-026/026a (void support formalized); BR-007/008 added; BUG references added to backlog; risks table updated. |
| v1.8 | 2026-04-11 | Bugfix synchronization: Backlog updated to reflect BUG-001 through BUG-009 resolution; risk mitigations updated; version aligned with SDD v1.9. |
| v1.9 | 2026-04-11 | Reporting Expansion: Added Collections Performance report (FR-032b); CCR-005 reporting views expanded (final counts in v2.1). |
| v2.0 | 2026-04-11 | Audit & Nomenclature Parity: Upgraded `audit_logs` to capture full attribute snapshots; implemented 24 triggers total; achieved 100% nomenclature parity (Resident -> Tenant) across codebase and documentation. |
| **v2.1** | **2026-04-11** | **Synchronization Finalization:** Corrected CCR counts to 6 views and 24 triggers; verified billing line item triggers as complete and traceable. |

---

*Aligned to: SDD.md v2.3 · havenstay_schema.sql (canonical) · CLAUDE.md · docs/API_REFERENCE.md*
*Last Updated: April 2026*
