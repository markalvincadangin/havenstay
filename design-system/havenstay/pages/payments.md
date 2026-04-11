# Payments Page Design Specification

> **PROJECT:** HavenStay
> **Last Updated:** 2026-04-10
> **Page Type:** List / Detail / Form Pages
> **Routes:** `/payments`, `/payments/[id]`, `/payments/new`

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`../MASTER.md`) for Payments pages only.

---

## Page Purpose

The Payments pages manage payment records across three views:

1. **Payments List** (`/payments`) - Browse all payment transactions
2. **Payment Detail** (`/payments/[id]`) - View payment details and related billing
3. **Record Payment Form** (`/payments/new`) - Record new payment transactions

**Design Philosophy:** Clarity, Speed, Trust — operators must record payments accurately, track payment history, and handle voided transactions.

**Research Foundation (UI reasoning #10: Fintech Banking):**
- **Pattern**: Trust & Authority for financial transactions
- **Color Mood**: Navy + Trust Blue + Gold
- **Typography**: Professional + Trustworthy
- **Key Effects**: Smooth number animations + Security indicators
- **Decision Rules**: 
  - MUST HAVE: security-first design
  - MUST HAVE: transaction confirmation
- **Anti-Patterns to AVOID**: 
  - Playful design
  - Unclear transaction status

---

## Database Schema Alignment

```typescript
interface Payment {
  payment_id: number;               // PRIMARY KEY
  billing_id: number;               // FOREIGN KEY
  tenant_id: number;                // FOREIGN KEY
  amount: number;                   // PHP amount
  payment_date: string;             // ISO date
  payment_method: 'cash' | 'bank_transfer' | 'gcash' | 'other';  // ENUM
  payment_reference_number: string | null;  // Transaction reference
  status: 'posted' | 'voided';      // ENUM
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

**Status Enum Mapping:**
- `posted` → "Posted" (badge-success)
- `voided` → "Voided" (badge-neutral with strikethrough)

**Payment Method Mapping:**
- `cash` → "Cash"
- `bank_transfer` → "Bank Transfer"
- `gcash` → "GCash"
- `other` → "Other"

---

## Layout Structures

### Payments List Page

```
[Page Header]
  [H1: Payments]                             [Record Payment (btn-primary)]
  [Subtitle: Track payment transactions]

[Filter Controls]
  [Status Filter]  [Date Range Filter]  [Payment Method Filter]  [Clear All]

[Summary KPI Cards] (2 columns)
  - Total Collected Today
  - Total Collected This Month

[Data Table]
  Columns: Payment ID | Date | Tenant | Amount | Method | Reference | Status | Actions
```

### Payment Detail Page

```
[Page Header]
  [Breadcrumb: Payments / Payment #{payment_id}]
  [H1: Payment #{payment_id}]                [Void Payment (btn-danger)]
  [Status Badge]

[Payment Details Card]
  [Transaction Information]
  [Tenant Information]
  [Billing Information]
  [Payment Method & Reference]
  [Notes]

[Related Billing Card]
  Link to billing detail with balance information
```

### Record Payment Form

```
[Page Header]
  [H1: Record Payment]
  [Subtitle: * Required fields]

[Form Card (max-width: 640px centered)]
  [Tenant Selection *]
  [Billing Selection *] (filtered by tenant)
  [Payment Information]
    - Amount * | Payment Date *
    - Payment Method * | Reference Number
  [Notes (textarea)]
  
  [Billing Summary Panel]
    Shows: Total Amount, Total Paid, Balance, New Balance after payment
  
  [Form Actions]
    [Cancel]  [Record Payment (btn-primary)]
```

---

## Component Overrides

### Summary KPI Cards (List Page)

```css
.payments-kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

@media (max-width: 768px) {
  .payments-kpi-grid {
    grid-template-columns: 1fr;
  }
}
```

**KPI Calculations:**
```javascript
// Total Collected Today
const today = new Date().toISOString().slice(0, 10);
const collectedToday = payments
  .filter(p => p.payment_date === today && p.status === 'posted')
  .reduce((sum, p) => sum + Number(p.amount || 0), 0);

// Total Collected This Month
const thisMonth = new Date().toISOString().slice(0, 7);
const collectedThisMonth = payments
  .filter(p => p.payment_date?.slice(0, 7) === thisMonth && p.status === 'posted')
  .reduce((sum, p) => sum + Number(p.amount || 0), 0);
```

---

### Payments Table Specifications

**Columns:**
1. **Payment ID** - DM Mono font, clickable link
2. **Date** - formatDateString(payment_date)
3. **Tenant** - `${first_name} ${last_name}`, clickable link
4. **Amount** - formatPHP(amount), right-aligned, DM Mono, bold
5. **Method** - payment_method mapped to display label
6. **Reference** - payment_reference_number or "—", DM Mono
7. **Status** - StatusBadge component
8. **Actions** - "VIEW" link, "VOID" link (if posted)

**Row Click Behavior:**
```javascript
const handleRowClick = (paymentId) => {
  router.push(`/payments/${paymentId}`);
};
```

**Voided Payment Display:**
```jsx
// Voided payments show strikethrough amount
{payment.status === 'voided' ? (
  <span className="amount line-through opacity-50">
    {formatPHP(payment.amount)}
  </span>
) : (
  <span className="amount text-emerald-700 font-bold">
    {formatPHP(payment.amount)}
  </span>
)}
```

---

### Payment Details Card (Detail Page)

```css
.payment-details-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.payment-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--color-border);
}

.payment-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.payment-section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
}

