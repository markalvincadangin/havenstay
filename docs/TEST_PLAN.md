# HavenStay Master Test Plan & Acceptance Criteria

**Version:** 2.1  
**Last Updated:** April 29, 2026  
**Status:** Authoritative QA Baseline — Stabilization Release (v5.1)
---

## 1. Scope and Strategy
This document defines the Acceptance Criteria (AC) and critical Test Cases (TC) required to validate the HavenStay BHMS against its Business Rules (BR) and Software Requirements Specification (SRS). 

**Test Strategy:**
* **Unit Testing:** Validates pure business logic (e.g., `BillingService` calculating balances).
* **Integration Testing:** Validates database write atomicity, forensic triggers, and temporal pricing queries.
* **Course Compliance (CCR) Validation:** Ensures all academic database requirements are physically demonstrable.

---

## 2. Core Acceptance Criteria (by Domain)

### AC-1: Roles and Security (BR-GEN-003, BR-GEN-004)
* **Given** a user is logged in as a `Viewer`,
* **When** they attempt to `POST /api/contracts`,
* **Then** the API must reject the request with a `403 Forbidden` and log the unauthorized attempt.

### AC-2: Occupancy State Machine (BR-ROM-003, BR-ROM-004)
* **Given** a Room with 2 Bed Spaces (both `vacant`),
* **When** a new Contract is finalized for Bed A,
* **Then** Bed A must update to `occupied`, Bed B must remain `vacant`, and the Room must remain `available`.
* **When** a Contract is finalized for Bed B,
* **Then** the Room status must automatically update to `unavailable`.

### AC-3: Temporal Utility Pricing (BR-MET-006)
* **Given** a Utility Rate of ₱12.00 effective `Jan 1`, and a new Rate of ₱15.00 effective `May 1`,
* **When** generating a billing cycle for `April 15 to May 14`,
* **Then** the system must calculate the utility charge using the ₱12.00 rate (the rate active at the *start* of the period).

### AC-4: Meter Monotonicity (BR-MET-005)
* **Given** a Meter's last reading was `1,500.5`,
* **When** Staff submits a new reading of `1,490.0` with `is_rollover: false`,
* **Then** the system must reject the reading with a `422 Validation Error`.

### AC-5: Void & Recalculation Integrity (BR-BIL-007, BR-PAY-004)
* **Given** a Billing Cycle with a ₱5,000 balance and a ₱5,000 payment applied (Status: `paid`),
* **When** Staff voids the ₱5,000 payment,
* **Then** the payment must be marked `voided_at` (not deleted), AND the Billing Cycle status must immediately revert to `unpaid` (or `overdue` depending on the date).

---

## 3. Critical Test Cases

### TC-01: The "Phantom Move-In" Prevention
* **Objective:** Verify DB transactions prevent partial state changes.
* **Action:** Attempt to create a contract, but simulate a database failure during the deposit insertion.
* **Expected Result:** The `DB::transaction()` rolls back. The bed remains `vacant`, the room capacity is unaffected, and no partial mutations appear in the `audit_logs`.

### TC-02: Shared Room Apportionment (BR-MET-010)
* **Objective:** Verify dynamic utility splitting.
* **Action:** Submit a water meter reading yielding a ₱1,000 charge for a Shared Room with 2 active contracts. Generate bills for both tenants.
* **Expected Result:** Tenant A's bill includes a ₱500 utility line item. Tenant B's bill includes a ₱500 utility line item.

### TC-04: Financial XOR Violation
* **Objective:** Verify database-level exclusive relationship enforcement.
* **Action:** Attempt to insert a payment record containing both a `billing_id` and a `contract_id`.
* **Expected Result:** Database throws a `CHECK constraint violation` (XOR failure). Record creation is rejected.

### TC-05: Fractional Penny Reconciliation
* **Objective:** Verify zero-balance drift in utility apportionment (BR-MET-010).
* **Action:** Split a ₱50.00 utility charge among 3 shared-room tenants.
* **Expected Result:** Tenant A (earliest contract) is billed ₱16.68. Tenants B and C are billed ₱16.66. Total lines (16.68 + 16.66 + 16.66) exactly equals 50.00.

