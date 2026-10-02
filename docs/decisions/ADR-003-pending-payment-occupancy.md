# ADR-003: Bed Space & Tenant Status Semantics During `pending_payment`

> **Status**: `AWAITING HUMAN APPROVAL`  
> **Date**: September 25, 2026  
> **Deciders**: Systems Architect, Product Manager, Operations Lead  
> **Technical Scope**: Room/Bed Occupancy Model, Contract Lifecycle, Tenant State Machine  

---

## Context

When front-desk staff create a new lease agreement, the contract is created in `pending_payment` status. The tenant is expected to settle their initial advance rent and security deposit before moving in. 

The bed space status in the database only supports three values: `vacant`, `occupied`, and `maintenance`.

---

## Problem

There is an apparent semantic dilemma between physical reality and commercial reality:
1. **Physical Reality**: The tenant has not yet paid and has not moved their physical belongings into the room.
2. **Commercial Reality**: The boarding house must withhold the bed space from the market immediately upon contract drafting so that staff cannot double-book the same bed to another prospect.

In the current code, `ContractService::create()` sets `bed_spaces.status = 'occupied'` immediately upon contract creation. Furthermore, `TenantService::syncStatus()` sets `tenants.status = 'active'` because it considers a `pending_payment` lease as active residency. If the tenant walks away without paying, the bed space and tenant remain locked in active status until staff explicitly voids the contract.

---

## Evidence

1. **Immediate Bed Occupancy**: [ContractService.php L161](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/ContractService.php#L161) calls `RoomService::occupyBedSpace($actor, $bedSpace);` which writes `bed_spaces.status = 'occupied'`.
2. **Room Capacity Derivation**: [BedSpaceObserver.php L19](file:///home/markc/projects/active/havenstay/backend/app/Observers/BedSpaceObserver.php#L19) immediately recomputes room occupancy; if all beds are occupied, the room becomes `unavailable`.
3. **Tenant Status Sync**: [TenantService.php L287-295](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/TenantService.php#L287-L295) updates tenant status to `'active'` if they have any contract with status `ACTIVE` or `PENDING_PAYMENT`.
4. **Bed Schema Invariant**: [havenstay_schema.sql L92](file:///home/markc/projects/active/havenstay/db/havenstay_schema.sql#L92) restricts bed space status: `status ENUM('vacant','occupied','maintenance') DEFAULT 'vacant'`.
5. **Contract Voiding Release**: [ContractService.php L488](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/ContractService.php#L488) releases the bed back to `vacant` and reverts tenant to `onboarded` if the lease is voided.

---

## Options Considered

### Option A: Confirm Commercial Inventory Allocation Baseline (Recommended)
Formally document and confirm that in HavenStay's domain model, `bed_spaces.status = 'occupied'` denotes **commercial inventory allocation** (reservation lock). If the tenant walks away, staff voids the contract, which returns the bed to `vacant`.
- *Consequences*: 0 code changes. Clarifies domain documentation. Guarantees zero double-booking.

### Option B: Keep Bed Locked, Keep Tenant in `onboarded`
Keep `bed_spaces.status = 'occupied'` (preventing double-booking), but update `TenantService::syncStatus()` so the tenant remains in `onboarded` status until contract activation occurs upon payment settlement.
- *Consequences*: 3 lines of code in `TenantService.php`. More accurate tenant directory metrics.

### Option C: Introduce Formal `reserved` Bed Space State
Alter `bed_spaces.status` enum in schema to add `'reserved'`. Refactor `RoomService`, `BedSpaceObserver`, room capacity formulas, reports, and UI bed badges.
- *Consequences*: High-complexity schema migration across 8 core files. High regression risk.

---

## Decision

**Proposed Decision**: Adopt **Option A as the immediate stabilization baseline**. Revisit Option B if operational reporting demands distinguishing unpaid prospects from paid residents. Reject Option C for current phase.

*(Subject to explicit human stakeholder approval).*

---

## Rationale

1. **Prevent Catastrophic Double-Booking**: In a busy boarding house, once a bed agreement is drafted, that bed cannot be rented to anyone else. Using the database invariant `status = 'occupied'` ensures that `POST /api/contracts` validation immediately rejects any attempt to assign that bed space elsewhere (`BR-CON-002`).
2. **Clean Rollback via Void**: The existing `ContractService::void()` workflow already releases the bed back to `vacant` and re-evaluates room availability.
3. **Stability over Scope Creep**: Migrating enum columns and rewriting observer logic during stabilization would introduce severe regression risks.

---

## Consequences

### Positive
- Zero risk of accidental double-booking of beds during the check-in wizard.
- Preserves existing observer cascades and room capacity calculations.
- Zero database migrations required.

### Negative / Trade-offs
- Administrative room occupancy metrics count `pending_payment` beds as occupied before rent is paid.

---

## Rejected Alternatives

- **Option C (New `reserved` state)**: Rejected because adding a fourth state to the bed status enum requires updating CHECK constraints, table triggers, UI badges, and room capacity aggregations with high regression risk.

---

## Acceptance Criteria

1. Creating a contract in `pending_payment` locks the target bed space against any concurrent lease creation.
2. Attempting to create a second contract on that bed returns HTTP 422 with a validation error indicating the bed is not vacant.
3. Voiding the `pending_payment` contract immediately returns the bed space to `vacant` and restores room availability.

---

## Related Requirements

- `REQ-006`: Bed space status lifecycle tracking
- `REQ-007`: Automated room status and capacity derivation
- `REQ-008`: Contract bed reservation lock
- `BR-ROM-003`: Room status auto-derivation
- `BR-ROM-004`: Bed space status invariants
- `BR-CON-002`: Vacant bed assignment requirement

---

## Related Backlog Items

- `DEC-03`: Bed space & tenant status semantics during pending_payment.
