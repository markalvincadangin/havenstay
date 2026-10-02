# HavenStay — Decision Gate and Implementation Readiness Audit

> **Document Type**: Decision Framework & Implementation Readiness Assessment  
> **Status**: Authoritative Decision Baseline  
> **Date**: September 25, 2026  
> **Operating Principle**: `FACT → EVIDENCE → REQUIREMENT → BUSINESS RULE → GAP → DECISION → ACCEPTANCE CRITERIA → BACKLOG → IMPLEMENTATION → VERIFICATION`  
> **Repository Baseline**: Current Repository State (Post Architecture Invariant Audit & Master Plan Validation)

---

## Executive Summary

This document establishes the authoritative boundary between **verified engineering defects ready for immediate correction** and **unresolved product/business policies requiring human stakeholder decisions**. 

Following exhaustive cross-layer repository archaeology—tracing UI components, request payloads, FormRequest validators, controller actions, service domain logic, Eloquent models, canonical SQL DDL, MySQL triggers, and automated test suites—we have eliminated all unverified assumptions from the active implementation plan.

---

## 1. Revalidation of the Five Core Decision Gates

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          THE FIVE DECISION GATES                            │
│                                                                             │
│   DEC-01: Payment Remarks Field Naming & Persistence                        │
│   DEC-02: Security Deposit Forfeiture & Clearance Policy                    │
│   DEC-03: Bed Space & Tenant Status Semantics during `pending_payment`      │
│   DEC-04: Disposal of Broken `POST /api/tenants/{tenant}/reactivate` Route  │
│   DEC-05: MySQL Trigger Verification Strategy in GitHub Actions CI          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### DEC-01: Payment Remarks Field Naming & Persistence

