# Contracts Page Design Specification

> **PROJECT:** HavenStay
> **Last Updated:** 2026-04-10
> **Page Type:** List / Detail / Form Pages
> **Routes:** `/contracts`, `/contracts/[id]`, `/contracts/new`

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`../MASTER.md`) for Contracts pages only.

---

## Page Purpose

The Contracts pages manage tenant-room agreements across three views:

1. **Contracts List** (`/contracts`) - Browse all contracts with status filtering
2. **Contract Detail** (`/contracts/[id]`) - View contract terms and payment history
3. **New Contract Form** (`/contracts/new`) - Create new tenant-room contracts

**Design Philosophy:** Clarity, Speed, Trust — operators must track contract lifecycles, manage move-ins/move-outs, and ensure deposit handling.

**Research Foundation (UI reasoning #40: Legal Services):**
- **Pattern**: Trust & Authority + Minimalism for legal document management
- **Color Mood**: Navy Blue + Gold + White for professional authority
- **Typography**: Professional + Authoritative typography
- **Key Effects**: Practice area reveal + Attorney profile animations
- **Decision Rules**: 
  - MUST HAVE: case-results (contract history display)
  - MUST HAVE: credential-display (contract terms clarity)

---

## Database Schema Alignment

```typescript
interface Contract {
  contract_id: number;              // PRIMARY KEY
  tenant_id: number;                // FOREIGN KEY
  room_id: number;                  // FOREIGN KEY
  bed_space_id: number | null;      // FOREIGN KEY (nullable)
  move_in_date: string;             // ISO date
  expected_move_out_date: string | null;  // ISO date (nullable)
  actual_move_out_date: string | null;    // ISO date (nullable)
  deposit_amount: number;           // PHP amount
  monthly_rent: number;             // PHP amount
  status: 'active' | 'ended' | 'voided';  // ENUM
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

**Status Enum Mapping:**
- `active` → "Active" (badge-success)
- `ended` → "Ended" (badge-neutral)
- `voided` → "Voided" (badge-neutral with strikethrough)

---

## Layout Structures

### Contracts List Page

```
[Page Header]
  [H1: Contracts]                            [+ New Contract (btn-primary)]
  [Subtitle: Manage tenant-room agreements]

[Filter Controls]
  [Status Filter]  [Tenant Search]  [Room Filter]  [Clear All]

[Data Table]
  Columns: Contract ID | Tenant | Room | Move-In | Expected Move-Out | Deposit | Status | Actions
```

### Contract Detail Page

```
[Page Header]
  [Breadcrumb: Contracts / Contract #{contract_id}]
  [H1: Contract #{contract_id}]              [Void Contract (btn-danger)]
  [Status Badge]

[Contract Terms Card]
  [Tenant Information]
  [Room Assignment]
  [Financial Terms: Deposit, Monthly Rent]
  [Dates: Move-In, Expected Move-Out, Actual Move-Out]
  [Notes]

[Payment History Table]
  Columns: Payment Date | Amount | Period | Status | Reference
```

### New Contract Form

```
[Page Header]
  [H1: New Contract]
  [Subtitle: * Required fields]

[Form Card (max-width: 780px centered)]
  [Tenant Selection *]
  [Room & Bed Space Selection *]
  [Financial Terms]
    - Deposit Amount * | Monthly Rent *
  [Contract Dates]
    - Move-In Date * | Expected Move-Out Date
  [Notes (textarea)]
  
  [Form Actions]
    [Cancel]  [Create Contract (btn-primary)]
```

---

## Component Overrides

### Contracts Table Specifications

**Columns:**
1. **Contract ID** - DM Mono font, clickable link
2. **Tenant** - `${first_name} ${last_name}`, clickable link to tenant detail
3. **Room** - room_number, clickable link to room detail
4. **Move-In** - formatDateString(move_in_date)
5. **Expected Move-Out** - formatDateString(expected_move_out_date) or "—"
6. **Deposit** - formatPHP(deposit_amount), right-aligned, DM Mono
7. **Status** - StatusBadge component
8. **Actions** - "VIEW" link, right-aligned

**Row Click Behavior:**
```javascript
const handleRowClick = (contractId) => {
  router.push(`/contracts/${contractId}`);
};
```

---

### Contract Terms Card (Detail Page)

```css
.contract-terms-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.contract-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--color-border);
}

.contract-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.contract-section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
}

.contract-field-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (max-width: 768px) {
  .contract-field-grid {
    grid-template-columns: 1fr;
  }
}

.contract-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.contract-field-label {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary);
}

.contract-field-value {
  font-size: 1rem;
  color: var(--color-text);
  font-weight: 500;
}

.contract-field-value.amount {
  font-family: var(--font-mono);
  color: var(--color-primary);
  font-size: 1.125rem;
}

