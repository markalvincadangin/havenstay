# Billing Page Design Specification

> **PROJECT:** HavenStay
> **Last Updated:** 2026-04-10
> **Page Type:** List / Detail Pages
> **Routes:** `/billing`, `/billing/[id]`

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`../MASTER.md`) for Billing pages only.

---

## Page Purpose

The Billing pages manage monthly billing records across two views:

1. **Billing List** (`/billing`) - Browse all billing records with status filtering
2. **Billing Detail** (`/billing/[id]`) - View billing breakdown and payment history

**Design Philosophy:** Clarity, Speed, Trust — operators must track outstanding balances, identify overdue accounts, and monitor payment status.

**Research Foundation (UI reasoning #10: Fintech Banking):**
- **Pattern**: Trust & Authority + Minimalism for financial data
- **Color Mood**: Navy + Trust Blue + Gold for financial authority
- **Typography**: Professional + Trustworthy typography
- **Key Effects**: Smooth state transitions + Number animations
- **Decision Rules**: 
  - MUST HAVE: security-first design principles
  - IF dashboard: use-dark-mode (not applicable for HavenStay)
- **Anti-Patterns to AVOID**: 
  - Playful design (inappropriate for financial data)
  - Unclear fees (all charges must be transparent)

---

## Database Schema Alignment

```typescript
interface Billing {
  billing_id: number;               // PRIMARY KEY
  contract_id: number;              // FOREIGN KEY
  tenant_id: number;                // FOREIGN KEY
  billing_period_from: string;      // ISO date
  billing_period_to: string;        // ISO date
  due_date: string;                 // ISO date
  status: 'paid' | 'partial' | 'unpaid' | 'overdue';  // ENUM
  created_at: string;
  updated_at: string;
  
  // Computed fields (appended by backend)
  total_amount: number;             // Sum of line items
  total_paid: number;               // Sum of payments
  balance: number;                  // total_amount - total_paid
}

interface BillingLineItem {
  line_item_id: number;             // PRIMARY KEY
  billing_id: number;               // FOREIGN KEY
  description: string;              // e.g., "Monthly Rent", "Utilities"
  amount: number;                   // PHP amount
  created_at: string;
}
```

**Status Enum Mapping:**
- `paid` → "Paid" (badge-success)
- `partial` → "Partial" (badge-warning)
- `unpaid` → "Unpaid" (badge-danger)
- `overdue` → "Overdue" (badge-danger)

---

## Layout Structures

### Billing List Page

```
[Page Header]
  [H1: Billing]                              [Export CSV (btn-secondary)]
  [Subtitle: Track billing and payments]

[Filter Controls]
  [Status Filter]  [Date Range Filter]  [Tenant Search]  [Clear All]
  [Active Filter Chips]

[Summary KPI Cards] (3 columns)
  - Total Outstanding
  - Overdue Amount
  - Collected This Month

[Data Table]
  Columns: Billing ID | Tenant | Period | Due Date | Total | Paid | Balance | Status | Actions
```

### Billing Detail Page

```
[Page Header]
  [Breadcrumb: Billing / Billing #{billing_id}]
  [H1: Billing #{billing_id}]                [Record Payment (btn-primary)]
  [Status Badge]

[Billing Summary Card]
  [Tenant Information]
  [Billing Period]
  [Due Date]
  [Financial Summary: Total, Paid, Balance]

[Line Items Table]
  Columns: Description | Amount

[Payment History Table]
  Columns: Payment Date | Amount | Reference | Status | Actions
```

---

## Component Overrides

### Summary KPI Cards (List Page)

**Override Reason:** Billing list page has unique financial summary KPIs.

```css
.billing-kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

@media (max-width: 1024px) {
  .billing-kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .billing-kpi-grid {
    grid-template-columns: 1fr;
  }
}

.billing-kpi-card {
  /* Inherits .kpi-card from MASTER.md */
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px 24px;
}

.billing-kpi-label {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.billing-kpi-value {
  font-size: 1.875rem;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--color-text);
  letter-spacing: -0.025em;
  line-height: 1;
}

.billing-kpi-value.danger {
  color: #991B1B;  /* Red for overdue */
}

.billing-kpi-value.success {
  color: #065F46;  /* Emerald for collected */
}
```

**KPI Calculations:**
```javascript
// Total Outstanding
const totalOutstanding = billings
  .filter(b => ['unpaid', 'partial', 'overdue'].includes(b.status))
  .reduce((sum, b) => sum + Number(b.balance || 0), 0);

// Overdue Amount
const overdueAmount = billings
  .filter(b => b.status === 'overdue')
  .reduce((sum, b) => sum + Number(b.balance || 0), 0);

// Collected This Month
const thisMonth = new Date().toISOString().slice(0, 7);
const collectedThisMonth = billings
  .filter(b => b.billing_period_from?.slice(0, 7) === thisMonth)
  .reduce((sum, b) => sum + Number(b.total_paid || 0), 0);
```

---

### Billing Table Specifications

**Columns:**
1. **Billing ID** - DM Mono font, clickable link
2. **Tenant** - `${first_name} ${last_name}`, clickable link
3. **Period** - formatDateRange(billing_period_from, billing_period_to), italic, 12px
4. **Due Date** - formatDateString(due_date)
5. **Total** - formatPHP(total_amount), right-aligned, DM Mono
6. **Paid** - formatPHP(total_paid), right-aligned, DM Mono
7. **Balance** - formatPHP(balance), right-aligned, DM Mono, bold, teal color
8. **Status** - StatusBadge component
9. **Actions** - "VIEW" and "PAY" links (if balance > 0)

**Row Click Behavior:**
```javascript
const handleRowClick = (billingId) => {
  router.push(`/billing/${billingId}`);
};
```

**Balance Display Logic:**
```javascript
// Positive balance (owes money): default text color
// Zero balance: secondary text color
// Negative balance (credit): emerald green + "Credit" badge
const renderBalance = (balance) => {
  if (balance > 0) {
    return <span className="amount">{formatPHP(balance)}</span>;
  } else if (balance === 0) {
    return <span className="amount text-secondary">{formatPHP(0)}</span>;
  } else {
    return (
      <span className="amount text-emerald-700">
        {formatPHP(Math.abs(balance))}
        <span className="badge badge-success ml-2">Credit</span>
      </span>
    );
  }
};
```

---

### Billing Summary Card (Detail Page)

```css
.billing-summary-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.billing-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  .billing-summary-grid {
    grid-template-columns: 1fr;
  }
}

.billing-summary-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.billing-summary-label {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary);
}

.billing-summary-value {
  font-size: 1rem;
  color: var(--color-text);
  font-weight: 500;
}

.billing-summary-value.amount {
  font-family: var(--font-mono);
  font-size: 1.125rem;
}

.billing-summary-value.link {
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
}

.billing-financial-summary {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
}

.billing-financial-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 0.875rem;
}

.billing-financial-row.total {
  font-size: 1.125rem;
  font-weight: 600;
  padding-top: 12px;
  border-top: 2px solid var(--color-border-strong);
}

.billing-financial-label {
  color: var(--color-text-secondary);
}

.billing-financial-value {
  font-family: var(--font-mono);
  color: var(--color-text);
  font-weight: 500;
}

.billing-financial-value.balance {
  color: var(--color-primary);
  font-weight: 600;
}

.billing-financial-value.paid {
  color: #065F46;  /* Emerald */
}
```

---

### Line Items Table (Detail Page)

**Columns:**
1. **Description** - line item description (e.g., "Monthly Rent", "Utilities")
2. **Amount** - formatPHP(amount), right-aligned, DM Mono

**Table Footer:**
```jsx
<tfoot>
  <tr>
    <td className="font-semibold">Total</td>
    <td className="amount font-bold text-primary">
      {formatPHP(totalAmount)}
    </td>
  </tr>
</tfoot>
```

---

### Payment History Table (Detail Page)

**Columns:**
1. **Payment Date** - formatDateString(payment_date)
2. **Amount** - formatPHP(amount), right-aligned, DM Mono
3. **Reference** - payment_reference_number, DM Mono
4. **Status** - StatusBadge (posted, voided)
5. **Actions** - "VIEW" link to payment detail

**Empty State:**
```jsx
<div className="table-empty">
  <p>No payments recorded for this billing period</p>
  <button onClick={() => router.push(`/payments/new?billing_id=${billingId}`)} className="btn-primary mt-4">
    Record Payment
  </button>
</div>
```

---

## Filter Controls

```css
.billing-filter-container {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.status-filter {
  min-width: 160px;
}

.date-range-filter {
  display: flex;
  gap: 8px;
  align-items: center;
}

.date-range-input {
  min-width: 140px;
}

@media (max-width: 768px) {
  .billing-filter-container {
    flex-direction: column;
  }
  
  .date-range-filter {
    flex-direction: column;
    align-items: stretch;
  }
}
```

**Filter Behavior:**
```javascript
const filteredBillings = useMemo(() => {
  return billings.filter(billing => {
    const matchesStatus = statusFilter === 'all' || billing.status === statusFilter;
    
    const matchesDateRange = (!dateFrom || billing.due_date >= dateFrom) &&
                             (!dateTo || billing.due_date <= dateTo);
    
    const matchesTenant = !tenantSearch || 
      `${billing.tenant.first_name} ${billing.tenant.last_name}`
        .toLowerCase()
        .includes(tenantSearch.toLowerCase());
    
    return matchesStatus && matchesDateRange && matchesTenant;
  });
}, [billings, statusFilter, dateFrom, dateTo, tenantSearch]);
```

---

## API Integration

### Endpoints Used

1. **GET `/api/billing`** - All billing records with computed fields
2. **GET `/api/billing/[id]`** - Single billing with line items and payments
3. **GET `/api/billing/[id]/line-items`** - Line items for billing
4. **GET `/api/payments?billing_id=[id]`** - Payment history for billing

---

## Responsive Breakpoints

### Mobile (< 768px)
- KPI cards: single column
- Table: horizontally scrollable
- Filters: stacked vertically

### Tablet (768px - 1024px)
- KPI cards: 2-column grid
- Table: full width
- Filters: horizontal row

### Desktop (1024px+)
- KPI cards: 3-column grid
- Table: full width
- Filters: horizontal row

---

## Accessibility Requirements

- [ ] All KPI cards have aria-label
- [ ] Tables have <caption> or aria-label
- [ ] Status badges include text labels
- [ ] All animations respect prefers-reduced-motion
- [ ] Color contrast 4.5:1 minimum
- [ ] Balance display does not rely on color alone

---

## Anti-Patterns (Billing-Specific)

- ❌ **Hiding balance information** — Always show total, paid, balance
- ❌ **No payment history** — Always show related payments
- ❌ **Unclear line items** — Break down all charges
- ❌ **Missing overdue indicators** — Highlight overdue prominently
- ❌ **No export functionality** — Provide CSV export

---

*This document defines Billing-specific design rules. For all other specifications, refer to `../MASTER.md`.*