.payment-field-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (max-width: 768px) {
  .payment-field-grid {
    grid-template-columns: 1fr;
  }
}

.payment-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.payment-field-label {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary);
}

.payment-field-value {
  font-size: 1rem;
  color: var(--color-text);
  font-weight: 500;
}

.payment-field-value.amount {
  font-family: var(--font-mono);
  color: #065F46;  /* Emerald for payment amounts */
  font-size: 1.5rem;
  font-weight: 600;
}

.payment-field-value.reference {
  font-family: var(--font-mono);
  font-size: 0.875rem;
}

.payment-field-value.link {
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
}
```

**Payment Sections:**
1. **Transaction Information** - Payment ID, Amount, Payment Date, Status
2. **Tenant Information** - Name (link to tenant detail), Contact Number
3. **Billing Information** - Billing ID (link to billing detail), Period, Balance Before/After
4. **Payment Method** - Method, Reference Number
5. **Notes** - Full notes text or "No notes"

---

### Billing Summary Panel (Record Payment Form)

**Override Reason:** Payment form needs real-time balance calculation display.

```css
.billing-summary-panel {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

.billing-summary-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
}

.billing-summary-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 0.875rem;
}

.billing-summary-row.highlight {
  font-size: 1rem;
  font-weight: 600;
  padding-top: 12px;
  margin-top: 12px;
  border-top: 2px solid var(--color-border-strong);
}

.billing-summary-label {
  color: var(--color-text-secondary);
}

.billing-summary-value {
  font-family: var(--font-mono);
  color: var(--color-text);
  font-weight: 500;
}

.billing-summary-value.new-balance {
  color: var(--color-primary);
  font-weight: 600;
}

.billing-summary-value.overpayment {
  color: #991B1B;  /* Red for overpayment warning */
}
```

**Balance Calculation Logic:**
```javascript
const currentBalance = selectedBilling?.balance || 0;
const paymentAmount = Number(formData.amount) || 0;
const newBalance = currentBalance - paymentAmount;

// Show warning if payment exceeds balance
const isOverpayment = paymentAmount > currentBalance;
```

---

### Form Validation Rules

**Required Fields:**
- Tenant
- Billing
- Amount
- Payment Date
- Payment Method

**Validation Patterns:**

```javascript
// Amount Validation
const validateAmount = (value, billingBalance) => {
  if (!value) return "Amount is required";
  const num = Number(value);
  if (isNaN(num) || num <= 0) {
    return "Amount must be a positive number";
  }
  if (num > billingBalance * 2) {
    return "Amount seems unusually high. Please verify.";
  }
  return true;
};