.contract-field-value.link {
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
}
```

**Contract Sections:**
1. **Tenant Information** - Name (link to tenant detail), Contact Number
2. **Room Assignment** - Room Number (link to room detail), Bed Space
3. **Financial Terms** - Deposit Amount, Monthly Rent
4. **Contract Dates** - Move-In Date, Expected Move-Out Date, Actual Move-Out Date (if ended)
5. **Notes** - Full notes text or "No notes"

---

### Form Validation Rules

**Required Fields:**
- Tenant
- Room
- Deposit Amount
- Monthly Rent
- Move-In Date

**Validation Patterns:**

```javascript
// Deposit Amount Validation
const validateDepositAmount = (value) => {
  if (!value) return "Deposit amount is required";
  const num = Number(value);
  if (isNaN(num) || num < 0) {
    return "Deposit amount must be a positive number";
  }
  return true;
};

// Monthly Rent Validation
const validateMonthlyRent = (value) => {
  if (!value) return "Monthly rent is required";
  const num = Number(value);
  if (isNaN(num) || num <= 0) {
    return "Monthly rent must be a positive number";
  }
  return true;
};

// Move-In Date Validation
const validateMoveInDate = (value) => {
  if (!value) return "Move-in date is required";
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return "Invalid date format";
  }
  return true;
};

// Expected Move-Out Date Validation
const validateExpectedMoveOut = (value, moveInDate) => {
  if (!value) return true; // Optional
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return "Invalid date format";
  }
  if (moveInDate && date <= new Date(moveInDate)) {
    return "Expected move-out must be after move-in date";
  }
  return true;
};
```

---

### Void Contract Confirmation Modal

**Override Reason:** Voiding contracts is a critical action requiring explicit confirmation.

```jsx
<Modal open={showVoidModal} onClose={() => setShowVoidModal(false)}>
  <div className="modal-header">
    <div className="modal-icon modal-icon-danger">
      <AlertTriangle className="h-5 w-5" />
    </div>
    <div>
      <h3 className="modal-title">Void Contract</h3>
    </div>
  </div>
  <div className="modal-body">
    <p>Are you sure you want to void this contract?</p>
    <p className="mt-2 text-sm text-gray-600">
      <strong>Tenant:</strong> {tenant.first_name} {tenant.last_name}<br />
      <strong>Room:</strong> {room.room_number}<br />
      <strong>Move-In Date:</strong> {formatDateString(contract.move_in_date)}
    </p>
    <p className="mt-4 text-sm text-red-700 font-semibold">
      This action cannot be undone. The contract will be marked as voided.
    </p>
  </div>
  <div className="modal-actions">
    <button onClick={() => setShowVoidModal(false)} className="btn-secondary">
      Cancel
    </button>
    <button onClick={handleVoidContract} className="btn-danger">
      Void Contract
    </button>
  </div>
</Modal>
```

---

## Payment History Table (Detail Page)

**Columns:**
1. **Payment Date** - formatDateString(payment_date)
2. **Amount** - formatPHP(amount), right-aligned, DM Mono
3. **Period** - formatDateRange(billing_period_from, billing_period_to)
4. **Status** - StatusBadge (posted, voided)
5. **Reference** - payment_reference_number, DM Mono

**Empty State:**
```jsx
<div className="table-empty">
  <p>No payments recorded for this contract</p>
</div>
```

---

## API Integration

### Endpoints Used

1. **GET `/api/contracts`** - All contracts with tenant and room data
2. **GET `/api/contracts/[id]`** - Single contract with full details
3. **POST `/api/contracts`** - Create new contract
4. **PUT `/api/contracts/[id]/void`** - Void contract
5. **GET `/api/payments?contract_id=[id]`** - Payment history for contract

---

## Responsive Breakpoints

### Mobile (< 768px)
- Table: horizontally scrollable
- Form: single column
- Contract terms grid: single column

### Tablet (768px - 1024px)
- Table: full width
- Form: centered 780px max-width
- Contract terms grid: two columns

### Desktop (1024px+)
- Table: full width
- Form: centered 780px max-width
- Contract terms grid: two columns

---

## Accessibility Requirements

- [ ] All form inputs have associated labels
- [ ] Void contract modal has proper focus trap
- [ ] Table has <caption> or aria-label
- [ ] Status badges include text labels
- [ ] All animations respect prefers-reduced-motion
- [ ] Color contrast 4.5:1 minimum

---

## Anti-Patterns (Contracts-Specific)

- ❌ **Voiding without confirmation** — Always use modal
- ❌ **Missing date validation** — Validate move-out after move-in
- ❌ **No payment history** — Always show related payments
- ❌ **Generic "id" field** — Use `contract_id`, `tenant_id`, `room_id`
- ❌ **Manual status editing** — Status is system-managed

---

*This document defines Contracts-specific design rules. For all other specifications, refer to `../MASTER.md`.*
