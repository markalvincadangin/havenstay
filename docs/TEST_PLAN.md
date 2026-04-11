# HavenStay BHMS — Test Plan

**Version:** 2.0  
**Last updated:** April 2026  
**Aligned to:** `docs/SRS.md` v2.1 · `docs/SDD.md` · `docs/TEST_READINESS.md` · `docs/DATABASE.md`

---

## 1. Purpose and scope

This document is the **single registry** for:

- **Automated tests** implemented in the repo (PHPUnit `TC-*` IDs).
- **Integration test cases** (`INT-*`) — API + database behavior grounded in **`havenstay_schema.sql`** (constraints, ENUMs, views, triggers, `transaction_logs`).
- **Live / UAT / E2E cases** (`LIVE-*`) — browser + API smoke and role scenarios aligned with `docs/TEST_READINESS.md`.

**Out of scope for this plan:** third-party load testing tools; production secrets; online payment gateways (out of scope for Release 1 per SRS).

---

## 2. Sources of truth

| Priority | Artifact | Governs |
| :--- | :--- | :--- |
| 1 | `db/havenstay_schema.sql` and **`backend/database/sql/havenstay_schema.sql`** (identical DDL) | Tables (11), views (6), AFTER triggers (24 on 8 tables), CHECK/FK/UNIQUE, ENUM domains |
| 2 | `docs/SRS.md` | `FR-*`, `BR-*`, `CCR-*` |
| 3 | `docs/API_REFERENCE.md` | Route inventory and method expectations |
| 4 | `docs/TEST_READINESS.md` | UI labels, routes, RBAC expectations for live tooling |

**Schema inventory (canonical):**

- **Tables:** `roles`, `users`, `tenants`, `rooms`, `bed_spaces`, `contracts`, `billing`, `billing_line_items`, `payments`, `audit_logs`, `transaction_logs`.
- **Views:** `vw_billing_summary`, `vw_active_contracts`, `vw_room_occupancy`, `vw_occupancy_status`, `vw_collections_summary`, `vw_tenant_contract_history`.
- **Triggers:** 24 AFTER INSERT/UPDATE/DELETE triggers on `users`, `tenants`, `rooms`, `bed_spaces`, `contracts`, `billing`, `billing_line_items`, `payments`.

---

## 3. Test layers and environments

| Layer | Goal | Typical command / tool |
| :--- | :--- | :--- |
| **Unit** | Isolated logic | `php artisan test --testsuite=Unit` |
| **Feature (API + SQLite)** | Fast regression; migrations mirror schema | `cd backend && php artisan test` |
| **Feature (MySQL)** | Triggers, session `@app_user_id`, InnoDB, view parity | `composer test:mysql` (see `backend/phpunit.mysql.xml` if present) |
| **Integration (`INT-*`)** | Same as Feature but explicitly **schema-assertive** (may be MySQL-only) | Tagged or dedicated job |
| **Frontend unit** | Formatters, schemas, presentational components | `cd frontend && npm test` |
| **Live (`LIVE-*`)** | Manual UAT or Playwright/TestSprite per `TEST_READINESS.md` | Checklist §8 |

**Rule:** CCR-005/007/008 **evidence** (views, `transaction_logs` semantics, trigger-fired `audit_logs`) must be demonstrable on **MySQL**; SQLite CI may skip or stub trigger assertions (see `tests/TestCase.php` `assertTriggerAuditLog()`).

---

## 4. Identifier conventions

| Prefix | Meaning | Automation |
| :--- | :--- | :--- |
| **TC-** | Implemented PHPUnit feature test (name in docblock) | Yes (when suite green) |
| **INT-** | Integration scenario — DB + API contract | Planned / partial; some overlap with `TC-*` |
| **LIVE-** | Human or E2E — UI + API | Manual or scripted |

---

## 5. Automated backend tests (`TC-*`) — implementation map

