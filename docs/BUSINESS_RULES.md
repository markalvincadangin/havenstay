# HavenStay Boarding House Management System (BHMS)
## Business Rules (BR)

**Version:** 2.2  
**Last Updated:** April 29, 2026  
**Status:** Authoritative logic and behavioral constraints

---

## 1. Introduction and Scope

### 1.1 Purpose
This document defines the authoritative business rules governing the HavenStay Boarding House Management System (BHMS). These rules are technology-agnostic and must be enforced regardless of the architectural layer (UI, API, or Database).

### 1.2 Rule Classification
Rules are identified using the format **BR-[Category]-[###]**:
- **GEN**: General System Rules
- **TEN**: Tenant Rules
- **ROM**: Room and Bed Space Rules
- **CON**: Contract Rules
- **BIL**: Billing Rules
- **PAY**: Payment Rules
- **MET**: Meter and Utility Rules
- **ANL**: Analytical and Reporting Rules
- **AUD**: Audit and Forensics

---

## 2. General System Rules

**BR-GEN-001** 
Every user account must have a unique username and a unique email address across the entire system.

**BR-GEN-002** 
No record in any core entity table may be permanently deleted from the database. Deletion is prevented through architectural safeguards: Tenants, Rooms, Bed Spaces, Contracts, Users, and Utilities utilize soft deletes (`deleted_at`). Meters are protected via state transitions (`status` = `replaced`), and Utility Rates are protected via temporal effective dates. All historical records must remain queryable for audit purposes.

**BR-GEN-003** 
Soft-deleted records (Tenants, Users) shall not block the creation of new profiles with the same unique identifiers (Email, Username). Uniqueness is enforced only among active records to permit re-registration while preserving historical audit trails.

**BR-GEN-004**
The system enforces three roles with fixed permission scopes: Admin, Staff, and Viewer. A user must have exactly one role at any time.

**BR-GEN-005**
Admin has full system access including user management, all
operational modules, and audit log inspection.

**BR-GEN-006**
Staff has operational access to tenants, rooms, contracts,
billing, and payments, but cannot manage user accounts or
view audit logs.

**BR-GEN-007**
Viewer has read-only access to operational modules (Tenants, Rooms,
Contracts). Viewers cannot access the reports module or create, edit,
or delete any record.

**BR-GEN-008**
Analytical reporting and data exports are restricted to System
Administrators to protect tenant privacy and financial integrity.

**BR-GEN-009**
An authenticated user is prohibited from deactivating, archiving, or changing the system role of their own account. These operations must be performed by another System Administrator to maintain security oversight and prevent self-lockout or unauthorized privilege escalation.

---

## 3. Tenant Rules

**BR-TEN-001**
A tenant profile is the identity record of an individual tenant.
Every tenant must have a first name, last name, contact number,
email address, emergency contact name, emergency contact number,
and home address on record before any contract may be created.

**BR-TEN-002**
A tenant's email address must be unique across all tenant records
in the system.

**BR-TEN-003**
A tenant may hold at most one active contract at any given time.

**BR-TEN-004**
A tenant's status is maintained automatically from their contract history
and must not be set manually except for the `archived` state:
- `active` — the tenant has at least one active contract
- `moved_out` — the tenant has no active contracts but has
  at least one completed or terminated contract
- `archived` — manually set by an Admin; prevents new contracts
  from being created for this tenant

**BR-TEN-005**
An archived tenant cannot be assigned to a new contract unless
their status is first restored to active or moved_out by an Admin.
`Archived` is an operational status; it is distinct from forensic
soft-deletion (`deleted_at`).

---

## 4. Room and Bed Space Rules

**BR-ROM-001**
Every room must have a unique room code and a capacity of
at least one.

**BR-ROM-002**
Room types are either `private` (single occupant) or `shared`
(multiple occupants). Private rooms contain exactly one bed space.
Shared rooms contain two or more bed spaces.

**BR-ROM-003**
Room status is maintained automatically from the occupancy of
its bed spaces and must never be set manually:
- `available` — at least one bed space is `vacant` and the
  room is not under maintenance
- `unavailable` — all bed spaces are `occupied` or
  `maintenance`, with none `vacant`
- `maintenance` — the entire room unit is taken offline by staff;
  individual bed spaces within it are not bookable

**BR-ROM-004**
Bed space status values are `vacant`, `occupied`, and
`maintenance`. A bed space may only be `occupied` when it is
assigned to a contract in an `active` or `pending_payment` state.

**BR-ROM-005**
A bed space under `maintenance` status may not be assigned to
a new contract until its status is restored to `vacant` by staff.

**BR-ROM-006**
Every bed space must have a label (e.g. "Bed A", "Bed 1") that
is unique within its room.

**BR-ROM-007**
Decommissioning a room is an operational state change, not a forensic removal. 
- A `decommissioned` room is locked for editing and excluded from active occupancy metrics. 
- It may not be decommissioned if it contains `occupied` beds or `active`/`pending_payment` contracts. 
- Restoring a decommissioned room resets its status to `available` and recalculates capacity.

---

## 5. Contract Rules

**BR-CON-001**
A contract is the legal and financial agreement linking exactly
one tenant to exactly one bed space. All billing cycles for
a tenant flow through their active contract.

**BR-CON-002**
A contract may only be created when the target bed space has
status `vacant`. Creating a contract automatically sets the
bed space to `occupied` (immediate reservation lock), even if the 
contract is in a `pending_payment` state, to prevent double-occupancy.

**BR-CON-003**
A bed space may have at most one active contract at any time.

**BR-CON-004**
Contract types are either `fixed_term` or `month_to_month`.

For `fixed_term` contracts: both a move-in date and an
expected move-out date are required. The expected move-out date
must be later than the move-in date.

For `month_to_month` contracts: a move-in date is required.
An expected move-out date is optional and used for occupancy
forecasting only.

**BR-CON-005**
A contract's monthly rate is set at the time of contract
creation and is locked for the duration of that contract.
Rate changes for future periods require a new contract.

**BR-CON-006**
Deposit amounts are recorded as a field on the contract record.
Deposits must not appear as billing line items.

**BR-CON-007**
Move-out processing may only be performed on a contract with
status `active`. The actual move-out date must be on or after
the move-in date.

**BR-CON-008**
Move-out processing atomically performs all of the following
in a single transaction:
- Sets the contract status to `completed`
- Records the actual move-out date
- Sets the bed space status to `vacant`
- Recalculates the room's derived status
- Updates the tenant's status to `moved_out` if they have no
  other active contracts

**BR-CON-009**
A contract may be terminated early by an Admin. Termination
sets the contract status to `terminated` and releases the
bed space identically to move-out processing.

**BR-CON-010**
Once a contract is `completed` or `terminated`, its core terms
(tenant, bed space, move-in date, monthly rate, deposit) are
immutable. Only notes may be appended.

**BR-CON-011** 
A new contract may be created for a bed space with an occupied status strictly if the new contract is a renewal for the exact same tenant, and the new contract's move-in date is exactly one day after the current active contract's expected move-out date. In this scenario, the bed space status remains occupied.

**BR-CON-012**
A contract may be voided by an Admin only when it was created in error and has
no associated billing records or payments. Voiding atomically:
- Sets the contract status to `voided`
- Releases the bed space status to `vacant`
- Recalculates the room's derived status
`voided` is distinct from `terminated`: termination applies to contracts with an
active financial history, while voiding is a creation-error correction only.
A voided contract is retained for forensic audit purposes and is never deleted.

**BR-CON-013**
A contract's effective billing rate is `monthly_rate` as locked at creation
(BR-CON-005). An Admin may optionally set a `monthly_rate_override` at the time
of contract creation to apply a custom rate for a specific tenant without modifying
the room's base rate. When a `monthly_rate_override` is present, it takes
precedence over `monthly_rate` for all `base_rent` billing line item calculations.
The override amount is locked for the duration of the contract identically to the
base rate and may not be changed after the contract is active.

---

## 6. Billing Rules

**BR-BIL-001**
A billing cycle record represents all charges for a specific
contract over a defined period (billing_period_from to
billing_period_to). It must be linked to exactly one contract.

**BR-BIL-002**
Only one billing cycle may exist for a given contract and a
given billing period. Duplicate cycles for the same contract
and period are rejected.

**BR-BIL-003**
A billing cycle must contain at least one line item. The first
line item must be of type `base_rent` and must reflect the
monthly rate from the contract.

**BR-BIL-004**
Line item types are: `base_rent`, `utility`,
`penalty`, and `adjustment`.
`adjustment` items may carry a negative amount to represent
a deduction or credit.
All other item types must have a positive amount.
No line item amount may be zero.

**BR-BIL-005**
The total computed amount of a billing cycle (sum of all line
items) may result in a negative value ONLY if the negative component
is an `adjustment` representing an overpayment credit from a 
previous cycle. A negative total indicates a system-wide credit balance
for the tenant.

**BR-BIL-006**
Billing cycle status is maintained automatically and must not be
set manually. The maintenance logic is:
- `paid`    — total_paid >= total_amount AND total_amount >= 0
- `partial` — total_paid > 0 AND total_paid < total_amount
- `overdue` — due_date < today AND total_paid < total_amount
- `unpaid`  — total_paid = 0 AND due_date >= today

When both `overdue` and `partial` conditions are true
(some payment made but due date has passed), the status
is `overdue`. Overdue takes precedence over partial.

**BR-BIL-007**
Billing status must be recalculated immediately after every
payment post and every payment void. No other operation
may leave billing status stale.

**BR-BIL-008**
A billing cycle may only be generated for a contract in an `active` or `pending_payment` 
state. Generating a billing cycle for a completed, terminated, or voided contract is not permitted. 
This ensures new tenants can receive their initial ledger to transition to an active status.

**BR-BIL-009**
Billing generation is performed manually by Admin or Staff.
A future automatic scheduling feature is planned but not
in scope for the current release.

**BR-BIL-010**
Generating billing for a room is a non-blocking batch operation. If a specific contract within the room fails validation (e.g., due to an overlapping period per BR-BIL-002), the system must skip that contract, log the reason, and continue processing all other eligible contracts in the room. This ensures room-level utility distribution remains resilient even when individual contract dates are in flux.

---

## 7. Payment Rules

**BR-PAY-001**
A payment is a financial settlement applied against either exactly
one billing cycle or exactly one contract (for non-billable deposits). 
Every payment must have a positive amount, a payment date, and 
a payment method.

**BR-PAY-002**
Accepted payment methods are: `cash`, `gcash`, `bank_transfer`,
and `other`. A reference number is required for `gcash` and
`bank_transfer` methods.

**BR-PAY-003**
Overpayments are permitted. When the total amount paid exceeds
the billing cycle total, the billing status becomes `paid`
and the excess is visible as a negative balance (credit).
Overpayment credit does not automatically carry forward
to future billing cycles; it must be handled manually via
an adjustment line item on the next cycle.

**BR-PAY-004**
A payment may be voided by Admin or Staff. Voiding a payment
sets a `voided_at` timestamp, records the voiding user, and
requires a void reason. A voided payment is never deleted.

**BR-PAY-005**
A payment that has already been voided may not be voided again.

**BR-PAY-006**
Voiding a payment immediately triggers a billing status
recalculation for the affected billing cycle (BR-BIL-008).

**BR-PAY-007**
All balance computations exclude voided payments. A voided
payment has no effect on the outstanding balance.

**BR-PAY-008**
A security deposit may be refunded to the tenant upon move-out. 
Refunds must be recorded as a payment record with category `refund` 
linked directly to the contract. Refund amounts are treated as 
disbursements and do not affect billing cycle balances.

**BR-PAY-009**
A security deposit from a completed contract may be rolled over 
to a new contiguous renewal for the same tenant. Rollovers must 
be recorded as a `rollover` payment category on the new contract, 
with the `reference_number` identifying the source contract ID. 
This preserves the financial audit trail without requiring actual 
cash movement.

**BR-PAY-010**
The `is_cleared` flag on a contract record tracks whether the security
deposit has been fully settled — either refunded (BR-PAY-008) or rolled
over (BR-PAY-009). When a `refund` or `rollover` payment is recorded,
the source contract's `is_cleared` flag must be set to `TRUE` in the
same atomic transaction. A completed or terminated contract where
`is_cleared = FALSE` indicates an unsettled deposit that requires
resolution before the tenant's financial ledger is closed.

**BR-PAY-011**
To maintain financial transparency, every payment record must be visually resolvable to a tenant and room. For payments linked to a bill (Rent), the context is resolved via the billing record. For payments linked directly to a contract (Deposits/Refunds), the context is resolved via the contract record. UI layers must support this dual-path resolution to prevent "orphan" financial records.

---

## 8. Meter and Utility Rules

**BR-MET-001**
A utility type represents a billable service (e.g., Electricity, Water) configured within the system along with its unit of measurement. A meter is a physical device that measures this consumption. Every meter must have a unique serial number and be strictly assigned to exactly one defined utility type.

**BR-MET-002**
Meter status values are `active`, `maintenance`, and `replaced`.
Only `active` meters may have new readings recorded.

**BR-MET-003**
A meter is assigned to exactly one room at any given time. A single meter may not be shared across multiple rooms. The assignment to a room is recorded with an effective-from date.

**BR-MET-004**
A meter reading records the meter display value at a specific
point in time, captured by a staff member. Every reading must
include the meter, the recorded value, the reading date, and
the staff member who recorded it.

**BR-MET-005**
Meter readings must be monotonically increasing. A new reading
value must be greater than or equal to the previous reading
value for the same meter. An exception is strictly permitted for a "meter rollover" event (e.g., a physical dial resetting to zero), which must be explicitly flagged and confirmed by the staff member entering the reading. When a rollover is flagged, consumption is calculated as:
  rollover_consumption = (max_display_capacity - previous_reading) + current_reading
If no maximum display capacity is specified for the meter type, the system shall
default to 9,999.9999 units as the rollover threshold. Readings that violate
the monotonicity rule without the rollover flag are rejected.

**BR-MET-006**
The unit rate for a utility type is defined by a utility rate. Each utility rate has an effective-from date. The applicable rate for a billing period is the most recent utility rate whose effective-from date is on or before the billing period start date.

**BR-MET-007**
The utility charge for a billing period is calculated as:
  charge = consumption × applicable_unit_rate

This charge is added to the billing cycle as a `utility`
line item by the staff member when generating the bill.
The system provides the calculated amount as a reference;
staff may override it with a manually entered amount
and must record the reason for any deviation.

**BR-MET-008**
A meter reading must be linked to its corresponding utility 
billing line item to create a traceable audit trail connecting 
consumption data to the charge it produced.

**BR-MET-009**
When a meter is decommissioned or replaced, its status is set
to `replaced`. Historical readings on a replaced meter are
retained and remain queryable for audit purposes.

**BR-MET-010**
For shared rooms, the total calculated utility charge for the room (as per BR-MET-007) must be automatically divided equally among all contracts in an `active` or `pending_payment` state assigned to bed spaces within that room during the billing period. This evenly apportioned amount is then added as the utility line item on each respective tenant's billing cycle. Rounding differentials resulting from the division (e.g., ₱0.01) shall be applied to the earliest created active/pending contract in the group to ensure the sum of line items exactly matches the total room consumption charge. For private rooms, the single occupant absorbs 100% of the calculated utility charge.

---

## 9. Audit Rules

**BR-AUD-001**
Every INSERT, UPDATE, and DELETE on a core entity table must
produce an audit log entry capturing the table affected, the
record identifier, the before values, the after values, and
the timestamp.

**BR-AUD-002**
The user responsible for a data change must be recorded on the
audit log entry. For changes made via the application, this is
the authenticated user. For changes made directly to the
database, the user context is best-effort.

**BR-AUD-003**
Audit log entries are immutable. No user, including Admin, may edit or delete an audit log entry through the application or via direct SQL. This immutability is strictly enforced by engine-level database triggers that prevent `UPDATE` or `DELETE` operations on the `audit_logs` table.

**BR-AUD-004**
A correlation ID shall be included in each audit log entry to group mutations produced during the same workflow run (e.g., all changes for an "Archive Tenant" action). Correlation IDs are optional on audit entries created outside a workflow context (e.g., login events).

---

## 11. Analytical and Reporting Rules

**BR-ANL-001**
The outstanding balance of a billing cycle is computed dynamically. There is no stored balance column in the database.
**Formula:** `Balance = SUM(Line Item Amounts) - SUM(Non-voided Payment Amounts)`

**BR-ANL-002**
Consumption for a billing period is derived from paired meter readings.
**Formula:** `Consumption = Current Reading Value - Previous Reading Value`

**BR-ANL-003**
The Collection Rate KPI measures performance efficiency by comparing cash inflow against expected receivables. Because collections include non-billed items (Security Deposits, Advance Rent), a rate exceeding 100% is mathematically valid and represents high operational efficiency.
**Formula:** `Collection Rate = (Total Collected Payments in Period / Total Amount Billed in Period) * 100`

---

## 12. Revision History

| Version | Date | Changes |
| :--- | :--- | :--- |
| v1.0–v1.7 | Mar–Apr 2026 | Prior iterations (see git history) |
| v1.8 | Apr 20, 2026 | Consolidated meter and utility rules; deposit rollover rules added. |
| v1.9 | Apr 21, 2026 | Added BR-CON-012 (voided contract), BR-CON-013 (monthly_rate_override), BR-PAY-010 (is_cleared). Amended BR-MET-005 rollover max default. Corrected BR-TEN-004, BR-ROM-003, BR-BIL-007 wording from "derived" to "maintained automatically". |
| **v2.0** | **Apr 29, 2026** | **Major Stabilization: Added BR-BIL-011 (Resilient Batch Billing), BR-PAY-011 (Forensic Context Resolution), and BR-PAY-012 (Collection Rate Logic).** |
| **v2.1** | **Apr 29, 2026** | **Reorganized formulas into a new Analytical Rules (ANL) category for reporting transparency. Migrated Balance, Consumption, and Collection Rate formulas.** |
| **v2.2** | **Apr 29, 2026** | **Clean State Release: Fully removed migrated placeholders and renumbered all rules to be continuous.** |
| **v2.3** | **May 02, 2026** | **Added BR-GEN-009 (Self-Account Restriction) to reinforce system security policy during lifecycle standardization.** |