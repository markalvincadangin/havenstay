# HavenStay Boarding House Management System (BHMS)
## Software Requirements Specification (SRS)

**Version:** 5.2  
**Last Updated:** April 29, 2026  
**Status:** Canonical behavioral baseline and forensic requirement specification

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [External Interface Requirements](#3-external-interface-requirements)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Data Requirements](#6-data-requirements)
7. [Course Compliance Requirements (CCR)](#7-course-compliance-requirements-ccr)
8. [Prioritized Product Backlog](#8-prioritized-product-backlog)
9. [Acceptance Criteria and Test Readiness](#9-acceptance-criteria-and-test-readiness)
10. [Risks and Mitigations](#10-risks-and-mitigations)
11. [Revision History](#11-revision-history)

---

## 1. Introduction

### 1.1 Purpose
This SRS defines the functional and non-functional requirements for the HavenStay Boarding House Management System (BHMS). It is the authoritative reference for system design, development, testing, and academic evaluation.

### 1.2 Scope
HavenStay BHMS is a centralized web-based system for managing boarding house operations. The system covers:

- Tenant profile management and history
- Room and bed space inventory with real-time occupancy tracking
- Rental contract lifecycle (fixed-term and month-to-month)
- Utility meter management and consumption tracking
- Billing generation with itemized line items including utility charges
- Payment recording, void support, and balance computation
- Occupancy, financial, and collection reporting
- Role-based access control (Admin, Staff, Viewer)
- Audit logging and change forensics

**Out of scope for the current release:**
- Online payment gateway integration
- Automated billing schedule (billing remains manual; auto-billing is planned for a future release)
- SMS or email notification automation
- Native mobile application
- Self-service tenant portal

### 1.3 Definitions

| Term | Definition |
| :--- | :--- |
| **BHMS** | Boarding House Management System |
| **SRS** | Software Requirements Specification |
| **BR** | Business Rule (see [**BUSINESS_RULES.md**](../BUSINESS_RULES.md)) |
| **CCR** | Course Compliance Requirement |
| **FR** | Functional Requirement |
| **NFR** | Non-Functional Requirement |
| **Contract** | Rental agreement linking a tenant to a specific bed space |
| **Bed-level occupancy** | Tracking occupancy per individual bed space within a room |
| **Void** | Soft cancellation of a posted payment; record is retained for audit |
| **Meter** | Physical device measuring utility consumption |
| **Meter Reading** | A recorded consumption value from a meter at a point in time |
| **Utility Rate** | A point-in-time unit price for a utility type |

### 1.4 References
- [**BUSINESS_RULES.md**](../BUSINESS_RULES.md) — Authoritative business rules (all BR references below)
- [**SDD.md**](SDD.md) — System Design Document
- [**TEST_PLAN.md**](TEST_PLAN.md) — Test strategy and cases
- [**havenstay_schema.sql**](../db/havenstay_schema.sql) — Database schema (updated to reflect v4.2)

---

## 2. Overall Description

### 2.1 Product Perspective
HavenStay BHMS replaces fragmented paper records and spreadsheets with a single relational database-backed application for small-scale boarding house operations. It is intended for single-branch deployment operated by an owner and a small staff team (1–3 people).

### 2.2 Product Functions
- Manage tenants and full tenant history
- Manage room and bed space inventory with real-time status
- Create and manage rental contracts (fixed-term and month-to-month)
- Record meter readings for electricity and water
- Generate monthly billing with itemized line items including computed utility charges
- Record payments and dynamically compute outstanding balances
- Void payments while preserving the financial audit trail
- Generate operational and financial reports
- Manage users, roles, and complete audit trails

### 2.3 User Classes
- **Admin**: Full system access. Manages users, roles, all operational modules, audit log inspection, all reporting engines, and system configuration.
- **Staff**: Daily operations access: tenants, rooms, contracts, billing, payments, and meter readings. Cannot manage user accounts, view audit logs, or access the reporting engine.
- **Viewer**: Read-only access to operational module lists (Tenants, Rooms, Contracts). Cannot access the reports module or modify any record.

### 2.4 Operating Environment
- Web browser (latest Chrome, Edge, Firefox)
- Server-hosted web application
- Relational database: MySQL 8.4+
- Local network or internet access

---

## 3. External Interface Requirements

### 3.1 User Interface
- Responsive web UI (Next.js, Vanilla CSS with custom design system)
- Sidebar navigation with role-aware menu visibility
- Mobile hamburger drawer at tablet breakpoint
- Design system components: Card, Table, StatusBadge, Field, Button, Alert, KpiCard, FilterChips, EmptyState
- Skeleton loading states on all data-heavy views

### 3.2 API Interface
- RESTful JSON API (Laravel)
- All protected endpoints require `Authorization: Bearer {token}`
- Error responses: `{ message, errors? }`
- Authentication: `POST /api/auth/login` returning a bearer token

---

## 4. Functional Requirements

### 4.1 Authentication and Access Control
**FR-001** 
The system shall require username and password authentication before granting access to any protected resource.

**FR-002** 
The system shall enforce role-based permissions (Admin, Staff, Viewer) on all modules. Ref: BR-GEN-003, BR-GEN-004.

**FR-003** 
The system shall log login, logout, and access-denied events. Ref: BR-AUD-001.

**FR-004** 
The system shall reject login from deactivated user accounts.

### 4.2 User Management
**FR-005** 
Admin shall be able to create, deactivate, and reactivate staff user accounts with username, password, email, and role assignment. Ref: BR-GEN-001.

**FR-006** 
Admin shall be able to reassign a user's role at any time. Ref: BR-GEN-003.

**FR-007** 
Usernames and email addresses shall be unique across all users. Ref: BR-GEN-001.

### 4.3 Tenant Management
**FR-008** 
The system shall support creating and updating tenant profiles capturing all fields required by BR-TEN-001.

**FR-009** 
Tenant records shall never be hard-deleted. Soft delete (`deleted_at`) is used to preserve referential history. Ref: BR-GEN-002.

**FR-010** 
The system shall maintain the full tenant contract history including all past and terminated contracts.

**FR-011** 
The system shall support searching tenants by name, contact number, email, or status. (CCR-004: LIKE)

**FR-012** 
Tenant status shall be automatically derived from contract state per BR-TEN-004. Admin may manually archive a tenant (BR-TEN-005).

### 4.4 Room and Bed Space Management
**FR-013** 
The system shall support creating and updating room records (room code, type, capacity, monthly rate, status, amenities, description). Ref: BR-ROM-001, BR-ROM-002.

**FR-014** 
Room status shall be automatically derived from bed space occupancy per BR-ROM-003. Room status may not be manually set to `occupied`.

**FR-015** 
The system shall support bed-level occupancy tracking per BR-ROM-004 through BR-ROM-006.

**FR-016** 
The system shall provide real-time occupancy availability per room and per bed space.

**FR-017** 
Staff shall be able to place a room or individual bed space into `maintenance` status, which prevents new contract assignment. Ref: BR-ROM-003, BR-ROM-005.

### 4.5 Contract Management
**FR-018** 
The system shall create contracts linking one tenant to one bed space per BR-CON-001 through BR-CON-006, and handle contract renewals per BR-CON-011.

**FR-019** 
The system shall support both `fixed_term` and `month_to_month` contract types per BR-CON-004.

**FR-020** 
The system shall prevent double-occupancy per BR-TEN-003 and BR-CON-003, with strict exceptions for contiguous contract renewals per BR-CON-011.

**FR-021** 
The system shall display full contract details including tenant, bed space, room, contract type, move-in date, expected move-out date, monthly rate, and deposit.

**FR-022**    
The system shall support move-out processing per BR-CON-007 and BR-CON-008.

**FR-023**
The system shall support early contract termination by Admin per BR-CON-009.

### 4.6 Meter Management
**FR-024**
The system shall maintain a register of physical utility meters, each identified by a unique serial number and utility type (electricity or water). Ref: BR-MET-001.

**FR-025**
The system shall support assigning meters to rooms with an effective-from date. A meter is assigned to exactly one room at any given time. The assignment history is retained, allowing staff to track meter reassignments between rooms over time. Ref: BR-MET-003.

**FR-026**
Staff shall be able to record meter readings for an active meter. The system shall reject readings that violate the monotonicity rule. Ref: BR-MET-004, BR-MET-005.

**FR-027**
The system shall compute consumption for a billing period from paired meter readings per BR-ANL-002.

**FR-028**
The system shall maintain utility rates per utility type with effective-from dates and apply the correct rate per BR-MET-006.

**FR-029**
When generating a billing cycle, the system shall calculate the total utility charge (consumption × applicable rate) per BR-MET-007. For shared rooms, the system shall automatically divide this charge equally among active contracts per BR-MET-010. Rounding differentials (e.g., ₱0.01) shall be reconciled by applying the orphan amount to the earliest created active contract in the group. The system shall present the calculated apportionment to the staff member as a reference amount. Staff may accept or override the calculated amount and must record a reason for any override.

**FR-030**
A meter reading may be linked to a billing cycle to create a traceable audit trail per BR-MET-008.

**FR-031**
The system shall support decommissioning a meter (status `replaced`) while retaining all historical readings. Ref: BR-MET-009.

### 4.7 Billing Management
**FR-032**
The system shall generate billing cycle records for active contracts per BR-BIL-001 through BR-BIL-003.

**FR-033**
Each billing cycle shall support itemized line items per BR-BIL-004 and BR-BIL-005.

**FR-034**
There is no stored balance or total amount column on billing records. Both values are computed dynamically per BR-ANL-001. (CCR-003: computed SELECT)

**FR-035**
Billing status shall be derived automatically per BR-BIL-006. Manual status override is not permitted.

**FR-036**
The system shall prevent duplicate billing cycles for the same contract and period. Billing generation for a room must be a resilient, non-blocking batch operation: if one contract fails validation (e.g., due to an overlap), the system shall skip that contract, log the failure, and continue processing all other eligible contracts in the room. Ref: BR-BIL-002, BR-BIL-010.

**FR-037**
Billing may only be generated for active contracts. Ref: BR-BIL-008.

**FR-038**
Billing generation is performed manually by Admin or Staff. Ref: BR-BIL-009.

### 4.8 Payment Processing
**FR-039**
The system shall record payments against a billing record within an atomic database transaction per BR-PAY-001. (CCR-006)

**FR-040**
The system shall enforce payment method rules and reference number requirements per BR-PAY-002.

**FR-041**
The system shall allow overpayments and display the resulting credit balance per BR-PAY-003.

**FR-042**
Billing status shall be recalculated after every payment post and void per BR-BIL-007. (CCR-003: UPDATE)

**FR-043**
The system shall support soft-voiding a payment per BR-PAY-004 through BR-PAY-007. Voided records are never deleted. (CCR-003: UPDATE, not DELETE)

**FR-044**
The system shall maintain a complete payment history including voided records, filterable by tenant, contract, or billing cycle.

### 4.9 Reporting (Admin Only)
**FR-045** 
Admin shall be able to view an occupancy report showing bed counts, occupancy rates, and vacancy per room. (CCR-005: JOIN)

**FR-046**
The system shall provide a billing summary report with date-range filtering showing total billed, total collected, and outstanding balance. (CCR-004: BETWEEN; CCR-005: JOIN)

**FR-047**
The system shall provide an outstanding balances report filtered to billing records with a remaining balance. (CCR-005: JOIN)

**FR-048**
The system shall provide a collections performance report showing total payments collected in a date range. (CCR-004: BETWEEN)

**FR-049**
The system shall provide an active contracts report listing all current leases with tenant, room, and rate details. (CCR-005: JOIN)

**FR-050**
The system shall provide a tenant history report showing all contracts for a tenant or set of tenants. (CCR-005: JOIN)

**FR-051**
The system shall provide a tenant ledger view showing the full financial history (billings and payments) for a selected tenant.

**FR-052**
All report data shall be computed via SQL views to demonstrate JOIN compliance. (CCR-005)

**FR-053**
All report types shall support CSV export.

### 4.10 Audit and Forensics
**FR-054**
All INSERT, UPDATE, and DELETE operations on core tables shall be captured in `audit_logs` via database-level triggers per BR-AUD-001 through BR-AUD-003. (CCR-007)

**FR-055**
A correlation ID shall be included in each audit log entry to group mutations produced during the same workflow run. Ref: BR-AUD-004.

**FR-056**
The system shall compute and display a Collection Rate KPI as a measure of performance efficiency, resolving payments against billed totals within overlapping periods. Collections shall include non-billed items like Security Deposits and advance rent per BR-ANL-003.

**FR-057**
To maintain forensic transparency, the system shall ensure that every payment record is visually resolvable to a tenant and room, using either the billing link or the direct contract link (for deposits). Ref: BR-PAY-011.

---

## 5. Non-Functional Requirements

### 5.1 Performance
**NFR-001**
List endpoints shall respond within 2 seconds under normal operating load.

**NFR-002**
Report endpoints shall respond within 5 seconds for datasets up to 1,000 records.

### 5.2 Security
**NFR-003**
Passwords shall be stored as bcrypt hashes. Plaintext passwords shall never appear in logs or API responses.

**NFR-004**
All endpoints except login shall require a valid bearer token.

**NFR-005**
Role-based authorization shall be enforced server-side on every protected endpoint.

### 5.3 Reliability
**NFR-006**
All financial write operations shall be atomic. Partial writes are prevented by explicit database transactions. (CCR-006)

**NFR-007**
A complete audit trail of all data changes shall be maintained via database triggers. (CCR-007)

### 5.4 Maintainability
**NFR-008**
Business logic shall reside in service classes, not controllers or models.

**NFR-009**
A single authorization service shall make all access control decisions.

---

## 6. Data Requirements

### 6.1 Core Entities

| Entity | Purpose |
| :--- | :--- |
| **roles** | Permission classification |
| **users** | System staff accounts |
| **tenants** | Tenant identity profiles |
| **rooms** | Physical rental units |
| **bed_spaces** | Individually leasable sub-units of a room |
| **contracts** | Rental agreements (tenant ↔ bed space) |
| **utilities** | billable service registry (Electricity, Water, etc.) |
| **meters** | Physical utility measurement devices |
| **meter_assignments** | Meter-to-room mapping with effective dates |
| **meter_readings** | Point-in-time consumption records |
| **utility_rates** | Dynamic unit pricing per utility with effective dates |
| **billing** | Monthly charge cycle records |
| **billing_line_items** | Itemized charges within a billing cycle |
| **payments** | Financial settlements against billing cycles |
| **audit_logs** | Immutable change records (Trigger-based) |

Total core entities: **15** — strictly satisfies CCR-001 (≥ 6).

| **users** | `active_email` | UNIQUE (Virtual) | (email) WHERE deleted_at IS NULL |
| **users** | `active_username` | UNIQUE (Virtual) | (username) WHERE deleted_at IS NULL |
| **tenants** | `active_email` | UNIQUE (Virtual) | (email) WHERE deleted_at IS NULL |
| **billing_line_items** | `amount` | CHECK | amount <> 0 |
| **billing_line_items** | `polarity` | CHECK | amount > 0 UNLESS type = 'adjustment' |
| **billing_line_items** | `utility_link` | CHECK | utility_id AND reading_id required for type = 'utility' |
| **payments** | `amount_paid` | CHECK | amount_paid > 0 |
| **payments** | `target` | CHECK (XOR) | (billing_id XOR contract_id) |
| **contracts** | `dates` | CHECK | move_in_date < expected_move_out_date |
| **contracts** | `monthly_rate_override` | NULL or DECIMAL | If set, takes precedence over monthly_rate for base_rent billing. See BR-CON-013. |
| **billing** | `uq_cycle` | UNIQUE | (contract_id, period_from, period_to) |
| **meters** | `uq_serial` | UNIQUE | serial_number |

### 6.3 Status Enumerations

| Entity | Field | Valid Values |
| :--- | :--- | :--- |
| **tenants** | status | active, moved_out, archived |
| **rooms** | status | available, unavailable, maintenance |
| **rooms** | room_type | private, shared |
| **bed_spaces** | status | vacant, occupied, maintenance |
| **contracts** | status | pending_payment, active, completed, terminated, voided† |
| **contracts** | contract_type | fixed_term, month_to_month |
| **billing** | status | unpaid, partial, paid, overdue |
| **payments** | payment_method | cash, gcash, bank_transfer, other |
| **meters** | status | active, maintenance, replaced |

† `voided`: Reserved for contracts cancelled on creation error with zero billing or payment history. Admin only. See BR-CON-012.

---

## 7. Course Compliance Requirements (CCR)

> These requirements are binding academic constraints with equal priority to functional requirements. All items must be demonstrable with evidence during system evaluation.

| ID | Requirement | Implementation Target |
| :--- | :--- | :--- |
| **CCR-001** | ≥ 6 core entities in relational model | 15 tables in schema |
| **CCR-002** | Distributed DB: Primary-Replica architecture | MySQL primary + replica via Docker |
| **CCR-003** | SQL CRUD: SELECT, INSERT, UPDATE, DELETE | All service classes |
| **CCR-004** | SQL operators: AND, OR, BETWEEN, LIKE | Search filters and date-range reports |
| **CCR-005** | Multi-table JOINs for data retrieval | SQL views for all reporting endpoints |
| **CCR-006** | Explicit transactions: START TRANSACTION, COMMIT, ROLLBACK | `DB::transaction()` on all write workflows |
| **CCR-007** | AFTER INSERT/UPDATE/DELETE triggers for change logging | Triggers on all core entity tables |

---

## 8. Prioritized Product Backlog

| Priority | Item | FR Reference |
| :--- | :--- | :--- |
| **P1** | Authentication and RBAC | FR-001–004 |
| **P1** | Tenant CRUD and search | FR-008–012 |
| **P1** | Room and bed space management | FR-013–017 |
| **P1** | Contract creation, move-out, termination | FR-018–023 |
| **P1** | Billing generation with line items | FR-032–038 |
| **P1** | Payment recording and void | FR-039–044 |
| **P1** | Core reporting views | FR-045–053 |
| **P1** | Audit trails and forensics | FR-054, FR-055 |
| **P2** | Meter register and room assignment | FR-024–025 |
| **P2** | Meter reading capture and validation | FR-026–027 |
| **P2** | Utility rate management | FR-028 |
| **P2** | Utility charge calculation in billing | FR-029–030 |
| **P2** | Meter decommissioning | FR-031 |
| **P2** | User management UI | FR-005–007 |
| **P3** | Automated billing schedule | Out of scope (future release) |

---

## 9. Acceptance Criteria and Test Readiness

Critical test coverage required before release:

| Area | Must verify |
| :--- | :--- |
| **Authentication** | Login, rejection of deactivated users, role enforcement |
| **Tenant** | Duplicate email rejection, status derivation |
| **Contract** | Tenant overlap prevention, bed space overlap prevention, move-out atomicity |
| **Meter** | Monotonicity violation rejection, correct utility rate selection |
| **Payment** | Void idempotency (can't void twice), billing recalc after void, dual-path tenant/room resolution |
| **Billing** | Duplicate cycle rejection, zero line item rejection, resilient batch generation (non-blocking skip) |
| **CCR-006** | Rollback leaves no partial writes |
| **CCR-007** | Triggers capture INSERT, UPDATE, DELETE on all core tables |

---

## 10. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| Meter reading monotonicity bypass via direct DB write | Low | Medium | Trigger or application-layer validation |
| Utility rate gap (no rate for a billing period) | Low | High | Require at least one utility rate before meter billing enabled |
| Billing status inconsistency after payment void | Low | High | `autoUpdateStatus()` called after every payment write |
| Room status staleness after bed space change | Low | Medium | `syncStatusAndCapacity()` always called after any bed space update |
| CCR evidence not demonstrable | Low | High | All CCR mapped to FRs and test cases; run on MySQL only |

---

## 11. Revision History

| Version | Date | Summary |
| :--- | :--- | :--- |
| v1.0–v4.4 | Mar–Apr 2026 | Previous iterations (see git history) |
| v4.5 | Apr 20, 2026 | Retire Transaction Log CCR; Consolidate forensic trail under trigger-based Audit Logs (CCR-007). |
| v4.6 | Apr 20, 2026 | Forensic Normalization Pass. Aligned StatusBadge ENUMs and Resource ID prefixes (§6.3) with MASTER.md v6.6.0. |
| v4.7 | Apr 21, 2026 | Fixed §3.1 technology stack (Vanilla CSS). Fixed FR-025 wording contradiction with BR-MET-003. Added `voided` footnote to §6.3. Documented `monthly_rate_override` in constraints table. Added BR-CON-012/013, BR-PAY-010 references. |
| **v5.0** | **Apr 29, 2026** | **Major Stabilization: Added FR-056/057 (KPI & Forensic Context). Updated FR-036 to specify Resilient Batch Billing (Non-blocking). Integrated BR-BIL-011, BR-PAY-011, and BR-PAY-012 references.** |
| **v5.1** | **Apr 29, 2026** | **Realigned Analytical Rule references to point to the new ANL category in BUSINESS_RULES.md.** |
| **v5.2** | **Apr 29, 2026** | **Clean State Release: Synchronized all references to match the new continuous Business Rule numbering (v2.2).** |