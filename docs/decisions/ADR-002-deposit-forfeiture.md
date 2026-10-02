# ADR-002: Security Deposit Forfeiture & Clearance Policy

> **Status**: `AWAITING HUMAN APPROVAL`  
> **Date**: September 25, 2026  
> **Deciders**: Systems Architect, Chief Financial Officer / Business Owner, Technical Lead  
> **Technical Scope**: Financial Accounting, Contracts Lifecycle, Payment Categories, Administrative Audit Queue  

---

## Context

HavenStay requires tenants to pay a security deposit upon lease check-in (capped at ≤ 2 months' rent pursuant to R.A. 9653 / BR-CON-006). Deposits are held in escrow against the contract ledger. When a tenant moves out, their billing invoices must be settled (`outstanding_balance <= 0.01`). The deposit is then either returned to the tenant (`refund`) or rolled over to a new room agreement (`rollover`), which updates `contracts.is_cleared = true`.

---

## Problem

When a tenant moves out with property damage, cleaning deductions, unpaid utilities, or early departure forfeiture, staff cannot issue a full refund. 
Under current code:
- If a tenant causes damage equal to their deposit, the refund amount is ₱0.00.
- Database constraint `chk_pay_amount CHECK (amount_paid > 0)` rejects any ₱0 payment record.
- Because `contracts.is_cleared` is ONLY set to `true` upon recording a payment of category `refund` or `rollover` ([PaymentService.php L110](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/PaymentService.php#L110)), a contract with a forfeited deposit can **never** be cleared!
- The completed lease remains permanently stuck in the "Unsettled Deposits" audit queue.

---

## Evidence

1. **Balance Check Before Move-Out**: [ContractService.php L390-398](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/ContractService.php#L390-L398) requires `outstanding_balance <= 0.01` before allowing move-out, setting contract status to `completed`.
2. **Clearance Trigger Dependency**: [PaymentService.php L110-112](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/PaymentService.php#L110-L112) states:
   ```php
   if (in_array($category, ['refund', 'rollover'])) {
       $contract->update(['is_cleared' => true]);
   }
   ```
3. **Database Payment Categories**: Schema defines `ENUM('billing','deposit','refund','rollover')`. It has no category for forfeiture, retained damage deductions, or penalty recognition.
4. **Positive Amount Constraint**: `havenstay_schema.sql L280` enforces `CONSTRAINT chk_pay_amount CHECK (amount_paid > 0)`.

---

## Options Considered

### Option A: Dedicated `forfeiture` Payment Category (Recommended)
Add `'forfeiture'` to `payments.payment_category` enum. Staff records a forfeiture payment against the contract with `amount_paid = forfeited_amount`, `reference_number = damage_assessment_ref`, and notes describing the deduction. PaymentService sets `contracts.is_cleared = true`.
- *Accounting Meaning*: Forfeiture is recorded in the ledger as a cash-outflow offset / recognized damage income. Total Deposit Collected = Refunds Issued + Forfeitures Retained.

### Option B: Operational Contract-Clearance Action
Retain the existing 4 payment categories. Introduce an operational endpoint `POST /api/contracts/{id}/clear-deposit` accepting `retained_amount` and `clearance_notes`, storing these on the contract and setting `is_cleared = true`.
- *Accounting Meaning*: Deposit settlement is treated as an operational contract lifecycle event without creating pseudo-payment records in the cash ledger.

### Option C: Damage Billing Line Item & Internal Offset Transfer
Require staff to generate a billing invoice with a line item of type `'damage'`, and build a transaction mechanism to transfer funds from the contract deposit balance to the billing line item.
- *Accounting Meaning*: Standard accounts receivable offset. High complexity due to payment XOR target constraint (`chk_pay_target`).

---

## Decision

**Proposed Decision**: **Human Decision Required**. Select between **Option A** (formal financial ledger transaction) and **Option B** (operational contract clearance action).

*(Do not implement during immediate stabilization; author an RFC once stakeholder confirms bookkeeping policy).*

---

## Rationale

- Option A provides the most rigorous, double-entry financial audit trail: the total deposit paid into a contract exactly equals the sum of refunds paid out plus forfeitures retained.
- Option B is operationally simpler for staff who do not treat deposit retention as a cash transaction.
- Because this decision impacts financial reporting and tax recognition for liquidated damages, it cannot be decided solely by software engineers.

---

## Consequences

### Positive
- Contracts with partial or full deposit forfeiture can be formally closed out.
- The "Unsettled Deposits" administrative report will accurately reflect true outstanding liabilities.

### Negative / Trade-offs
- Option A requires migrating `payments.payment_category` enum in MySQL and updating frontend payment category dropdowns.
- Option B requires adding two columns to `contracts` table.

---

## Rejected Alternatives

- **Option C (Billing Offset)**: Rejected for current phase due to high architectural risk and potential conflict with the payment XOR integrity constraint.

---

## Acceptance Criteria

1. Staff can settle a completed lease where 100% of the deposit was withheld for damages.
2. The contract's `is_cleared` field transitions to `true`.
3. The retained amount and audit justification are permanently recorded.
4. The contract is removed from the active unsettled deposit queue.

---

## Related Requirements

- `REQ-011`: Tenant move-out clearance and balance settlement
- `REQ-012`: Deposit refund and rollover clearance tracking
- `BR-CON-007`: Gate pass / move-out clearance rules
- `BR-PAY-010`: Security deposit settlement rules

---

## Related Backlog Items

- `DEC-02`: Security deposit forfeiture handling (Deferred to post-stabilization RFC).