| Test ID | PHPUnit location | Primary FR / BR / CCR |
| :--- | :--- | :--- |
| **TC-AUTH-001** | `AuthenticationTest::test_valid_admin_login` | FR-001, FR-002 |
| **TC-AUTH-002** | `AuthenticationTest::test_invalid_login_rejected` | FR-001 |
| **TC-AUTH-003** | `AuthenticationTest::test_deactivated_user_rejected` | FR-004 |
| *(auth)* | `AuthenticationTest::test_me_endpoint_returnsAuthenticatedUser` | FR-002 |
| *(auth)* | `AuthenticationTest::test_logout_event_is_logged` | FR-003 |
| **TC-USER-001** | `UserManagementTest::test_admin_creates_user` | FR-005, FR-007 |
| **TC-USER-002** | `UserManagementTest::test_admin_updates_user_role` | FR-006 |
| **TC-TENANT-001** | `TenantManagementTest` (create; viewer denied) | FR-008, FR-002 |
| **TC-TENANT-002** | `TenantManagementTest` (update; deactivate) | FR-008, FR-009 |
| **TC-ROOM-001** | `RoomManagementTest` (create; viewer denied) | FR-012 |
| **TC-BED-001** | `RoomManagementTest` (bed spaces shared room) | FR-014 |
| **TC-BED-002** | `RoomManagementTest` (double occupancy guard) | FR-037 |
| **TC-CONTRACT-001** | `ContractManagementTest::test_create_contract` | FR-016, FR-016a |
| **TC-CONTRACT-002** | `ContractManagementTest::test_tc_contract_002_tenant_overlap_prevention` | FR-017 |
| **TC-CONTRACT-003** | `ContractManagementTest::test_move_out_success` | FR-019, BR-005 |
| **TC-CONTRACT-004** | `ContractManagementTest::test_tc_contract_004_bed_overlap_prevention` | FR-017 |
| **TC-BILLING-001** | `BillingPaymentManagementTest::test_create_billing` | FR-020–022 |
| **TC-BILLING-004** | `BillingPaymentManagementTest::test_tc_billing_004_zero_amount_line_item_rejected` | FR-023, `chk_line_item_amount` |
| **TC-PAYMENT-001** | `BillingPaymentManagementTest::test_partial_payment_updates_status` | FR-024, FR-025, BR-008 |
| **TC-PAYMENT-003** | `BillingPaymentManagementTest::test_invalid_payment_amount_rolls_back` | FR-024, CCR-006/007 |
| **TC-REPORT-001** | `ReportsExportTest::test_tc_report_001_occupancy_report_generation_matches_live_data` | FR-028, FR-031 |
| **TC-REPORT-002** | `ReportsExportTest::test_tc_report_002_billing_summary_date_filter_and_csv_export` | FR-029, FR-032, CCR-004 |
| *(compliance)* | `ComplianceMysqlEvidenceTest` | CCR-007 scaffolding, MySQL `@app_user_id` |
| *(boundary)* | `ApiWorkflowAndBoundaryTest`, `ApiEdgeCasesTest` | FR-036–039, NFR-004/005 |

---

## 6. Transaction log tests (`TC-TX-*`) — mapping

These satisfy **FR-034**, **FR-035**, **CCR-007** (workflow `transaction_logs` with `started` / `committed` / `failed` / `rolled_back`; see `docs/DATABASE.md`).

| Test ID | Assertion | PHPUnit reference |
| :--- | :--- | :--- |
| **TC-TX-001** | Payment post leaves `transaction_logs` row `tx_name = payment_posting`, `status = committed` | `BillingPaymentManagementTest::test_partial_payment_updates_status` |
| **TC-TX-002** | *(Reserved)* Additional rollback scenarios | Covered in part by **TC-TX-003** (`rolled_back` after `DB::transaction()` abort) |
| **TC-TX-003** | Invalid payment yields `status = rolled_back` on `transaction_logs` (SQL transaction rolled back) | `BillingPaymentManagementTest::test_invalid_payment_amount_rolls_back` |
| **TC-TX-004** | Move-out leaves `transaction_logs` row `tx_name = tenant_move_out`, `status = committed` | `ContractManagementTest::test_move_out_success` |
| **TC-TX-005** | *(Reserved)* Additional inner `DB::transaction` failure injection | **Gap** — optional failure mock beyond TC-TX-003 |
| **TC-TX-006** | Validation failure before `logStarted` — no new `tenant_move_out` rows | `ContractManagementTest::test_move_out_invalid_date_does_not_create_tenant_move_out_log` |

---

