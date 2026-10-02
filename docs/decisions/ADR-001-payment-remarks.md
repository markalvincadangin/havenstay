# ADR-001: Standardization of Payment Remarks Field

> **Status**: `AWAITING HUMAN APPROVAL`  
> **Date**: September 25, 2026  
> **Deciders**: Systems Architect, Technical Lead, Human Maintainer  
> **Technical Scope**: Database Schema, Eloquent Models, API Resources, Frontend Payment Wizard  

---

## Context

During payment recording (rent settlements, security deposits, utility payments, refunds, and rollovers), front-desk staff frequently record operational transaction notes (e.g. check numbers, bank branch details, deposit source references, or special payment arrangements). The system was designed to capture this metadata across the entire onboarding and payment lifecycle.

---

## Problem

Staff remarks entered in the frontend payment wizard are silently discarded upon saving. The payment record is created successfully, but the notes string is never persisted to the database. When viewing the payment details screen, the "Notes" section is either empty or missing.

---

## Evidence

1. **Frontend Input**: [PaymentWizard.js L827-832](file:///home/markc/projects/active/havenstay/frontend/src/features/payments/components/PaymentWizard.js#L827-L832) renders `<Field label="Notes">` with `<Textarea id="remarks" {...register('remarks')} />`.
2. **Request Submission**: [PaymentWizard.js L500](file:///home/markc/projects/active/havenstay/frontend/src/features/payments/components/PaymentWizard.js#L500) constructs the payload `{ remarks: pendingValues.remarks || null }`.
3. **FormRequest Validation**: [StorePaymentRequest.php L60](file:///home/markc/projects/active/havenstay/backend/app/Http/Requests/Payment/StorePaymentRequest.php#L60) and [StoreCompositePaymentRequest.php L39](file:///home/markc/projects/active/havenstay/backend/app/Http/Requests/Payment/StoreCompositePaymentRequest.php#L39) explicitly validate `'remarks' => ['nullable', 'string']`.
4. **Service Write**: [PaymentService.php L96](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/PaymentService.php#L96) passes `'remarks' => $data['remarks'] ?? null` to `Payment::create()`.
5. **Frontend Details Display**: [payments/[id]/page.js L361](file:///home/markc/projects/active/havenstay/frontend/src/app/(dashboard)/payments/[id]/page.js#L361) renders `{payment?.remarks && <p>"{payment.remarks}"</p>}`.
6. **The Missing Schema Column**: Canonical schema [db/havenstay_schema.sql L257-288](file:///home/markc/projects/active/havenstay/db/havenstay_schema.sql#L257-L288) lacks a `remarks` column.
7. **The Mass-Assignment Block**: [Payment.php L38-51](file:///home/markc/projects/active/havenstay/backend/app/Models/Payment.php#L38-L51) omits `remarks` from `$fillable`.
8. **The Resource Mapping Typo**: [PaymentResource.php L32](file:///home/markc/projects/active/havenstay/backend/app/Http/Resources/PaymentResource.php#L32) attempts to map `'notes' => $this->notes`.

---

## Options Considered

### Option A: Standardize on `remarks` (Recommended)
Add `remarks VARCHAR(255) NULL` to both canonical schema files, add `remarks` to `Payment::$fillable`, and update `PaymentResource` to export `'remarks' => $this->remarks, 'notes' => $this->remarks`.

### Option B: Rename the Entire Pipeline to `notes`
Rename input bindings in `PaymentWizard.js`, update validation keys in `StorePaymentRequest` and `StoreCompositePaymentRequest`, update `PaymentService.php`, add `notes` column to schema, and update `payments/[id]/page.js`.

---

## Decision

**Proposed Decision**: Adopt **Option A**. Standardize the field name as `remarks` across database, model, and API resources, while retaining `'notes' => $this->remarks` in `PaymentResource` for dual-key backward compatibility.

*(Subject to explicit human stakeholder approval).*

---

## Rationale

1. **Follow the Dominant Code Intent**: 6 out of 7 layers in the application already use `remarks`. The only discrepancy was the omission of the schema column, omission from `$fillable`, and the single line in `PaymentResource.php`.
2. **Minimal Surface Area**: Option A requires zero frontend modifications and zero service modifications.
3. **Dual-Key Safety**: Providing both `remarks` and `notes` in the serialized JSON resource guarantees that any legacy consumer expecting either key receives the value.

---

## Consequences

### Positive
- Prevents permanent loss of transaction notes on all payments.
- Restores rendering of the Notes box on payment detail pages.
- Zero churn on frontend components or FormRequest validation classes.

### Negative / Trade-offs
- Schema DDL files must be updated and database containers migrated/re-initialized.

---

## Rejected Alternatives

- **Option B (Rename to `notes`)**: Rejected due to high churn. Renaming an established, working identifier across 6 active files introduces unnecessary regression risk for zero functional gain.

---

## Acceptance Criteria

1. Database table `payments` contains `remarks VARCHAR(255) NULL` placed before `idempotency_key`.
2. `Payment::$fillable` includes `'remarks'`.
3. `PaymentResource::toArray()` contains both `'remarks' => $this->remarks` and `'notes' => $this->remarks`.
4. Feature test asserts that submitting `POST /api/payments` with `{ "remarks": "Check #48291" }` returns HTTP 201 with `"remarks": "Check #48291"`, persists the value to the database, and is retrievable via `GET /api/payments/{id}`.

---

## Related Requirements

- `REQ-023`: Payment remarks persistence
- `FR-042`: Payment history and forensic audit tracking
- `BR-PAY-003`: Payment metadata and auditability rules

---

## Related Backlog Items

- `HS-BL-01`: Payment remarks persistence (Readiness Card approved for Phase 1, Slice 1).
