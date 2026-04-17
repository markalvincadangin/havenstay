# HavenStay BHMS — Test Plan

**Version:** 4.2  
**Last Updated:** April 17, 2026  
**Status:** Canonical validation registry and evidence quality standard

## 1. Purpose and Scope
This document serves as the authoritative registry for all validation activities required to certify the HavenStay BHMS for Release 1. It defines the testing strategy, environment requirements, to-target traceability, and evidence quality standards for both functional and forensic requirements.

### 1.1 Document Boundary
The Test Plan is the **how** of validation. It maps the requirements defined in [**SRS.md**](SRS.md) to specific automated tests, integration scenarios, and live user acceptance (UAT) checks.

---

## 2. Sources of Truth

| Artifact | Responsibility in Testing |
| :--- | :--- |
| `docs/SRS.md` v4.7 | Authoritative source for Functional (FR) and Non-Functional (NFR) requirements. |
| `docs/SDD.md` v3.2 | Defines the technical design (Triggers, Views, Transactions) to be validated. |
| `db/havenstay_schema.sql`| Canonical DDL for schema-assertive integration tests (`INT-*`). |

### 2.1 Forensic Evidence Requirements
To satisfy course compliance, evidence for the following must be derived from a **MySQL 8.4+** environment:
- **Triggers (CCR-008):** Verification of 24 row-level audit entries.
- **Transactions (CCR-007):** Verification of `started` and `committed/rolled_back` log pairs.
- **Reporting (CCR-005):** Verification of 6 views for correct JOIN and aggregation logic.

---

## 3. Test Strategy and Environments

| Layer | Environment | Tooling | Objective |
| :--- | :--- | :--- | :--- |
| **Feature** | SQLite | PHPUnit | Regression / Fast CRUD validation |
| **Forensic** | MySQL | PHPUnit / SQL | CCR triggered-audit and transaction log validation |
| **Live/UAT** | Browser | Playwright / Manual | User experience and role-based navigation (RBAC) |

### 3.1 NFR Verification Thresholds

| ID | Category | Acceptance Criteria | Measurement Method |
| :--- | :--- | :--- | :--- |
| **NFR-001** | Performance | 90th percentile < 2s | PHPUnit `microtime` benchmark |
| **NFR-002** | Performance | 90th percentile < 5s | PHPUnit `microtime` benchmark |
| **NFR-006** | Reliability | 0 partial writes on abort | Failure injection (TC-TX-003) |
| **NFR-015** | Privacy | Role-aware masking verified | TC-PII-001 (Selective Assertion) |
| **NFR-016** | Availability | 99% Uptime during UAT | UAT Log Verification |
| **NFR-017** | Scalability | 1,000+ Record handling | Seeder-based load test |

### 3.2 Environments and Tooling

---

## 4. Identifier conventions

| Prefix | Meaning | Automation |
| :--- | :--- | :--- |
| **TC-** | Implemented PHPUnit feature test (name in docblock) | Yes (when suite green) |
| **INT-** | Integration scenario — DB + API contract | Planned / partial; some overlap with `TC-*` |
| **LIVE-** | Human or E2E — UI + API | Manual or scripted |

---

## 5. Automated Backend Coverage (`TC-*`)