## 7. Trigger audit tests (`TC-TRIGGER-*`, `TC-CCR-008`)

**FR-033**, **CCR-008**: `audit_logs` populated via AFTER triggers on MySQL.

| Test ID | Behavior | PHPUnit reference |
| :--- | :--- | :--- |
| **TC-TRIGGER-001** | INSERT audit path | `assertTriggerAuditLog()` in `ContractManagementTest::test_create_contract`, `BillingPaymentManagementTest::test_create_billing`, etc. |
| **TC-TRIGGER-002** | UPDATE audit path | `ContractManagementTest::test_move_out_success` |
| **TC-TRIGGER-003** | Coverage across entities | Multiple feature tests; **MySQL-only** assert (`TestCase::assertTriggerAuditLog`) |

**TC-CCR-008:** Full trigger evidence = run suite on **MySQL** with `havenstay_schema.sql` triggers; SQLite passes skip branch.

**TC-CCR-006:** Rollback prevents partial writes — covered by **TC-PAYMENT-003** (billing stays `unpaid` when payment invalid).

---

## 8. Integration test catalog (`INT-*`) — schema-driven

Use these as **checklists** for new PHPUnit cases or MySQL-only jobs. Map each to **FK/ENUM/view/trigger** in `havenstay_schema.sql`.

### 8.1 Referential integrity and constraints

| ID | Scenario | Schema |
| :--- | :--- | :--- |
| INT-101 | `contracts.bed_space_id` required; no `room_id` on `contracts` | Table `contracts` |
| INT-102 | Duplicate billing cycle rejected | `uq_billing_cycle` |
| INT-103 | Line item amount ≠ 0 | `chk_line_item_amount` |
| INT-104 | Payment amount > 0 | `chk_payments_amount` |
| INT-105 | Room capacity / rate CHECKs | `chk_rooms_*` |
| INT-106 | Contract rate / deposit CHECKs | `chk_contracts_*` |

### 8.2 ENUM boundary (API rejects invalid strings)

| ID | Columns |
| :--- | :--- |
| INT-201 | `tenants.status`, `rooms.status`, `bed_spaces.status` |
| INT-202 | `contracts.status`, `billing.status` |
| INT-203 | `billing_line_items.item_type`, `payments.payment_method` |


### 8.3 Reporting views (CCR-005)

| ID | View | Assertion |
| :--- | :--- | :--- |
| INT-301 | `vw_billing_summary` | `total_paid` excludes `payments.voided_at IS NOT NULL` |
| INT-302 | `vw_active_contracts` | Only `contracts.status = 'active'` |
| INT-303 | `vw_room_occupancy` | Aggregates match underlying `bed_spaces` |
| INT-304 | `vw_occupancy_status` | Bed ↔ active contract LEFT JOIN semantics |
| INT-305 | `vw_collections_summary` | Non-voided payments only |
| INT-306 | `vw_tenant_contract_history` | All contract statuses for history report |

### 8.4 Triggers and session context (CCR-008, MySQL)

| ID | Assertion |
| :--- | :--- |
| INT-401 | After INSERT on trigger-covered table, **new** `audit_logs` row |
| INT-402 | UPDATE produces `old_values_json` / `new_values_json` per trigger |
| INT-403 | `AuditService::setAuditUserContext($actor->id)` before write → `audit_logs.user_id` matches actor |

### 8.5 Business workflow (cross-table)

| ID | Flow |
| :--- | :--- |
| INT-601 | Tenant create → search (LIKE) → update → status `moved_out` / `archived` |
| INT-602 | Room + beds → contract → billing + line items → payment → void |
| INT-603 | Move-out → contract terminal state + bed `vacant` |

---

## 9. Live / UAT catalog (`LIVE-*`)

Aligned with **`docs/TEST_READINESS.md`**. Use for manual runs, Playwright, or TestSprite.

### 9.1 Smoke (every build)

| ID | Steps |
| :--- | :--- |
| LIVE-001 | Login as Admin; all sidebar items visible (10). |
| LIVE-002 | Login as Staff; **Users** absent (9 items). |
| LIVE-003 | Login as Viewer; no create/edit primary actions on registries. |
| LIVE-004 | Navigate `/dashboard` → `/tenants` → `/rooms` → `/contracts` → `/billing` → `/payments` → `/reports` — no 5xx. |