// Payment Date Validation
const validatePaymentDate = (value) => {
  if (!value) return "Payment date is required";
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return "Invalid date format";
  }
  const today = new Date();
  if (date > today) {
    return "Payment date cannot be in the future";
  }
  return true;
};

// Reference Number Validation (optional but recommended for non-cash)
const validateReferenceNumber = (value, paymentMethod) => {
  if (paymentMethod !== 'cash' && !value) {
    return "Reference number is recommended for non-cash payments";
  }
  return true;
};
```

---

### Void Payment Confirmation Modal

```jsx
<Modal open={showVoidModal} onClose={() => setShowVoidModal(false)}>
  <div className="modal-header">
    <div className="modal-icon modal-icon-danger">
      <AlertTriangle className="h-5 w-5" />
    </div>
    <div>
      <h3 className="modal-title">Void Payment</h3>
    </div>
  </div>
  <div className="modal-body">
    <p>Are you sure you want to void this payment?</p>
    <p className="mt-2 text-sm text-gray-600">
      <strong>Payment ID:</strong> {payment.payment_id}<br />
      <strong>Tenant:</strong> {tenant.first_name} {tenant.last_name}<br />
      <strong>Amount:</strong> {formatPHP(payment.amount)}<br />
      <strong>Date:</strong> {formatDateString(payment.payment_date)}
    </p>
    <p className="mt-4 text-sm text-red-700 font-semibold">
      This action cannot be undone. The payment will be marked as voided and the billing balance will be adjusted.
    </p>
  </div>
  <div className="modal-actions">
    <button onClick={() => setShowVoidModal(false)} className="btn-secondary">
      Cancel
    </button>
    <button onClick={handleVoidPayment} className="btn-danger">
      Void Payment
    </button>
  </div>
</Modal>
```

---

### Record Payment Success Confirmation

**Override Reason:** Payment recording requires explicit success confirmation.

```jsx
// After successful payment recording
toast.success(
  <div>
    <p className="font-semibold">Payment Recorded Successfully</p>
    <p className="text-sm mt-1">
      {formatPHP(payment.amount)} recorded for {tenant.first_name} {tenant.last_name}
    </p>
  </div>,
  { duration: 5000 }
);

// Navigate to payment detail
router.push(`/payments/${paymentId}`);
```

---

## API Integration

### Endpoints Used

1. **GET `/api/payments`** - All payment records with tenant data
2. **GET `/api/payments/[id]`** - Single payment with full details
3. **POST `/api/payments`** - Record new payment
4. **PUT `/api/payments/[id]/void`** - Void payment
5. **GET `/api/billing?tenant_id=[id]`** - Billing records for tenant (for form)

---

## Responsive Breakpoints

### Mobile (< 768px)
- KPI cards: single column
- Table: horizontally scrollable
- Form: single column
- Billing summary panel: full width

### Tablet (768px - 1024px)
- KPI cards: 2-column grid
- Table: full width
- Form: centered 640px max-width

### Desktop (1024px+)
- KPI cards: 2-column grid
- Table: full width
- Form: centered 640px max-width

---

## Accessibility Requirements

- [ ] All form inputs have associated labels
- [ ] Void payment modal has proper focus trap
- [ ] Table has <caption> or aria-label
- [ ] Status badges include text labels
- [ ] All animations respect prefers-reduced-motion
- [ ] Color contrast 4.5:1 minimum
- [ ] Amount fields use tabular-nums for alignment

---

## Anti-Patterns (Payments-Specific)

- ❌ **Recording without confirmation** — Always show success message
- ❌ **Voiding without modal** — Always use confirmation modal
- ❌ **No balance calculation** — Show before/after balance
- ❌ **Missing reference numbers** — Recommend for non-cash
- ❌ **Future payment dates** — Validate date not in future
- ❌ **No overpayment warning** — Alert if amount exceeds balance

---

*This document defines Payments-specific design rules. For all other specifications, refer to `../MASTER.md`.*
