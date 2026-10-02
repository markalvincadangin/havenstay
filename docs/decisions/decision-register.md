# HavenStay — Architecture & Product Decision Register

> **Document Type**: Architecture & Product Decision Register  
> **Status**: Official Decision Baseline  
> **Date**: September 25, 2026  
> **Governing Principle**: `FACT → EVIDENCE → REQUIREMENT → BUSINESS RULE → GAP → DECISION → ACCEPTANCE CRITERIA → BACKLOG → IMPLEMENTATION → VERIFICATION`  
> **Authority**: Human Stakeholder & Maintainer Sign-Off Required

---

## Overview

This register formally records the open architectural, financial, domain, and infrastructure decision gates identified during repository archaeology and plan validation. 

Each item separates **verified codebase facts** from **proposed recommendations**, ensuring that Antigravity and future engineers do not mistake technical preferences or engineering workarounds for established business policy.

---

## Summary of Decision Gates

| Decision ID | Domain | Topic | Status | Implementation Readiness |
| :--- | :--- | :--- | :--- | :--- |
| **DEC-01** | Database / Financial | Payment Remarks Field Naming & Persistence | **AWAITING HUMAN APPROVAL** | Ready upon approval (HS-BL-01) |
| **DEC-02** | Accounting / Financial | Security Deposit Forfeiture & Clearance Policy | **AWAITING HUMAN APPROVAL** | Blocked by accounting policy |
| **DEC-03** | Domain / Inventory | Bed Space & Tenant Semantics during `pending_payment` | **AWAITING HUMAN APPROVAL** | Ready upon baseline confirmation |
| **DEC-04** | API / Routing | Disposal of Broken `POST /api/tenants/{tenant}/reactivate` | **AWAITING HUMAN APPROVAL** | Ready upon approval (HS-BL-03) |
| **DEC-05** | DevOps / Testing | MySQL Trigger & DDL Verification in GitHub Actions CI | **AWAITING HUMAN APPROVAL** | Ready upon approval (HS-BL-06) |

---

## Decision Gate Details

### DEC-01: Payment Remarks Field Naming & Persistence