| Test ID | Method Snapshot | Requirement Mapping |
| :--- | :--- | :--- |
| **TC-AUTH-001** | `test_valid_admin_login` | FR-001, FR-002 |
| **TC-AUTH-002** | `test_invalid_login_credentials` | FR-001 |
| **TC-AUTH-003** | `test_deactivated_user_rejected`| FR-004 |
| **TC-USER-001** | `test_admin_creates_user` | FR-005, FR-007 |
| **TC-TENANT-001**| `test_onboarding_workflow` | FR-008, FR-011 |
| **TC-TENANT-002**| `test_deactivate_is_blocked_when_tenant_has_active_contract` | FR-009, BR-005b, BR-016 |
| **TC-TENANT-003**| `test_index_returns_rich_fields_for_tenant_directory` | FR-011 |
| **TC-TENANT-004**| `test_viewer_sees_masked_tenant_pii_on_index_and_search` | FR-011, NFR-015 |
| **TC-ROOM-001** | `test_room_inventory_management`| FR-012, FR-015 |
| **TC-BED-002** | `test_bed_overlap_prevention` | FR-037, FR-040 |
| **TC-CONTRACT-002**| `test_tenant_overlap_prevention`| FR-017, FR-037 |
| **TC-CONTRACT-003**| `test_move_out_forensics` | FR-019, FR-035 (CCR-007) |
| **TC-BILLING-001** | `test_bulk_bill_generation` | FR-020, FR-022 |
| **TC-BILLING-004** | `test_line_item_constraints` | FR-023, BR-013 |
| **TC-PAYMENT-001** | `test_payment_posting_flow` | FR-024, FR-025 |
| **TC-PAYMENT-004** | `test_payment_void_forensics` | FR-026, FR-034 (CCR-008) |
| **TC-REPORT-001** | `test_occupancy_report_parity` | FR-028, CCR-005 |
| **TC-REPORT-002** | `test_billing_summary_filters` | FR-029, CCR-004 |
| **TC-REPORT-005** | `test_tenant_ledger_ordering` | FR-031, RPT-01 |
| **TC-AUDIT-001** | `test_admin_export_audit_csv` | FR-034 |
| **TC-PII-001** | `test_viewer_sees_masked_tenant_pii_on_show`, `test_admin_sees_unmasked_tenant_pii_on_show` | NFR-015 |

---

## 6. Forensic Verification (`TC-TX-*` and `TC-TRIGGER-*`)

These tests validate the integrity and auditability requirements (CCR-007, CCR-008).

| Test ID | Assertion Target | Requirement |
| :--- | :--- | :--- |
| **TC-TX-001** | Payment Post → Log `committed` | FR-035 |
| **TC-TX-003** | Aborted Payment → Log `rolled_back`| FR-035, CCR-006 |
| **TC-TX-004** | Tenant Move-out → Log `committed` | FR-035 |
| **TC-TRIGGER-001**| After INSERT → New Audit Row | FR-034 |
| **TC-TRIGGER-002**| After UPDATE → Old/New Snapshots | FR-034 |
| **TC-TRIGGER-003**| Global coverage (24 triggers) | FR-034, CCR-008 |

**TC-CCR-006:** Rollback prevents partial writes — covered by **TC-PAYMENT-003** (billing stays `unpaid` when payment invalid).

---

## 7. Integration Test Catalog (`INT-*`) — Schema-Driven

Use these as **checklists** for new PHPUnit cases or MySQL-only jobs. Map each to **FK/ENUM/view/trigger** in `havenstay_schema.sql`.

### 7.1 Referential integrity and constraints

| ID | Scenario | Schema |
| :--- | :--- | :--- |
| INT-101 | `contracts.bed_space_id` required; no `room_id` on `contracts` | Table `contracts` |
| INT-102 | Duplicate billing cycle rejected | `uq_billing_cycle` |
| INT-103 | Line item amount ≠ 0 | `chk_line_amount` |
| INT-104 | Payment amount > 0 | `chk_payment_amount` |
| INT-105 | Room capacity / rate CHECKs | `chk_rooms_*` |
| INT-106 | Contract rate / deposit CHECKs | `chk_contracts_*` |

### 7.2 ENUM boundary (API rejects invalid strings)

| ID | Columns |
| :--- | :--- |
| INT-201 | `tenants.status`, `rooms.status`, `bed_spaces.status` |
| INT-202 | `contracts.status`, `billing.status` |
| INT-203 | `billing_line_items.item_type`, `payments.payment_method` |


### 7.3 Reporting views (CCR-005)