### 9.2 RBAC and access denial

| ID | Steps |
| :--- | :--- |
| LIVE-010 | Viewer opens `/users` — alert: permission message per TEST_READINESS §6. |
| LIVE-011 | Viewer opens `/audit-logs` — same. |
| LIVE-012 | Viewer opens `/transaction-logs` — same. |

### 9.3 Module happy paths

| ID | Steps |
| :--- | :--- |
| LIVE-020 | Tenant: register → open detail → edit. |
| LIVE-021 | Room: create → detail → bed list; status badges match **room** vs **bed** ENUMs. |
| LIVE-022 | Contract: create with bed space; list/detail. |
| LIVE-023 | Billing: `/billing/new` — first active contract pre-selected when list non-empty. |
| LIVE-024 | Payment: receive payment → void → billing balance consistent. |

### 9.4 Reports and exports

| ID | Steps |
| :--- | :--- |
| LIVE-030 | Each report card loads data; CSV export returns 200 and matches on-screen columns (FR-032). |

### 9.5 Logs and audit UI

| ID | Steps |
| :--- | :--- |
| LIVE-040 | Admin views **Audit Logs** and **Transaction Logs**; tables readable. |

---

## 10. FR traceability matrix (summary)

| FR range | Primary `TC-*` / `INT-*` / `LIVE-*` |
| :--- | :--- |
| FR-001–004 | TC-AUTH-*, LIVE-001–004 |
| FR-005–007 | TC-USER-*, LIVE-010 |
| FR-008–011 | TC-TENANT-*, INT-601, LIVE-020 |
| FR-012–015a | TC-ROOM-*, TC-BED-*, INT-201, LIVE-021 |
| FR-016–019 | TC-CONTRACT-*, INT-101/103, LIVE-022 |
| FR-020–023 | TC-BILLING-*, INT-102/103 |
| FR-024–027 | TC-PAYMENT-*, TC-TX-001/003, INT-602 |
| FR-028–032b | TC-REPORT-*, INT-301–306, LIVE-030 |
| FR-033–035 | TC-TRIGGER-*, TC-TX-*, TC-CCR-006/008 |
| FR-036–039 | ApiWorkflow*, INT-101/105/106 |
| FR-040–045 | CCR bundles: Feature suite + `ComplianceMysqlEvidenceTest` + MySQL |

---

## 11. CCR evidence (quick reference)

| CCR | Evidence |
| :--- | :--- |
| CCR-001 | 11 tables in schema |
| CCR-002 | `docs/DISTRIBUTED_DB_SETUP.md`; `DB_READ_HOST` in `.env.example` |
| CCR-003 | CRUD via services and API (`TC-*` coverage per module) |
| CCR-004 | Tenant search LIKE; report date `BETWEEN` (TC-REPORT-002) |
| CCR-005 | Six views; report endpoints must use views per `CLAUDE.md` §5.6 |
| CCR-006 | `DB::transaction()` — TC-PAYMENT-003, TC-CCR-006 |
| CCR-007 | `transaction_logs` — TC-TX-001/003, gaps noted §6 |
| CCR-008 | 24 triggers — TC-TRIGGER-*, MySQL `assertTriggerAuditLog` |

---

## 12. Execution commands

```bash
# Backend — default (SQLite)
cd backend && php artisan test

# Backend — MySQL (if configured)
cd backend && composer test:mysql

# Frontend unit
cd frontend && npm test && npm run lint && npm run build
```

---

## 13. Revision history

| Version | Date | Changes |
| :--- | :--- | :--- |
| 2.0 | 2026-04-11 | Initial publication: `TC-*`/`INT-*`/`LIVE-*` registry, schema source of truth, gaps for TC-TX-004/005/006, alignment with `havenstay_schema.sql` (6 views, 24 triggers). |
| 2.1 | 2026-04-11 | TC-TX-004/006 implemented in `ContractManagementTest` (`tenant_move_out` transaction logs). TC-TX-005 remains reserved (rollback-after-start). |

---

*Canonical DDL: `backend/database/sql/havenstay_schema.sql` (mirror: `db/havenstay_schema.sql`).*