- **Question**: Should HavenStay standardize payment remarks on `remarks` or rename the entire pipeline to `notes`?
- **Related ADR**: [ADR-001-payment-remarks.md](file:///home/markc/projects/active/havenstay/docs/decisions/ADR-001-payment-remarks.md)
- **Current Evidence**:
  - UI Input: [PaymentWizard.js L832](file:///home/markc/projects/active/havenstay/frontend/src/features/payments/components/PaymentWizard.js#L832) registers `remarks`.
  - Request Payload: Sends `{ remarks: pendingValues.remarks }`.
  - Validation: [StorePaymentRequest.php L60](file:///home/markc/projects/active/havenstay/backend/app/Http/Requests/Payment/StorePaymentRequest.php#L60) validates `'remarks' => ['nullable', 'string']`.
  - Service: [PaymentService.php L96](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/PaymentService.php#L96) passes `'remarks' => $data['remarks']`.
  - UI Display: [payments/[id]/page.js L361](file:///home/markc/projects/active/havenstay/frontend/src/app/(dashboard)/payments/[id]/page.js#L361) renders `{payment?.remarks}`.
  - The Breakage: `payments` table schema lacks `remarks`; `Payment::$fillable` omits `remarks`; [PaymentResource.php L32](file:///home/markc/projects/active/havenstay/backend/app/Http/Resources/PaymentResource.php#L32) maps `'notes' => $this->notes`.
- **Options Considered**:
  - **Option A (Recommended)**: Standardize on `remarks`. Add `remarks VARCHAR(255) NULL` to both canonical schema files, add `remarks` to `Payment::$fillable`, and update `PaymentResource` to export `'remarks' => $this->remarks, 'notes' => $this->remarks`.
    - *Consequence*: 1 schema column addition; 0 frontend changes; 0 service changes. Restores end-to-end notes capture.
  - **Option B**: Standardize on `notes`. Refactor `PaymentWizard.js`, `StorePaymentRequest.php`, `StoreCompositePaymentRequest.php`, `PaymentService.php`, and `payments/[id]/page.js`.
    - *Consequence*: Touches 7 files across frontend and backend to rename an established working variable name.
- **Human Decision Required**: Confirm adoption of Option A (Standardize on `remarks`).
- **Status**: **AWAITING HUMAN APPROVAL**

---

### DEC-02: Security Deposit Forfeiture & Clearance Policy

- **Question**: How should HavenStay represent a security deposit that is retained because of damages, cleaning fees, unpaid utilities, or early departure penalty?
- **Related ADR**: [ADR-002-deposit-forfeiture.md](file:///home/markc/projects/active/havenstay/docs/decisions/ADR-002-deposit-forfeiture.md)
- **Current Evidence**:
  - [ContractService.php L390](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/ContractService.php#L390) enforces balance settlement (≤ ₱0.01) prior to move-out.
  - [PaymentService.php L110](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/PaymentService.php#L110) sets contract `is_cleared = true` ONLY when a payment is created with category `refund` or `rollover`.
  - The Breakage: If a deposit is retained for damages, staff cannot issue a ₱0 refund (prevented by `chk_pay_amount CHECK (amount_paid > 0)`). Consequently, `is_cleared` remains `false` forever, leaving the contract permanently stuck in the "Unsettled Deposits" administrative audit queue.
- **Options Considered**:
  - **Option A (Dedicated Payment Category)**: Add `'forfeiture'` to `payments.payment_category` enum. Staff records a forfeiture payment against the contract ledger with `amount_paid = retained_amount`, `reference_number = damage_assessment_ref`. Trigger/service sets `is_cleared = true`.
    - *Accounting Meaning*: Retained deposit is formally recognized in the financial transactions ledger as liquidated damages / retained revenue. Total In = Total Out (Refund + Forfeiture).
  - **Option B (Operational Contract Clearance Action)**: Add `deposit_retained_amount` and `clearance_notes` to `contracts` table. Provide an operational endpoint `POST /api/contracts/{id}/clear-deposit`.
    - *Accounting Meaning*: Forfeiture is treated as an operational lease status settlement rather than a cash payment event.
  - **Option C (Damage Billing Invoice + Internal Transfer)**: Issue a billing invoice for damages, and build an internal deposit-to-billing credit transfer mechanism.
    - *Accounting Meaning*: Deposit is used as an accounts receivable offset. High architectural complexity due to payment XOR constraint (`chk_pay_target`).
- **Human Decision Required**: Select accounting model (Option A vs Option B vs Option C) based on HavenStay's tax and bookkeeping policy.
- **Status**: **AWAITING HUMAN APPROVAL**

---

### DEC-03: Bed Space & Tenant Status Semantics During `pending_payment`

- **Question**: What does `bed_spaces.status = 'occupied'` mean while a contract is still in `pending_payment` status?
- **Related ADR**: [ADR-003-pending-payment-occupancy.md](file:///home/markc/projects/active/havenstay/docs/decisions/ADR-003-pending-payment-occupancy.md)
- **Current Evidence**:
  - [ContractService.php L145-166](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/ContractService.php#L145-L166) creates a contract in `pending_payment`, immediately calls `RoomService::occupyBedSpace()`, and calls `TenantService::syncStatus()`.
  - Database state: `bed_spaces.status = 'occupied'`, `tenants.status = 'active'`, `billing.status = 'unpaid'`.
  - The Ambiguity: Bed space schema only supports `ENUM('vacant','occupied','maintenance')`. It has no `reserved` status. `occupied` is used simultaneously for **physical residency** and **commercial inventory allocation**.
- **Options Considered**:
  - **Option A (Preserve Commercial Inventory Lock Baseline)**: Confirm that `occupied` represents commercial inventory reservation. If the tenant fails to pay, staff voids the contract, which returns the bed to `vacant` and tenant to `onboarded`.
    - *Consequence*: 0 code changes. Clarifies domain documentation. Prevents double-booking.
  - **Option B (Refactor Tenant Status Only)**: Keep bed `occupied` (preventing double-booking), but modify `TenantService::syncStatus()` so tenant status remains `onboarded` until payment clearance triggers contract activation.
    - *Consequence*: 3 lines of code in `TenantService.php`. More accurate tenant directory statistics.
  - **Option C (Introduce Formal `reserved` Bed State)**: Migrate `bed_spaces.status` enum to include `reserved`. Update room capacity math, observers, UI badges, and reports.
    - *Consequence*: High complexity schema migration across 8 core files; high regression risk.
- **Human Decision Required**: Confirm Option A (or Option B) as the operational baseline. Reject Option C for stabilization.
- **Status**: **AWAITING HUMAN APPROVAL**

---

### DEC-04: Disposal of Broken `POST /api/tenants/{tenant}/reactivate` Route

- **Question**: What should happen to `POST /api/tenants/{tenant}/reactivate` in `routes/api.php`?
- **Related ADR**: [ADR-004-tenant-reactivate-route.md](file:///home/markc/projects/active/havenstay/docs/decisions/ADR-004-tenant-reactivate-route.md)
- **Current Evidence**:
  - [routes/api.php L58](file:///home/markc/projects/active/havenstay/backend/routes/api.php#L58) maps route to `TenantController::reactivate`.
  - Neither `TenantController` nor `TenantService` defines `reactivate()`. Calling it throws HTTP 500 (`BadMethodCallException`).
  - [TenantArchitectureConventionTest.php L32](file:///home/markc/projects/active/havenstay/backend/tests/Unit/TenantArchitectureConventionTest.php#L32) asserts that `TenantService::reactivate()` exists, causing the test suite to fail.
  - Frontend archaeology: Frontend uses `POST /api/tenants/{id}/restore`. Frontend **never** calls `reactivate`. Tenant residency status is auto-synchronized via `syncStatus()` based on contract history.
- **Options Considered**:
  - **Option A (Recommended)**: Remove `Route::post('{tenant}/reactivate')` from `routes/api.php`. Update `TenantArchitectureConventionTest.php` to assert existing methods (`create`, `update`, `archive`, `restore`).
    - *Consequence*: Clean removal of dead, broken code. Restores green test suite. Zero frontend impact.
  - **Option B**: Implement `TenantController::reactivate` as a duplicate alias to `TenantController::restore`.
    - *Consequence*: Preserves endpoint at the cost of duplicate REST APIs doing identical actions.
- **Human Decision Required**: Confirm adoption of Option A (Remove dead route & update convention test).
- **Status**: **AWAITING HUMAN APPROVAL**

---

### DEC-05: MySQL Trigger Verification Strategy in GitHub Actions CI

- **Question**: How should MySQL audit triggers, CHECK constraints, and schema parity be verified in GitHub Actions CI?
- **Related ADR**: [ADR-005-mysql-ci-verification.md](file:///home/markc/projects/active/havenstay/docs/decisions/ADR-005-mysql-ci-verification.md)
- **Current Evidence**:
  - Current CI workflow [.github/workflows/tests.yml](file:///home/markc/projects/active/havenstay/.github/workflows/tests.yml) runs PHPUnit on in-memory SQLite.
  - [TestCase.php L89-93](file:///home/markc/projects/active/havenstay/backend/tests/TestCase.php#L89-L93) explicitly stubs out trigger testing on SQLite: `$this->assertTrue(true)`.
  - The Gap: Zero of HavenStay's 45 MySQL audit triggers and CHECK constraints are executed in CI. Broken trigger SQL or schema regressions deploy undetected.
- **Options Considered**:
  - **Option A (Recommended)**: Add `mysql:8.4` service container to `tests.yml`. Execute `composer test:mysql` on every pull request and push to master.
    - *Consequence*: 100% verification of production DDL, triggers, and immutability invariants before code merge. Increases CI runtime by ~35s (total run ~80s).
  - **Option B**: Retain SQLite on PRs for speed (~45s); create a separate `mysql-triggers.yml` workflow executing on merge to `master` and nightly cron.
    - *Consequence*: Fast PR feedback, but trigger syntax errors are only discovered after merging to master.
  - **Option C**: Status quo (SQLite only).
    - *Consequence*: Critical financial audit triggers remain completely untested in CI. High production regression risk.
- **Human Decision Required**: Confirm adoption of Option A (Full MySQL parity on every PR).
- **Status**: **AWAITING HUMAN APPROVAL**

---

## 4. Separation of Decision from Implementation

| Decision | Human Decision Needed? | Implementation Ready? | Blocked By | Action Upon Approval |
| :--- | :--- | :--- | :--- | :--- |
| **DEC-01** | **Yes** | **Yes** | Human approval of Option A | Implement HS-BL-01 (Add column to DDL, `$fillable`, and resource) |
| **DEC-02** | **Yes** | **No** | Stakeholder bookkeeping/tax policy choice | Author RFC / specification for chosen deposit forfeiture model |
| **DEC-03** | **Yes** | **Yes** | Stakeholder confirmation of baseline semantics | Document inventory lock invariant; update `BUSINESS_RULES.md` |
| **DEC-04** | **Yes** | **Yes** | Human approval of Option A | Implement HS-BL-03 (Delete route & update convention test) |
| **DEC-05** | **Yes** | **Yes** | Human approval of Option A | Implement HS-BL-06 (Add MySQL container to `tests.yml`) |

---

## 5. Human Sign-Off Block

*Decisions marked below require explicit confirmation by the human project maintainer before entering Active Implementation Mode:*

```text
[ ] DEC-01 Approved: Standardize on 'remarks' (Option A)
[ ] DEC-02 Approved: Deposit forfeiture model selected (Model: ____)
[ ] DEC-03 Approved: Commercial inventory lock semantics confirmed (Option A)
[ ] DEC-04 Approved: Remove dead {tenant}/reactivate route (Option A)
[ ] DEC-05 Approved: Full MySQL 8.4 verification in CI on every PR (Option A)

Signed: ___________________________   Date: ____________________
```