| ID | View | Assertion |
| :--- | :--- | :--- |
| INT-301 | `vw_billing_summary` | `total_paid` excludes `payments.voided_at IS NOT NULL` |
| INT-302 | `vw_active_contracts` | Only `contracts.status = 'active'` |
| INT-303 | `vw_room_occupancy` | Aggregates match underlying `bed_spaces` |
| INT-304 | `vw_occupancy_status` | Bed ↔ active contract LEFT JOIN semantics |
| INT-305 | `vw_collections_summary` | Non-voided payments only |
| INT-306 | `vw_tenant_contract_history` | All contract statuses for history report |

### 7.4 Triggers and session context (CCR-008, MySQL)

| ID | Assertion |
| :--- | :--- |
| INT-401 | After INSERT on trigger-covered table, **new** `audit_logs` row |
| INT-402 | UPDATE produces `old_value` / `new_value` snapshots per trigger |
| INT-403 | `AuditService::setAuditUserContext($actor->id)` before write → `audit_logs.changed_by` matches actor |

### 7.5 Business workflow (cross-table)

| ID | Flow |
| :--- | :--- |
| INT-601 | Tenant create → search (LIKE) → update → status `moved_out` / `archived` |
| INT-602 | Room + beds → contract → billing + line items → payment → void |
| INT-603 | Move-out → contract terminal state + bed `vacant` |
| INT-700 | **BR-023:** Automated proration is out of scope for Release 1; staff enter manually approved amounts. Evidence: `ContractService::create` comment; `/billing/new` in-app notice; PHPUnit does not assert proration math. |

---

## 8. Live / UAT Catalog (`LIVE-*`)

Use these for manual runs, Playwright, or TestSprite. Aligned with product routes.

### 8.1 Smoke (every build)

| ID | Steps |
| :--- | :--- |
| LIVE-001 | Login as Admin; all sidebar items visible (10). |
| LIVE-002 | Login as Staff; **Users** absent (9 items). |
| LIVE-003 | Login as Viewer; no create/edit primary actions on registries. |
| LIVE-004 | Navigate `/dashboard` → `/tenants` → `/rooms` → `/contracts` → `/billing` → `/payments` → `/reports` — no 5xx. |

### 8.2 RBAC and access denial

| ID | Steps |
| :--- | :--- |
| LIVE-010 | Viewer opens `/users` — alert: permission message per TEST_READINESS §6. |
| LIVE-011 | Viewer opens `/audit-logs` — same. |
| LIVE-012 | Viewer opens `/transaction-logs` — same. |

### 8.3 Module happy paths

| ID | Steps |
| :--- | :--- |
| LIVE-020 | Tenant: register → open detail → edit. |
| LIVE-021 | Room: create → detail → bed list; status badges match **room** vs **bed** ENUMs. |
| LIVE-022 | Contract: create with bed space; list/detail. |
| LIVE-023 | Billing: `/billing/new` — first active contract pre-selected when list non-empty; **BR-023** notice visible (manual proration for partial first/last cycles). |
| LIVE-024 | Payment: receive payment → void → billing balance consistent. |

### 8.4 Reports and exports

| ID | Steps |
| :--- | :--- |
| LIVE-030 | Each report card loads data; CSV export returns 200 and matches on-screen columns (FR-032). |
| LIVE-031 | Open **Occupancy (bed-level)** and **Active contracts** from `/reports`; filters apply; CSV download uses authenticated download helper (same pattern as other reports). |
| LIVE-032 | **Tenant ledger** for a tenant with billing + payment on the same calendar date: running balance matches debit-then-credit order (spot-check vs **TC-REPORT-005** on SQLite; optional MySQL seed confirmation). |

### 8.5 Logs and audit UI

| ID | Steps |
| :--- | :--- |
| LIVE-040 | Admin views **Audit Logs** and **Transaction Logs**; tables readable. |
| LIVE-041 | **Admin:** Audit Logs → set filters → **Export CSV**; file opens and matches table. **Staff/Viewer:** export URL returns **403** (see **TC-AUDIT-EXPORT-002**). |
| LIVE-042 | **Admin:** Transaction Logs — optional `?per_page=` in network tab or embedded tab reflects row cap; invalid `per_page` shows validation error. |