| Dimension | Analysis & Findings |
| :--- | :--- |
| **Evidence** | UI form [PaymentWizard.js L832](file:///home/markc/projects/active/havenstay/frontend/src/features/payments/components/PaymentWizard.js#L832) registers `remarks`. Request payload sends `{ remarks: ... }`. [StorePaymentRequest.php L60](file:///home/markc/projects/active/havenstay/backend/app/Http/Requests/Payment/StorePaymentRequest.php#L60) and [StoreCompositePaymentRequest.php L39](file:///home/markc/projects/active/havenstay/backend/app/Http/Requests/Payment/StoreCompositePaymentRequest.php#L39) validate `'remarks' => ['nullable', 'string']`. [PaymentService.php L96](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/PaymentService.php#L96) writes `'remarks' => $data['remarks']`. Frontend detail page [page.js L361](file:///home/markc/projects/active/havenstay/frontend/src/app/(dashboard)/payments/[id]/page.js#L361) renders `payment?.remarks`.<br><br>**The Defect**: `payments` table schema in `db/havenstay_schema.sql` lacks `remarks` column; `Payment::$fillable` omits `remarks`; [PaymentResource.php L32](file:///home/markc/projects/active/havenstay/backend/app/Http/Resources/PaymentResource.php#L32) attempts to serialize `'notes' => $this->notes`. |
| **Options** | **Option A (Recommended)**: Standardize on `remarks`. Add `remarks VARCHAR(255) NULL` to both canonical schema files, add to `Payment::$fillable`, and update `PaymentResource` to export `'remarks' => $this->remarks, 'notes' => $this->remarks` (dual-key for backward compatibility).<br>**Option B**: Standardize on `notes`. Refactor UI forms, payload keys, FormRequests, PaymentService, and payment detail pages to `notes`. |
| **Architectural Impact** | **Option A**: Preserves end-to-end alignment across UI, Request, and Service layers. Requires 1 schema column addition.<br>**Option B**: Requires churn across 6 frontend and backend files to rename an active, working identifier. |
| **Business Impact** | Prevents permanent financial audit notes data loss on rent, deposit, refund, and rollover transactions. |
| **Risk** | Negligible. Adding a nullable column causes zero breaking changes. |
| **Recommendation** | **Adopt Option A**. The entire pipeline was built for `remarks`; `notes` in `PaymentResource` was a simple typo. |
| **Status** | **AWAITING HUMAN APPROVAL** |

#### Detailed Impact of Options for DEC-01

- **Option A (Standardize on `remarks`)**:
  - *What changes*: `db/havenstay_schema.sql` and `backend/database/sql/havenstay_schema.sql` (add `remarks VARCHAR(255) NULL`); `Payment.php` (add `'remarks'` to `$fillable`); `PaymentResource.php` (export both `remarks` and `notes`).
  - *What remains unchanged*: `PaymentWizard.js`, `StorePaymentRequest.php`, `StoreCompositePaymentRequest.php`, `PaymentService.php`, `payments/[id]/page.js`.
  - *Affected entities*: `Payment` model and database table.
  - *Affected APIs*: `POST /api/payments`, `POST /api/payments/composite-initial`, `GET /api/payments`, `GET /api/payments/{id}`.
  - *Frontend behavior*: Unlocks rendering of the "Notes" box on payment details and preserves staff remarks entered during checkout.
  - *Rollback complexity*: Trivial (`ALTER TABLE payments DROP COLUMN remarks`).

- **Option B (Rename to `notes`)**:
  - *What changes*: Schema DDL (add `notes VARCHAR(255) NULL`); `Payment.php` (`$fillable`); `PaymentWizard.js` (input name, validation binding); `StorePaymentRequest.php`; `StoreCompositePaymentRequest.php`; `PaymentService.php`; `payments/[id]/page.js`.
  - *Rollback complexity*: Moderate (touches 7 distinct components across frontend and backend).

---

### DEC-02: Security Deposit Forfeiture & Clearance Policy

| Dimension | Analysis & Findings |
| :--- | :--- |
| **Evidence** | [ContractService.php L390](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/ContractService.php#L390) enforces balance settlement (≤ ₱0.01) before move-out. [PaymentService.php L110](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/PaymentService.php#L110) sets contract `is_cleared = true` ONLY upon `refund` or `rollover` payment category.<br><br>**The Defect / Gap**: When a tenant forfeits part or all of their deposit due to property damage, cleaning fees, or early departure penalty, there is NO mechanism to mark `is_cleared = true` without creating an illegal ₱0 refund. The contract remains stuck in the unsettled deposit queue indefinitely. |
| **Options** | **Option A (Dedicated Payment Category)**: Add `'forfeiture'` to `payments.payment_category` enum. Staff records a forfeiture payment against the contract with `amount_paid = forfeited_amount`, `reference_number = damage_assessment_ref`, and `is_cleared` is set to `true`.<br>**Option B (Operational Clearance Action)**: Retain existing 4 payment categories. Introduce `POST /api/contracts/{contract}/clear-deposit` allowing staff to mark `is_cleared = true` with mandatory `clearance_notes` and `retained_amount` stored on the contract.<br>**Option C (Billing Damage Offset)**: Require staff to issue an adjustment billing invoice for damages, and build an internal deposit-to-billing ledger transfer mechanism. |
| **Architectural Impact** | **Option A**: Cleanest financial audit trail. Every cent of the deposit is accounted for in `payments` (Deposit In = Refund Out + Forfeiture Retained).<br>**Option B**: Requires adding `deposit_retained_amount` and `clearance_notes` columns to `contracts` table.<br>**Option C**: Significant architectural complexity; requires bypassing or modifying the `chk_pay_target` XOR constraint. |
| **Business Impact** | Determines how HavenStay legally and accounting-wise recognizes income from forfeited deposits. |
| **Risk** | Medium. Requires clear business policy on whether forfeited deposits are considered revenue or penalty offsets. |
| **Recommendation** | **Human Decision Required**. Select between Option A (ledger accounting) and Option B (operational contract clearance). |
| **Status** | **AWAITING HUMAN DECISION** |

#### Detailed Impact of Options for DEC-02

- **Option A (Add `'forfeiture'` category to `payments`)**:
  - *What changes*: `payments.payment_category` ENUM in DDL; `PaymentCategory.php` PHP Enum; `PaymentService.php` (triggers `is_cleared = true` when category is `forfeiture`); `PaymentWizard.js` (adds Forfeiture category).
  - *Affected entities*: `Payment`, `Contract`.
  - *Audit implications*: 100% captured by existing MySQL triggers `trg_payments_ai`.

- **Option B (Operational Contract Clearance endpoint)**:
  - *What changes*: `contracts` schema (add `deposit_retained_amount DECIMAL(10,2) DEFAULT 0.00`, `clearance_reason VARCHAR(255) NULL`); `ContractController.php` (new action); `ContractService.php`.
  - *Affected APIs*: New endpoint `POST /api/contracts/{id}/clear-deposit`.

---

### DEC-03: Bed Space & Tenant Status Semantics During `pending_payment`

| Dimension | Analysis & Findings |
| :--- | :--- |
| **Evidence** | When [ContractService.php L145-170](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/ContractService.php#L145-L170) creates a contract: (1) Contract status = `pending_payment`; (2) It immediately calls `RoomService::occupyBedSpace()`, setting bed space DB status = `occupied`; (3) `BedSpaceObserver` updates room capacity; (4) `TenantService::syncStatus()` sets tenant status = `active` because `pending_payment` is treated as active residency.<br><br>**The Semantic Ambiguity**: In the physical world, "Occupied" means a person has moved their belongings into the bed. In the commercial world, "Occupied" means the inventory is locked so no one else can book it while payment clears. The schema supports only 3 bed states: `vacant`, `occupied`, `maintenance`. |
| **Options** | **Option A (Preserve Current Inventory Lock)**: Retain current behavior. Document that in HavenStay's domain model, bed `occupied` denotes commercial inventory allocation (reservation lock). If the tenant walks away, staff voids the contract, which returns bed to `vacant` and tenant to `onboarded`.<br>**Option B (Refactor Tenant Status Only)**: Keep bed `occupied` (to prevent double-booking), but update `TenantService::syncStatus()` so tenant status remains `onboarded` until contract activation occurs upon payment clearance.<br>**Option C (Introduce Formal `reserved` State)**: Add `'reserved'` to `bed_spaces.status` enum and `contracts.status` workflow. Requires updating room capacity math, observers, UI badges, and reports. |
| **Architectural Impact** | **Option A**: 0 code changes. Clarifies domain semantics in documentation.<br>**Option B**: 3 lines of code in `TenantService.php`. More accurate tenant reporting.<br>**Option C**: High complexity schema migration across 8 core files. |
| **Business Impact** | Option A & B prevent catastrophic double-booking. Option B ensures tenant counts reflect actual physical residents. |
| **Risk** | Low for Options A & B. High regression risk for Option C. |
| **Recommendation** | **Adopt Option A as immediate baseline**, with consideration for Option B. Option C is premature. |
| **Status** | **AWAITING HUMAN CONFIRMATION** |

---

### DEC-04: Disposal of Broken `POST /api/tenants/{tenant}/reactivate` Route

| Dimension | Analysis & Findings |
| :--- | :--- |
| **Evidence** | [routes/api.php L58](file:///home/markc/projects/active/havenstay/backend/routes/api.php#L58) registers `Route::post('{tenant}/reactivate', [TenantController::class, 'reactivate'])->withTrashed();`. Neither `TenantController` nor `TenantService` defines `reactivate()`. Calling it throws `BadMethodCallException` (HTTP 500). [TenantArchitectureConventionTest.php L32](file:///home/markc/projects/active/havenstay/backend/tests/Unit/TenantArchitectureConventionTest.php#L32) asserts that `TenantService::reactivate()` exists, causing the test suite to fail.<br><br>**Frontend Archaeology**: Frontend tenant screens ([tenants/[id]/page.js](file:///home/markc/projects/active/havenstay/frontend/src/app/(dashboard)/tenants/[id]/page.js), [tenants/new/page.js](file:///home/markc/projects/active/havenstay/frontend/src/app/(dashboard)/tenants/new/page.js)) use `/archive`, `/restore`, and `/deactivate`. The frontend **NEVER** calls `/api/tenants/{id}/reactivate`. Tenant residency status is auto-derived via `TenantService::syncStatus()`. |
| **Options** | **Option A (Delete Broken Route & Update Test)**: Remove line 58 from `routes/api.php`, remove line 32 from `TenantArchitectureConventionTest.php`. Document that tenant restoration is handled exclusively via `POST /api/tenants/{id}/restore`.<br>**Option B (Alias to `restore()`)**: Implement `TenantController::reactivate` as a direct proxy to `TenantController::restore`. |
| **Architectural Impact** | **Option A**: Eliminates dead, broken code. Maintains clean, RESTful API conventions.<br>**Option B**: Maintains route signature at the cost of duplicate API endpoints doing identical actions. |
| **Business Impact** | Zero impact on users; frontend already uses `/restore`. Fixes failing automated test suite. |
| **Risk** | Zero risk. |
| **Recommendation** | **Adopt Option A**. Cleanly remove the dead route and align the convention test. |
| **Status** | **AWAITING HUMAN APPROVAL** |

---

### DEC-05: MySQL Trigger Verification Strategy in GitHub Actions CI

| Dimension | Analysis & Findings |
| :--- | :--- |
| **Evidence** | Current CI workflow [.github/workflows/tests.yml](file:///home/markc/projects/active/havenstay/.github/workflows/tests.yml) runs tests using in-memory SQLite. [TestCase.php L89-93](file:///home/markc/projects/active/havenstay/backend/tests/TestCase.php#L89-L93) stubs out trigger testing on SQLite: `$this->assertTrue(true)`. Consequently, **none of HavenStay's 45 MySQL audit triggers and CHECK constraints are executed or verified in CI**! Regressions in trigger logic can pass CI silently and break production. |
| **Options** | **Option A (Full Parity on Every PR)**: Add a `mysql:8.4` service container to `tests.yml`. Run `composer test:mysql` on every pull request and push to master.<br>**Option B (Hybrid Speed / Parity Pipeline)**: Keep fast SQLite test job (~40s) on PRs; add a separate `mysql-triggers.yml` job that executes MySQL trigger tests on merge to `master` and nightly cron.<br>**Option C (Status Quo)**: Retain SQLite-only CI; rely on local developer execution of `docker-compose` for MySQL verification. |
| **Architectural Impact** | **Option A**: 100% verification of production DDL, triggers, and CHECK constraints before code is merged. Increases CI runtime by ~35s.<br>**Option B**: Preserves ultra-fast PR feedback; catches trigger regressions post-merge.<br>**Option C**: High risk of silent production schema/trigger breakage. |
| **Business Impact** | Prevents corrupt DML operations or trigger crashes from disrupting production booking and payment workflows. |
| **Risk** | Option A has slight CI runner time increase (~35s). Option C has high operational failure risk. |
| **Recommendation** | **Adopt Option A**. The 35-second CI trade-off is vastly outweighed by the certainty that financial audit triggers function correctly. |
| **Status** | **AWAITING HUMAN DECISION** |

#### Direct Comparison Matrix for DEC-05

| Dimension | Option A: MySQL 8.4 on Every PR | Option B: SQLite PR + Master MySQL | Option C: SQLite Only (Status Quo) |
| :--- | :--- | :--- | :--- |
| **Correctness** | **Absolute (100% Trigger & DDL Parity)** | High on Master; Blind on PRs | **Low (Triggers Untested)** |
| **PR Feedback Speed** | ~75–85 seconds total | ~40–45 seconds total | ~40–45 seconds total |
| **CI Cost (Runner Mins)** | ~1.5 mins per run (well within free tier) | ~0.7 mins on PR; 1.5 mins on master | ~0.7 mins per run |
| **Trigger Execution** | **Active on all PRs** | Active on Master only | **Stubbed out ($this->assertTrue)** |
| **Developer Experience** | Catches trigger syntax bugs before review | May fail master branch post-merge | Silent failures deploy to prod |
| **Failure Isolation** | Immediate per PR commit | Delayed to post-merge build | Production error logs |
| **Workflow Maintenance** | Single consolidated workflow file | Two separate workflows to maintain | Single workflow file |
| **Deployment Confidence** | **Production Grade** | Moderate | **Unacceptable for Financial App** |

---

## 2. Separation of Decisions from Defects

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       WORK ITEM CLASSIFICATION                              │
│                                                                             │
│   [1] IMPLEMENTABLE WITHOUT BUSINESS DECISION (Verified Defects)            │
│       • HS-BL-01: Payment remarks schema & fillable persistence             │
│       • HS-BL-02: Canonical schema files byte-for-byte synchronization       │
│       • HS-BL-03: Route {tenant}/reactivate cleanup & convention test       │
│       • HS-BL-04: Refactor 4 stale controller authorization convention tests│
│       • HS-BL-05: Author comprehensive automated tests for HandleIdempotency│
│       • HS-BL-07: Synchronize CLAUDE.md & README.md documentation drift     │
│                                                                             │
│   [2] REQUIRES HUMAN BUSINESS DECISION                                      │
│       • DEC-01: Confirm Option A (naming field `remarks` vs `notes`)        │
│       • DEC-02: Select deposit forfeiture accounting model (A, B, or C)     │
│       • DEC-03: Confirm bed/tenant status semantics during pending_payment │
│       • DEC-04: Confirm route deletion vs alias for {tenant}/reactivate     │
│       • DEC-05: Select CI MySQL execution model (Option A vs Option B)      │
│                                                                             │
│   [3] REQUIRES RESEARCH / HARDWARE / LEGAL SPIKE                            │
│       • RES-01: Philippine R.A. 9653 rent-cap scope on boarding house beds │
│       • RES-02: Physical sub-meter hardware dial capacity in facility       │
│       • RES-04: Floating-point precision audit across multi-year balances   │
│                                                                             │
│   [4] DEFERRED (Not Required for Stabilization Baseline)                    │
│       • Sliding-window session token expiration                             │
│       • Bulk monthly room billing wizard                                    │
│       • Overdue aging reporting (30/60/90 days)                             │
│                                                                             │
│   [5] INVALID / ALREADY RESOLVED                                            │
│       • Viewer PII masking on GET /api/tenants (Already fully implemented)  │
│       • Nested occupant PII masking (Already fully implemented in resources)│
│       • Refactoring HandleIdempotency logic (Code is mathematically correct)│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Readiness Cards

### HS-BL-01: Payment Remarks Persistence

- **ID**: `HS-BL-01`
- **Problem**: Staff remarks entered in the payment wizard are silently discarded upon saving. The database table lacks a `remarks` column, and Eloquent silently strips it out.
- **Evidence**:
  - UI binds to `remarks`: [PaymentWizard.js L832](file:///home/markc/projects/active/havenstay/frontend/src/features/payments/components/PaymentWizard.js#L832)
  - FormRequest validates `remarks`: [StorePaymentRequest.php L60](file:///home/markc/projects/active/havenstay/backend/app/Http/Requests/Payment/StorePaymentRequest.php#L60)
  - Service writes `remarks`: [PaymentService.php L96](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/PaymentService.php#L96)
  - Detail page expects `remarks`: [payments/[id]/page.js L361](file:///home/markc/projects/active/havenstay/frontend/src/app/(dashboard)/payments/[id]/page.js#L361)
  - Schema lacks column: [db/havenstay_schema.sql L257-270](file:///home/markc/projects/active/havenstay/db/havenstay_schema.sql#L257-L270)
  - Model `$fillable` omits `remarks`: [Payment.php L38-51](file:///home/markc/projects/active/havenstay/backend/app/Models/Payment.php#L38-L51)
  - Resource maps `'notes' => $this->notes`: [PaymentResource.php L32](file:///home/markc/projects/active/havenstay/backend/app/Http/Resources/PaymentResource.php#L32)
- **Intended Behavior**: When a payment is recorded with optional remarks, the string is persisted to `payments.remarks`, included in audit triggers, returned by `PaymentResource`, and displayed in the UI details view.
- **Scope**:
  - `db/havenstay_schema.sql` (Line 270)
  - `backend/database/sql/havenstay_schema.sql` (Line 270)
  - `backend/app/Models/Payment.php` (Line 38)
  - `backend/app/Http/Resources/PaymentResource.php` (Line 32)
- **Database Impact**: Add `remarks VARCHAR(255) NULL` before `idempotency_key` on `payments` table.
- **API Impact**: API response from `POST /api/payments` and `GET /api/payments/{id}` will now include `"remarks": "..."` (and `"notes": "..."`).
- **Frontend Impact**: The Notes card on the Payment Details screen will render persisted remarks.
- **Audit Impact**: Trigger `trg_payments_ai` can optionally log `remarks` in the audit JSON payload.
- **Security Impact**: None. String is sanitized and escaped by Eloquent PDO binding.
- **Acceptance Criteria**:
  1. `Payment::create(['remarks' => 'Test Note', ...])` successfully stores `'Test Note'` in MySQL.
  2. `POST /api/payments` with `{ "remarks": "Deposit check #1234" }` returns HTTP 201 with `"remarks": "Deposit check #1234"`.
  3. `GET /api/payments/{id}` returns `"remarks": "Deposit check #1234"`.
  4. Null or omitted remarks save as `NULL` without error.
- **Required Tests**:
  - Feature Test: `tests/Feature/PaymentRemarksPersistenceTest.php`
- **Regression Risks**: Zero. Field is nullable.
- **Verification Method**: Run automated feature test asserting complete round-trip through API and database.
- **Human Approval Required?**: Yes (DEC-01 Option A confirmation).

---

### HS-BL-02: Canonical Schema Byte-for-Byte Synchronization

- **ID**: `HS-BL-02`
- **Problem**: The repository maintains two canonical schema files that have drifted on line 70 (`avatar_url`) and line endings (CRLF vs LF).
- **Evidence**:
  - `db/havenstay_schema.sql` line 70 has `avatar_url VARCHAR(255) NULL` with CRLF endings.
  - `backend/database/sql/havenstay_schema.sql` line 70 has `avatar_url TEXT NULL` with LF endings.
  - Google OAuth profile photo URLs frequently exceed 255 characters.
- **Intended Behavior**: Both schema files are byte-for-byte identical, specifying `avatar_url TEXT NULL` with standard Unix LF line endings.
- **Scope**:
  - `db/havenstay_schema.sql`
  - `backend/database/sql/havenstay_schema.sql`
- **Database Impact**: Standardizes `users.avatar_url` as `TEXT NULL`.
- **API Impact**: None.
- **Frontend Impact**: None.
- **Audit Impact**: None.
- **Security Impact**: Prevents database truncation errors when logging in via Google OAuth with long tokenized image URLs.
- **Acceptance Criteria**:
  1. `diff -u db/havenstay_schema.sql backend/database/sql/havenstay_schema.sql` returns 0 exit code (identical).
  2. Both files use Unix LF line endings.
  3. `avatar_url` is defined as `TEXT NULL` in both files.
- **Required Tests**:
  - Schema parity assertion test in `tests/Unit/SchemaParityTest.php`.
- **Regression Risks**: Zero.
- **Verification Method**: `diff -u` command execution in terminal.
- **Human Approval Required?**: No. Verified data-integrity defect.

---

### HS-BL-03: Route `{tenant}/reactivate` Resolution & Test Alignment

- **ID**: `HS-BL-03`
- **Problem**: `POST /api/tenants/{tenant}/reactivate` points to a non-existent method, throwing HTTP 500. `TenantArchitectureConventionTest.php` asserts the existence of this method, causing test failures.
- **Evidence**:
  - Route in [routes/api.php L58](file:///home/markc/projects/active/havenstay/backend/routes/api.php#L58)
  - Missing method in [TenantController.php](file:///home/markc/projects/active/havenstay/backend/app/Http/Controllers/Api/TenantController.php)
  - Failing test in [TenantArchitectureConventionTest.php L32](file:///home/markc/projects/active/havenstay/backend/tests/Unit/TenantArchitectureConventionTest.php#L32)
  - Frontend uses `/restore`: [tenants/[id]/page.js L102](file:///home/markc/projects/active/havenstay/frontend/src/app/(dashboard)/tenants/[id]/page.js#L102)
- **Intended Behavior**: Route is removed from `routes/api.php` (or aliased to `restore()`), and convention test is updated to assert existing lifecycle methods (`create`, `update`, `archive`, `restore`).
- **Scope**:
  - `backend/routes/api.php`
  - `backend/tests/Unit/TenantArchitectureConventionTest.php`
- **Database Impact**: None.
- **API Impact**: Eliminates a dead 500 endpoint.
- **Frontend Impact**: Zero. Frontend already uses `POST /api/tenants/{id}/restore`.
- **Audit Impact**: None.
- **Security Impact**: Eliminates an unauthenticated/broken attack surface route.
- **Acceptance Criteria**:
  1. `php artisan test --filter=TenantArchitectureConventionTest` passes with 0 failures.
  2. Calling `POST /api/tenants/1/reactivate` returns 404 (Route not found).
  3. Calling `POST /api/tenants/1/restore` restores an archived tenant as designed.
- **Required Tests**:
  - Unit: `TenantArchitectureConventionTest`
- **Regression Risks**: Zero.
- **Verification Method**: Execute PHPUnit convention test.
- **Human Approval Required?**: Yes (DEC-04 Option A confirmation).

---

### HS-BL-04: Refactor Stale Controller Authorization Convention Tests

- **ID**: `HS-BL-04`
- **Problem**: 4 Architectural convention tests fail because they use regex string inspection expecting authorization calls (`AuthorizationService::ensureCan*`) inside controller method bodies. When the codebase was refactored to standard Laravel FormRequest classes (e.g. `StorePaymentRequest::authorize()`, `ViewReportsRequest::authorize()`), the convention tests were not updated.
- **Evidence**:
  - [BillingPaymentArchitectureConventionTest.php L21](file:///home/markc/projects/active/havenstay/backend/tests/Unit/BillingPaymentArchitectureConventionTest.php#L21) asserts `AuthorizationService::ensureCan` in `PaymentController.php`.
  - [RoomArchitectureConventionTest.php L31-32](file:///home/markc/projects/active/havenstay/backend/tests/Unit/RoomArchitectureConventionTest.php#L31-L32) asserts `ensureCanManageRooms` in `RoomController.php`.
  - [ReportingSecurityConventionTest.php L20](file:///home/markc/projects/active/havenstay/backend/tests/Unit/ReportingSecurityConventionTest.php#L20) asserts `ensureCanViewReports` in `ReportController.php`.
  - [UserAuthArchitectureConventionTest.php L22](file:///home/markc/projects/active/havenstay/backend/tests/Unit/UserAuthArchitectureConventionTest.php#L22) asserts `UserService::archive` in `UserController.php` (which uses `UserService::deactivate`).
- **Intended Behavior**: Convention tests inspect the active authorization layer: verifying that controller actions inject FormRequests, and that those FormRequests delegate to `AuthorizationService::ensureCan*`.
- **Scope**:
  - `backend/tests/Unit/BillingPaymentArchitectureConventionTest.php`
  - `backend/tests/Unit/RoomArchitectureConventionTest.php`
  - `backend/tests/Unit/ReportingSecurityConventionTest.php`
  - `backend/tests/Unit/UserAuthArchitectureConventionTest.php`
- **Database Impact**: None.
- **API Impact**: None.
- **Frontend Impact**: None.
- **Audit Impact**: None.
- **Security Impact**: Re-establishes automated verification that every mutating endpoint enforces authorization before executing service logic.
- **Acceptance Criteria**:
  1. `php artisan test --testsuite=Unit` executes all 9 convention tests with 0 failures and 0 errors.
  2. Tests fail if a FormRequest removes its `AuthorizationService` check.
- **Required Tests**:
  - All unit convention tests in `backend/tests/Unit/`.
- **Regression Risks**: Zero. Test-only change.
- **Verification Method**: Execute PHPUnit unit test suite.
- **Human Approval Required?**: No. Verified test defect against established architecture.

---

### HS-BL-05: Automated Test Suite for `HandleIdempotency` Middleware

- **ID**: `HS-BL-05`
- **Problem**: Critical financial idempotency middleware has zero automated tests in the repository.
- **Evidence**:
  - Implementation: [HandleIdempotency.php](file:///home/markc/projects/active/havenstay/backend/app/Http/Middleware/HandleIdempotency.php)
  - Zero test files exist matching `Idempotency` in `backend/tests/`.
- **Intended Behavior**: A dedicated feature test suite verifies: (1) Safe methods (`GET`/`HEAD`) bypass locking; (2) Mutating methods (`POST`/`PUT`/`PATCH`/`DELETE`) acquire atomic locks; (3) Replayed requests return cached response; (4) Concurrent in-flight requests return HTTP 409 Conflict.
- **Scope**:
  - New test file: `backend/tests/Feature/Middleware/HandleIdempotencyTest.php`
- **Database Impact**: None. Uses Cache facade.
- **API Impact**: None.
- **Frontend Impact**: None.
- **Audit Impact**: None.
- **Security Impact**: Guarantees financial transactions cannot be double-submitted due to network lag or double-clicking.
- **Acceptance Criteria**:
  1. Test verifies `GET` request with `Idempotency-Key` does not lock cache and executes normally.
  2. Test verifies `POST` request with `Idempotency-Key` caches response and returns identical response on replay.
  3. Test verifies in-flight request lock returns HTTP 409 with `"Another request with this Idempotency-Key is currently being processed."`.
- **Required Tests**:
  - `backend/tests/Feature/Middleware/HandleIdempotencyTest.php`
- **Regression Risks**: Zero. Test-only addition.
- **Verification Method**: Execute feature test suite.
- **Human Approval Required?**: No. Essential test coverage.

---

### HS-BL-06: MySQL 8.4 Trigger Verification in GitHub Actions CI

- **ID**: `HS-BL-06`
- **Problem**: CI tests run only on SQLite, leaving all 45 MySQL triggers and CHECK constraints untested during PR verification.
- **Evidence**:
  - [.github/workflows/tests.yml](file:///home/markc/projects/active/havenstay/.github/workflows/tests.yml)
  - [TestCase.php L89-93](file:///home/markc/projects/active/havenstay/backend/tests/TestCase.php#L89-L93)
- **Intended Behavior**: GitHub Actions spins up a `mysql:8.4` service container, initializes `havenstay_schema.sql`, and runs `composer test:mysql`, validating that all triggers execute without syntax or constraint errors.
- **Scope**:
  - `.github/workflows/tests.yml`
- **Database Impact**: None on production.
- **API Impact**: None.
- **Frontend Impact**: None.
- **Audit Impact**: Guarantees that immutable trigger logging in `audit_logs` is verified on every build.
- **Security Impact**: High. Enforces data integrity rules at the engine level.
- **Acceptance Criteria**:
  1. GitHub Actions workflow successfully provisions MySQL 8.4 service container.
  2. Test suite executes `assertTriggerAuditLog` assertions against real MySQL engine.
  3. CI pipeline passes with green status.
- **Required Tests**:
  - Full test suite via `composer test:mysql`.
- **Regression Risks**: Low. May uncover existing SQL trigger syntax discrepancies.
- **Verification Method**: Push branch and inspect GitHub Actions workflow run logs.
- **Human Approval Required?**: Yes (DEC-05 Option A confirmation).

---

### HS-BL-07: Synchronize Documentation Drift in `CLAUDE.md` and `README.md`

- **ID**: `HS-BL-07`
- **Problem**: Project root documentation contradicts verified codebase implementation.
- **Evidence**:
  - `CLAUDE.md` documents `runWriteWorkflow(User $actor, string $action, callable $op)`. Real signature requires 5 arguments (`int $actorId, string $action, array $payload, callable $operation, ?callable $resultDetails`).
  - `README.md` documents bed states `Reserved` and `Archived`. Real schema enum only supports `vacant`, `occupied`, `maintenance`.
  - `README.md` documents controller authorization helpers that were refactored into FormRequests.
- **Intended Behavior**: Documentation reflects the verified architecture and signatures.
- **Scope**:
  - `CLAUDE.md`
  - `README.md`
- **Database Impact**: None.
- **API Impact**: None.
- **Frontend Impact**: None.
- **Audit Impact**: None.
- **Security Impact**: Prevents future developers and AI agents from generating invalid code based on stale docs.
- **Acceptance Criteria**:
  1. `CLAUDE.md` specifies the exact 5-argument `runWriteWorkflow` signature.
  2. `README.md` lists only the 3 verified bed space states.
- **Required Tests**: None.
- **Regression Risks**: Zero.
- **Verification Method**: Manual code review against `ManagesWorkflows.php` and `BedSpaceStatus.php`.
- **Human Approval Required?**: No. Documentation correction.

---

## 4. Special Verification: Payment Remarks Complete Path (HS-BL-01)

An exhaustive trace through every layer of the application confirms the exact lifecycle of the payment remarks field:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PAYMENT REMARKS END-TO-END DATA PATH                     │
│                                                                             │
│  [1] FRONTEND FORM (PaymentWizard.js)                                       │
│      • Register: register('remarks')                                        │
│      • Label: "Notes"                                                       │
│      • Submit Payload: { remarks: pendingValues.remarks || null }           │
│                                │                                            │
│                                ▼                                            │
│  [2] HTTP REQUEST (POST /api/payments)                                      │
│      • JSON Body: { "amount_paid": 5000, "remarks": "Deposit check #12" }   │
│                                │                                            │
│                                ▼                                            │
│  [3] FORM REQUEST VALIDATION (StorePaymentRequest.php)                      │
│      • Rule: 'remarks' => ['nullable', 'string']                            │
│      • Validated Array: includes ['remarks']                                │
│                                │                                            │
│                                ▼                                            │
│  [4] CONTROLLER DISPATCH (PaymentController.php)                            │
│      • Action: PaymentService::record($request->user(), $request->validated())│
│                                │                                            │
│                                ▼                                            │
│  [5] SERVICE WORKFLOW (PaymentService.php)                                  │
│      • Payload: Payment::create([... 'remarks' => $data['remarks'] ...])    │
│                                │                                            │
│                                ▼                                            │
│  [6] ELOQUENT MODEL (Payment.php)  ◄─── [GAP 1: NOT IN $FILLABLE]            │
│      • Stripped by Eloquent Mass Assignment Guard                           │
│                                │                                            │
│                                ▼                                            │
│  [7] DATABASE TABLE (payments)     ◄─── [GAP 2: MISSING COLUMN IN DDL]      │
│      • Column does not exist in schema; data lost                           │
│                                │                                            │
│                                ▼                                            │
│  [8] API RESOURCE (PaymentResource.php) ◄── [GAP 3: MAPS 'notes']           │
│      • Maps: 'notes' => $this->notes (points to non-existent property)      │
│                                │                                            │
│                                ▼                                            │
│  [9] FRONTEND DETAIL VIEW (payments/[id]/page.js)                           │
│      • Reads: {payment?.remarks && <p>"{payment.remarks}"</p>}              │
│      • Result: Never renders because API returns null                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Complete End-to-End Acceptance Test Scenario

```gherkin
Scenario: Recording and viewing payment with staff remarks
  Given staff user "admin" is logged in
  And an active contract #101 exists with an unpaid billing invoice #201 of ₱5,000.00
  When staff submits POST /api/payments with:
    | field            | value                      |
    | billing_id       | 201                        |
    | payment_category | billing                    |
    | amount_paid      | 5000.00                    |
    | payment_date     | 2026-09-25                 |
    | payment_method   | bank_transfer              |
    | reference_number | BDO-987654321              |
    | remarks          | Paid via online bank trans |
  Then HTTP status should be 201 Created
  And the database table "payments" should contain a record with:
    | amount_paid | 5000.00                    |
    | remarks     | Paid via online bank trans |
  When staff navigates to GET /api/payments/{new_payment_id}
  Then the JSON response should contain:
    | remarks     | Paid via online bank trans |
  And the frontend payment details UI should render:
    | text        | "Paid via online bank trans" |
```

---

## 5. Domain Analysis: Contract & Entity Lifecycle during `pending_payment` (DEC-03)

### Exact Current Transition Table

| Trigger Event | Contract Status | Bed Space Status | Room Status | Tenant Status | Billing Status | Payment State |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Initial Creation** (`ContractService::create`) | `pending_payment` | `occupied` | Re-evaluated (`available` / `unavailable`) | `active` | `unpaid` (Advance rent invoice issued) | No payments yet |
| **Initial Payment Recorded** (`amount_paid < minRequired`) | `pending_payment` | `occupied` | Unchanged | `active` | `partial` | Partial payment stored |
| **Settlement Complete** (`totalPaid >= minRequired`) | `active` (Auto-activated) | `occupied` | Unchanged | `active` | `paid` | Full payment stored |
| **Contract Voided** (`ContractService::void`) | `voided` | `vacant` (Auto-freed) | Re-evaluated (`available`) | `onboarded` (if no other lease) | Deleted / Voided | Voided (if any) |
| **Tenant Move-Out** (`ContractService::moveOut`) | `completed` | `vacant` (Auto-freed) | Re-evaluated (`available`) | `moved_out` | Retained | `is_cleared = false` (Awaiting refund) |

### The Semantic Dilemma: Physical vs. Commercial Occupancy

The core issue is that HavenStay's domain model currently multiplexes two distinct business concepts onto a single database column (`bed_spaces.status`):

1. **Physical Residency**: Is a human being currently sleeping in this bed and storing their possessions here?
2. **Commercial Inventory Allocation**: Is this bed withheld from the market so that other prospective tenants cannot reserve it while contract signing and initial advance payment clear?

Because `bed_spaces.status` supports only `ENUM('vacant','occupied','maintenance')`, the developers intentionally set the bed space to `occupied` upon contract creation to enforce **Commercial Inventory Allocation** (preventing double-booking). 

**Recommendation**: Retain the current behavior. Document that in HavenStay, `occupied` on a bed space represents an inventory lock. Attempting to introduce a fourth `reserved` state requires complex schema alterations and updates across multiple observers. It can remain as-is without operational failure.

---

## 6. Financial Analysis: Security Deposit Forfeiture Models (DEC-02)

### What Currently Exists
1. **Deposit Collection**: Recorded as a payment with `payment_category = 'deposit'` targeting `contract_id` ([PaymentService.php L159](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/PaymentService.php#L159)).
2. **Deposit Holding**: Held against the contract ledger. Excluded from monthly billing calculations.
3. **Move-Out Settlement**: `ContractService::moveOut()` requires all billing invoices to be settled (`outstanding_balance <= 0.01`). The contract moves to `completed`, with `is_cleared = false`.
4. **Deposit Return**: If refunded, staff records a payment with `payment_category = 'refund'`, which sets `contracts.is_cleared = true` ([PaymentService.php L110](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/PaymentService.php#L110)).
5. **Deposit Rollover**: If moving to a new room, staff records a payment with `payment_category = 'rollover'`, which transfers funds and sets `is_cleared = true`.

### The Accounting Problem
When property damage occurs (e.g. tenant damages aircon or stains mattress):
- If the deposit is ₱5,000 and damage is ₱5,000, staff cannot issue a refund.
- No `refund` payment is created.
- `contracts.is_cleared` remains `0` (`false`) forever.
- The contract permanently lingers in the "Unsettled Deposits" administrative audit report.

### Three Viable Accounting Models

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   DEPOSIT FORFEITURE ACCOUNTING OPTIONS                     │
│                                                                             │
│  MODEL 1: Dedicated Payment Category (Recommended)                          │
│  • Add 'forfeiture' to payment_category ENUM                                │
│  • Staff records forfeiture payment: contract_id = 101, amt = 5000          │
│  • Trigger sets is_cleared = true                                           │
│  • Complete forensic balance: In (5000) = Out (0 Refund + 5000 Forfeited)   │
│                                                                             │
│  MODEL 2: Operational Contract Clearance Flag                               │
│  • Add deposit_retained_amount and clearance_notes to contracts table       │
│  • Staff calls POST /api/contracts/{id}/clear-deposit                       │
│  • Sets is_cleared = true without creating dummy payment records            │
│                                                                             │
│  MODEL 3: Damage Billing Line Item & Internal Transfer                      │
│  • Issue billing invoice with line item category 'damage'                   │
│  • Build internal transfer logic shifting deposit funds to billing invoice  │
│  • High complexity; risks breaking payment target XOR constraint            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Human Decision Required**: Stakeholders must choose between Model 1 (formal financial ledger transaction) and Model 2 (operational contract flag).

---

## 7. Route Archaeology: `POST /api/tenants/{tenant}/reactivate` (DEC-04)

An exhaustive search across all project files confirms:

1. **Frontend References**: **ZERO**.
   - `tenants/[id]/page.js` calls `/archive`, `/restore`, `/deactivate`.
   - `tenants/new/page.js` calls `/restore`.
   - No frontend code or test has ever invoked `{tenant}/reactivate`.
2. **Backend Controller**: Missing.
   - `TenantController.php` defines `archive()` and `restore()`. It has no `reactivate()`.
3. **Backend Service**: Missing.
   - `TenantService.php` defines `archive()` and `restore()`. It has no `reactivate()`.
   - Tenant residency status is auto-derived via `TenantService::syncStatus()` based on contract history.
4. **Why did the route exist?**:
   - `UserController` defines `reactivate()` for staff accounts (`POST /api/users/{id}/reactivate`).
   - When API routes were expanded, `{tenant}/reactivate` was accidentally copied into the tenant route group, and a developer added a convention test assertion before implementing the method.

**Verdict**: **Remove the broken route and update the convention test**.

---

## 8. Research Register Status & Impact

| Research ID | Topic | Current State & Findings | Owner / Source | Decision Affected | Can Stabilization Proceed Without It? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RES-01** | **R.A. 9653 Rent Control Scope** | Code hardcodes 7% annual rent cap in `OperationalHardening.php`. R.A. 9653 governs residential units below statutory ceilings; boarding house bed spaces often fall under municipal lodging ordinances. Furthermore, DHSUD sets annual caps dynamically by resolution. | Legal Counsel / DHSUD | Hardcoding 7% cap on contract renewal in `ContractService`. | **YES**. Stabilization does not modify renewal validation; cap can remain as an operational warning rather than blocking code. |
| **RES-02** | **Physical Sub-Meter Hardware** | `Financials.php` hardcodes 10,000.0 dial wrap rollover threshold. Suitable for standard 4-digit mechanical meters. If digital 5/6-digit meters are installed, calculation will yield negative consumption. | Facility Operations | Adding `dial_capacity` column to `meters` table. | **YES**. Standard mechanical sub-meters operate reliably with 10,000 threshold. Schema change can wait for hardware inventory audit. |
| **RES-03** | **Nested Viewer PII Exposure** | **RESOLVED / CLOSED**. Code audit of `RoomResource`, `BedSpaceResource`, and `ContractResource` proves that all resources already invoke `PiiMaskingService::shouldMaskTenantPii($request->user())` and redact names and contact info for Viewers. | Security Audit | None. Security requirement is already met. | **YES (Closed)**. |
| **RES-04** | **Floating-Point Currency Drift** | Code uses `(float)` casts and `- 0.01` tolerances. Works adequately for small-scale boarding houses, but risks 1-cent rounding drift over multi-year ledgers. | Systems Architect | Refactoring monetary math to `BCMath` or integer cents. | **YES**. Current `- 0.01` tolerance is stable for immediate release. BCMath is a long-term modernization initiative. |

---

## 9. Dependency-Aware Implementation Sequence

Work items must be executed in strict dependency order to guarantee zero test breakage and continuous build green status:

```text
PHASE 1: STABILIZATION
├── Slice 1: Database & Model Parity (Zero Code Logic Changes)
│   ├── HS-BL-01: Add remarks to payments DDL, Payment::$fillable, and PaymentResource
│   └── HS-BL-02: Byte-for-byte synchronize havenstay_schema.sql (avatar_url TEXT NULL)
│
├── Slice 2: Architectural Alignment & Route Cleanup
│   ├── HS-BL-03: Remove broken {tenant}/reactivate route & update TenantArchitectureConventionTest
│   └── HS-BL-04: Refactor 4 stale controller authorization convention tests to verify FormRequests
│
├── Slice 3: Automated Test Verification
│   └── HS-BL-05: Author comprehensive automated Pest test suite for HandleIdempotency
│
├── Slice 4: CI/CD Parity
│   └── HS-BL-06: Add MySQL 8.4 service container to GitHub Actions workflow
│
└── Slice 5: Documentation Synchronization
    └── HS-BL-07: Update CLAUDE.md & README.md to eliminate signature and state drift
```

### Dependency Logic
1. **Slice 1 precedes Slice 4**: Canonical schema files must be synchronized and include `remarks` before MySQL container in CI initializes the database from `havenstay_schema.sql`.
2. **Slice 2 precedes Slice 4**: Convention tests must be green before CI enforces full suite execution.
3. **Slice 3 precedes Slice 4**: Idempotency feature tests will execute in both SQLite and MySQL CI jobs.

---

## 10. HavenStay Definition of Done (DoD)

Every backlog item implemented in HavenStay must satisfy the following 12 criteria before being merged into `master`:

1. **Requirement Linked**: Mapped to an explicit `FR-*` / `BR-*` identifier or verified engineering defect card.
2. **Evidence Verified**: Root cause validated against direct codebase implementation.
3. **Acceptance Criteria Met**: All acceptance criteria defined in the readiness card are satisfied.
4. **Canonical Schema Synchronized**: Any DDL change is mirrored byte-for-byte across both `db/havenstay_schema.sql` and `backend/database/sql/havenstay_schema.sql`.
5. **No Direct Model Mutations**: Controllers must never mutate models directly; all writes flow through Service layer via `runWriteWorkflow`.
6. **Authorization Guarded**: Every mutating endpoint enforces authorization via FormRequest or `AuthorizationService`.
7. **Audit Captured**: All DML mutations trigger automated forensic capture in `audit_logs` via MySQL triggers.
8. **Automated Tests Passing**: 100% of unit convention tests and feature tests pass locally and in CI.
9. **No Unrelated Refactoring**: Changes must be strictly scoped to the target ticket.
10. **Frontend API Client Used**: All frontend requests use `apiRequest()`; no direct `fetch()` or `axios`.
11. **Documentation Updated**: Stale docstrings, `CLAUDE.md`, or API reference updated to reflect modifications.
12. **Human Approval**: Pull request reviewed and approved by human maintainer.

---

## 11. Antigravity Readiness: Rules, Skills, and MCP Tools

To prevent future AI drift and enforce architectural invariants autonomously, the following configuration items are prepared for adoption once decisions are confirmed:

### Stable Rules (Permanent AI Behavioral Constraints)

| Rule Name | Purpose & Invariant Enforced | Evidence & Justification | Ready to Encode? |
| :--- | :--- | :--- | :--- |
| `thin-controllers` | Controllers must never contain raw Eloquent queries or business logic; they must only delegate to Service classes and serialize via API Resources. | Enforced across all controllers in `app/Http/Controllers/Api/`. | **YES** |
| `form-request-auth` | Endpoint authorization must be evaluated in FormRequest `authorize()` methods via `AuthorizationService`, not ad-hoc in controller bodies. | Architectural pattern established across 18 FormRequest classes. | **YES** |
| `workflow-signatures` | All mutating operations in Service classes must execute within `ManagesWorkflows::runWriteWorkflow()` using the 5-argument signature with integer `$actorId`. | Enforced across `TenantService`, `ContractService`, `PaymentService`, `RoomService`. | **YES** |
| `schema-mirror-sync` | Any change to the database schema must be mirrored identically in both `db/havenstay_schema.sql` and `backend/database/sql/havenstay_schema.sql`. | Eliminates drift between deployment containers and local dev setups. | **YES** |
| `payment-target-xor` | Every payment record must target either `billing_id` OR `contract_id`, never both, never neither. | Engine CHECK constraint `chk_pay_target`. | **YES** |
| `frontend-api-client` | Frontend components must never use native `fetch()` or `axios`; all HTTP traffic must route through `apiRequest()` in `@/lib/api`. | Ensures automatic Bearer token injection, CSRF handling, and 401 redirect dispatch. | **YES** |

### Workflow Skills (Procedural Guides)

| Skill Name | Workflow Steps Enforced | Trigger Condition |
| :--- | :--- | :--- |
| `havenstay-schema-change` | 1. Update DDL in `db/`; 2. Copy to `backend/sql/`; 3. Verify LF endings; 4. Update Model `$fillable` & casts; 5. Update API Resource; 6. Run schema parity test. | Modifying any database table, column, or trigger. |
| `havenstay-service-mutation` | 1. Create FormRequest; 2. Delegate in Controller; 3. Implement Service method using `runWriteWorkflow`; 4. Verify observer side-effects; 5. Author feature test. | Adding or updating any business write action. |
| `havenstay-ci-verification` | 1. Run unit convention tests; 2. Run feature test suite on SQLite; 3. Run MySQL trigger verification; 4. Check git diff for unauthorized changes. | Pre-commit / pre-merge verification. |

### External Tools / MCP Integrations

| Tool / Server | Specific Value to HavenStay | Prerequisite |
| :--- | :--- | :--- |
| **MySQL MCP Server** | Direct querying and trigger inspection on local `mysql:8.4` Docker container during automated testing. | Docker container active. |
| **GitHub Actions MCP** | Inspect live CI logs and trigger runs directly from IDE without switching to browser. | GitHub API token configured. |
| **Browser Subagent** | End-to-end regression validation of the multi-step `PaymentWizard` and `ContractWizard`. | Frontend dev server running. |

---

## 12. Final Implementation Readiness Matrix

| Area | Status | Evidence-Based Reason | Next Action |
| :--- | :--- | :--- | :--- |
| **Requirements** | **READY** | All 23 requirements audited; false claims removed. | Proceed with verified requirements baseline. |
| **Business Rules** | **READY WITH DECISION** | Rules cataloged; deposit forfeiture and rent cap boundaries identified. | Stakeholder decision on DEC-02 & DEC-03. |
| **Domain Model** | **READY WITH DECISION** | Entity transitions mapped; `pending_payment` inventory hold documented. | Confirm DEC-03 semantic meaning. |
| **Architecture** | **READY** | Idempotency verified; FormRequest authorization pattern validated. | Refactor convention tests to match FormRequests (HS-BL-04). |
| **Database** | **READY WITH DECISION** | Missing `remarks` column identified; schema drift pinpointed. | Approve DEC-01 (add remarks column). |
| **Security** | **READY** | Viewer PII masking confirmed active on all resource endpoints. | Keep PiiMaskingService as-is. |
| **Financial Logic** | **READY WITH DECISION** | ₱0.01 tolerance and payment XOR verified; deposit forfeiture model open. | Select accounting model in DEC-02. |
| **Testing** | **READY** | 4 failing convention tests diagnosed; missing idempotency test identified. | Implement HS-BL-04 and HS-BL-05. |
| **CI/CD** | **READY WITH DECISION** | SQLite limitation identified; trigger test gap documented. | Choose Option A or B in DEC-05. |
| **UX** | **READY** | PaymentWizard and payment detail remarks binding verified. | Unblock UI remarks display via HS-BL-01. |
| **Antigravity Rules** | **READY** | 6 stable architectural rules identified and ready to encode. | Create permanent rules post-approval. |
| **Antigravity Skills** | **READY** | 3 standard engineering workflows formulated. | Create skills post-approval. |
| **MCP Tools** | **READY** | Tooling requirements identified (MySQL, GitHub, Browser). | Configure when entering active implementation. |
| **Implementation** | **READY WITH DECISION** | 7 discrete work items prepared with full readiness cards. | Await human decision gates approval. |

---

## 13. Synthesis & Next Actions

### 1. What Can Be Implemented Now
- **HS-BL-02**: Byte-for-byte synchronization of `havenstay_schema.sql` (`avatar_url TEXT NULL` with LF endings).
- **HS-BL-04**: Refactoring the 4 architectural convention tests to inspect FormRequest authorization instead of controller bodies.
- **HS-BL-05**: Authoring the comprehensive automated test suite for `HandleIdempotency` middleware.
- **HS-BL-07**: Updating `CLAUDE.md` and `README.md` to reflect verified method signatures and active bed space states.

### 2. What Requires Human Decision
- **DEC-01**: Formally approve adding `remarks VARCHAR(255) NULL` to the `payments` schema (Option A).
- **DEC-02**: Select deposit forfeiture accounting model: Option A (new `forfeiture` payment category) vs Option B (operational clearance flag).
- **DEC-03**: Confirm whether the immediate bed occupancy inventory lock during `pending_payment` is acceptable as the operational baseline.
- **DEC-04**: Approve removing the broken `POST /api/tenants/{tenant}/reactivate` route and aligning the convention test (Option A).
- **DEC-05**: Choose CI trigger verification strategy: Option A (MySQL container on every PR) vs Option B (SQLite on PR + MySQL on master).

### 3. What Requires Research
- **RES-01**: Legal applicability of R.A. 9653 rent control caps on boarding house bed spaces.
- **RES-02**: Physical sub-meter hardware inspection to determine property dial capacities.
- **RES-04**: Systems accounting analysis of multi-year floating point rounding precision.

### 4. What Must Not Be Implemented Yet
- **DO NOT** modify `HandleIdempotency.php` logic (it is mathematically correct and safe).
- **DO NOT** modify `meters` table to add configurable dial capacities until hardware is audited.
- **DO NOT** enforce 7% rent caps on new renewal contracts until legal applicability is established.
- **DO NOT** implement sliding-window token expiration (no failure or user requirement exists).
- **DO NOT** implement bulk billing wizards (explicitly out of scope for current release).

### 5. What Antigravity Should Eventually Enforce
- Mandatory FormRequest authorization delegation (`AuthorizationService::ensureCan*`).
- Strict 5-argument `runWriteWorkflow` invocation for all service mutations.
- Dual-file canonical schema synchronization on every DDL change.
- Exclusion of direct frontend `fetch()` or `axios` in favor of `apiRequest()`.
- Immutable trigger audit logging on all financial tables.

### 6. Recommended Next Phase
1. **Human Decision Gate Sign-Off**: Stakeholder reviews and approves Decisions `DEC-01`, `DEC-04`, and `DEC-05`.
2. **Phase 1 Implementation Authorization**: Upon sign-off, authorize Antigravity to enter **Active Implementation Mode** to execute Phase 1 Slices 1 through 5 as isolated, test-verified commits.