### TC-08: Forensic Re-registration Performance
* **Objective:** Verify virtual keys permit re-use of emails after soft-delete.
* **Action:** Soft-delete Tenant A (email: `a@test.com`). Attempt to register a new Tenant B with the same email `a@test.com`.
* **Expected Result:** Registration is successful. Both profiles exist in forensic history, but only Tenant B is active.

### TC-09: Security Deposit Rollover
* **Objective:** Verify cross-contract deposit transfers (BR-PAY-009).
* **Action:** Assign a `rollover` category payment to Contract B, with `reference_number` = 'Contract A ID'.
* **Expected Result:** Payment is successfully committed. Contract B shows the bond balance; Contract A shows a corresponding transfer-out event.

### TC-10: Utility Reference Mandate
* **Objective:** Verify database-level utility traceability (Level 5 Hardening).
* **Action:** Attempt to insert a `billing_line_items` record with `item_type = 'utility'` but `utility_id = NULL`.
* **Expected Result:** Database throws a `CHECK constraint violation`. Record creation is rejected.

### TC-11: Resilient Batch Billing (BR-BIL-010)
* **Objective:** Verify that individual contract errors do not block room-wide processing.
* **Action:** Trigger batch billing for a Room where one contract has a deliberate validation conflict (e.g., overlapping dates).
* **Expected Result:** The system traps the conflict, logs a failure for the specific tenant, but successfully generates billing for all other eligible tenants in the room.

### TC-12: Dual-Path Payment Resolution (BR-PAY-011)
* **Objective:** Verify that direct contract-linked payments (Security Deposits) resolve correctly in the UI.
* **Action:** Post a payment with `contract_id` set and `billing_id` as NULL.
* **Expected Result:** The Payments List and Detail pages correctly display the Tenant Name and Room Number by traversing the `contract` relationship.

### TC-13: API Idempotency Enforcement
* **Objective:** Verify protection against duplicate financial transactions.
* **Action:** Submit a Payment POST request twice using the same `Idempotency-Key` header.
* **Expected Result:** The first request succeeds; the second request returns a conflict or the original response, but creates NO second record in the database.

---

## 4. Course Compliance Sign-Off Matrix

Before final submission to the evaluator, the following must be successfully demonstrated:

| ID | Requirement | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **CCR-001** | ≥ 6 tables in relational DB | `SHOW TABLES;` (Must show 15 core tables) | Ready |
| **CCR-002** | Distributed DB (Primary/Replica) | Write to Primary, `SELECT` from Replica | Ready |
| **CCR-003** | SQL CRUD logic | Run Application workflows (Create, Read, Update) | Ready |
| **CCR-004** | AND, OR, BETWEEN, LIKE | Execute `vw_collections_summary` with date filter | Ready |
| **CCR-005** | Multi-table JOINs | Query `vw_billing_summary` (5-table JOIN) | Ready |
| **CCR-006** | ACID Transactions | Show `DB::beginTransaction()` in service code | Ready |
| **CCR-007** | AFTER Triggers | Show `audit_logs` auto-populating on changes | Ready |

---

## 5. Revision History

| Version | Date | Changes |
| :--- | :--- | :--- |
| v1.0–v1.4 | 2026-03–04 | Initial test strategy through forensic hardening. |
| v2.0 | 2026-04-29 | Major Stabilization: Added TC-11 (Resilient Batching), TC-12 (Dual-Path Resolution), and TC-13 (Idempotency). Aligned to Docs v5.1 / BR v2.1. |
| **v2.1** | **2026-04-29** | **Clean State Release: Synchronized all references to match the new continuous Business Rule numbering (v2.2). Aligned to Docs v5.2.** |

*Aligned to: SRS.md v5.2 · SDD.md v5.2 · DATABASE.md v5.2 · BUSINESS_RULES.md v2.2*