---

## 9. Traceability Matrix Summary

| Requirement Range | Primary Evidence (TC / LIVE) | Status |
| :--- | :--- | :--- |
| **FR-001–004** | TC-AUTH-*, LIVE-001–003 | Aligned |
| **FR-005–007** | TC-USER-*, LIVE-010 | Aligned |
| **FR-008–011** | TC-TENANT-*, LIVE-020 | Aligned |
| **FR-012–015** | TC-ROOM-*, LIVE-021 | Aligned |
| **FR-016–019** | TC-CONTRACT-*, LIVE-022 | Aligned |
| **FR-020–023** | TC-BILLING-*, LIVE-023 | Aligned |
| **FR-024–027** | TC-PAYMENT-*, LIVE-024 | Aligned |
| **FR-028–032** | TC-REPORT-*, LIVE-030–032 | Aligned |
| **FR-033–033** | TC-DASHBOARD-*, LIVE-004 | Aligned |
| **FR-034–036** | TC-TRIGGER-*, TC-TX-*, LIVE-040 | Aligned |

## 10. NFR Traceability Matrix

| Requirement | Validation Evidence | Result |
| :--- | :--- | :--- |
| **NFR-001/002** | TC-PERF-001, TC-PERF-002 | Aligned |
| **NFR-003/004** | TC-AUTH-001, TC-AUTH-002 | Aligned |
| **NFR-005/009** | TC-USER-001, TC-PAYMENT-001 | Aligned |
| **NFR-006/007** | TC-TX-003 (Rollback Validation) | Aligned |
| **NFR-011/012** | LIVE-020, LIVE-024 | Aligned |
| **NFR-015** | TC-PII-001 (Masking Assertion) | Aligned |
| **NFR-016/017** | INT-601, INT-602 (Load context) | Aligned |

## 11. Course Compliance (CCR) Reference

| CCR | Validation Evidence |
| :--- | :--- |
| **CCR-001** | Database Schema (11 Tables) in `havenstay_schema.sql` |
| **CCR-002** | Primary-Replica GTID topology implementation |
| **CCR-003** | Automated CRUD verification across all 4 operational modules |
| **CCR-004** | Date‑range and Wildcard Search implementation evidence |
| **CCR-005** | Verification of 6 views for analytical consistency |
| **CCR-006** | Transaction Rollback (ACID) verification via `TC-TX-003` |
| **CCR-007** | Transaction Log pair verification (`started` → `committed`) |
| **CCR-008** | Audit Trigger verification (24 triggers producing snapshots) |

---

## 11. Execution Commands

```bash
# Backend — default (SQLite)
cd backend && php artisan test

# Backend — MySQL (Triggers & Views)
cd backend && composer test:mysql

# Frontend — Logic & Lint
cd frontend && npm test && npm run lint
```

---

## 12. Revision History

| Version | Date | Changes |
| :--- | :--- | :--- |
| 3.3 | 2026-04-17 | Core-doc standardization pass: aligned traceability ranges to SRS v4.1 requirement expansion and added explicit coverage-confidence notes for evidence quality governance. |
| 4.1 | 2026-04-17 | Final audit alignment: corrected trigger count to 24; synchronized traceability mapping; verified RBAC visibility for user management. |
| 4.2 | 2026-04-17 | Final audit-ready pass: implemented NFR verification matrix with explicit thresholds; synchronized all version pointers to SRS v4.6 and SDD v3.2 baseline. |

---

*Aligned to: SRS.md v4.7 · SDD.md v3.2 · db/havenstay_schema.sql (canonical) · API_REFERENCE.md v2.2*  
*Last Updated: April 17, 2026 (v4.2 — final audit alignment pass)*
