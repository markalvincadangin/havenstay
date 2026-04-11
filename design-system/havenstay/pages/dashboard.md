# Dashboard Page Design Specification

> **PROJECT:** HavenStay
> **Last Updated:** 2026-04-10
> **Page Type:** Dashboard / Operational Overview
> **Route:** `/dashboard`

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`../MASTER.md`) for the Dashboard page only.
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page Purpose

The Dashboard serves as the primary operational interface for boarding house operators, providing at-a-glance visibility into:
- **Occupancy metrics** (bed occupancy, active tenants, vacant beds, overdue accounts)
- **Financial metrics** (collected this month, outstanding this month, due today)
- **Actionable billing items** (bills due today requiring attention)
- **Quick navigation** to common pages

**Design Philosophy:** Clarity, Speed, Trust — operators must immediately understand property state and take action with minimal clicks.

**Research Foundation (UI reasoning #19: SaaS Dashboard - Data-Dense Dashboard):**
- **Pattern**: Data-Dense Dashboard with Heat Map visualization
- **Color Mood**: Cool to Hot gradients + Neutral grey for data hierarchy
- **Typography**: Clear + Readable typography optimized for data scanning
- **Key Effects**: Hover tooltips + Chart zoom + Real-time pulse for live data
- **Decision Rules**: 
  - MUST HAVE: real-time-updates for financial data
  - IF large_dataset: prioritize-performance over decorative effects
- **Anti-Patterns to AVOID**: 
  - Ornate design that distracts from data
  - Slow rendering that delays data visibility
  - Excessive animation (limit to 1-2 key elements)

---

## Layout Structure

### Page Header
```
[Breadcrumb: Dashboard]                      [user@email · Role]
[H1: Dashboard]                              [+ Record Payment (btn-primary)]
```

### Content Sections (Vertical Stack)

1. **Occupancy Metrics Grid** (4 columns on desktop, 2 on tablet, 1 on mobile)
   - Bed Occupancy (with progress bar)
   - Active Tenants
   - Vacant Beds
   - Overdue Accounts (red value when > 0)

2. **Financial Metrics Grid** (3 columns on desktop, 2 on tablet, 1 on mobile)
   - Collected This Month
   - Outstanding This Month
   - Due Today

3. **Content Grid** (2/3 + 1/3 split on desktop, stacked on mobile)
   - Due Today Table (left, 2/3 width)
   - Quick Links Panel (right, 1/3 width)

---

## Component Overrides

### KPI Card Specifications

**Override Reason:** Dashboard KPI cards have unique styling requirements not covered in the Master.

```css
.kpi-card {
  /* Inherits base card styles from MASTER.md Section 6.5 */
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px 24px;
  transition: box-shadow 150ms ease, border-color 150ms ease;
}

.kpi-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
  border-color: var(--color-border-strong);
  /* ❌ NEVER use transform: translateY() — causes layout shift */
}

.kpi-card .kpi-label {
  font-size: 0.625rem;           /* 10px — smaller than standard */
  font-weight: 900;              /* font-black — heavier than standard */
  letter-spacing: 0.1em;         /* tracking-widest */
  text-transform: uppercase;
  color: var(--color-text);
  opacity: 0.4;
  margin-bottom: 8px;
}

.kpi-card .kpi-value {
  font-size: 2.25rem;            /* 36px (text-4xl) — larger than standard */
  font-weight: 900;              /* font-black */
  color: var(--color-text);
  font-family: var(--font-sans);
  letter-spacing: -0.05em;       /* tracking-tighter */
  line-height: 1;
}

/* Danger variant for overdue count */
.kpi-card.kpi-danger .kpi-value {
  color: #991B1B;                /* Red text when count > 0 */
}

.kpi-card .kpi-subtitle {
  font-family: var(--font-mono);
  font-size: 0.75rem;            /* 12px (text-xs) */
  font-weight: 700;              /* font-bold */
  text-transform: uppercase;
  opacity: 0.6;
  margin-top: 4px;
}

/* Progress Bar (Bed Occupancy only) */
.kpi-progress-container {
  margin-top: 12px;
  background: var(--color-bg);
  height: 1.5px;
  border-radius: 999px;
  overflow: hidden;
}

.kpi-progress-bar {
  height: 100%;
  background: var(--color-primary);
  transition: width 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.kpi-progress-label {
  font-size: 0.625rem;           /* 10px */
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text);
  opacity: 0.4;
  margin-top: 8px;
}

/* Decorative Circle */
.kpi-decorative-circle {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  opacity: 0.1;
  transition: transform 500ms ease;
}

.kpi-card:hover .kpi-decorative-circle {
  transform: scale(1.5);
}
```

**KPI Card Color Accents:**
- Bed Occupancy: `text-teal-600` / `bg-teal-50`
- Active Tenants: `text-blue-600` / `bg-blue-50`
- Vacant Beds: `text-emerald-600` / `bg-emerald-50`
- Overdue Accounts: `text-red-600` / `bg-red-50`
- Collected This Month: `text-emerald-600` / `bg-emerald-50`
- Outstanding This Month: `text-amber-600` / `bg-amber-50`
- Due Today: `text-teal-600` / `bg-teal-50`

---

### Due Today Table

**Override Reason:** Dashboard table has unique column structure and empty state.

**Columns:**
1. **Tenant** - `${first_name} ${last_name}`, font-semibold, primary text
2. **Room** - room_number, 70% opacity
3. **Period** - formatted date range, italic, text-xs, 60% opacity
4. **Balance** - formatPHP(balance), right-aligned, font-mono, font-bold, teal CTA color
5. **Status** - StatusBadge component, right-aligned
6. **Action** - "Pay" link to `/payments/new?billing_id={id}`, right-aligned, teal CTA color

**Empty State:**
```css
.due-today-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  border: 2px dashed rgba(13, 148, 136, 0.2);  /* Teal primary at 20% */
  border-radius: 12px;
}

.due-today-empty-text {
  font-size: 0.875rem;           /* 14px */
  font-weight: 700;              /* font-bold */
  text-transform: uppercase;
  letter-spacing: 0.2em;         /* tracking-[0.2em] */
  color: var(--color-text-secondary);
  opacity: 0.3;
}
```

**Empty State Message:** "All settled for today"

**Section Header:**
```html
<div class="flex items-center justify-between mb-4">
  <h2 class="text-lg font-semibold">Due Today</h2>
  <span class="badge badge-info">{count} items</span>
</div>
```

---

### Quick Links Panel

**Override Reason:** Dashboard-specific navigation component.

```css
.quick-links-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
}

.quick-links-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 16px;
}

.quick-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border: 1px solid rgba(13, 148, 136, 0.1);  /* Teal at 10% */
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-secondary);
  opacity: 0.6;
  transition: border-color 200ms ease, background-color 200ms ease, opacity 200ms ease;
  cursor: pointer;
}

.quick-link:hover {
  border-color: rgba(13, 148, 136, 0.4);      /* Teal at 40% */
  background-color: rgba(13, 148, 136, 0.03); /* Teal at 3% */
  opacity: 1;
}

.quick-link-arrow {
  transition: transform 200ms ease;
}

.quick-link:hover .quick-link-arrow {
  transform: translateX(4px);
}
```

**Links:**
- Tenants → `/tenants`
- Rooms → `/rooms`
- Contracts → `/contracts`
- Billing → `/billing`
- Payments → `/payments`
- Reports → `/reports`

---

## Data Calculations

### Occupancy Metrics

**Bed Occupancy Percentage:**
```javascript
const occupancyPercentage = totalBeds > 0 
  ? Math.round((occupiedBeds / totalBeds) * 100) 
  : 0;
```

**Vacant Beds:**
```javascript
const vacantBeds = totalBeds - occupiedBeds;
```

**Active Tenants:**
```javascript
const activeTenants = tenants.filter(t => t.status === 'active').length;
```

**Overdue Accounts:**
```javascript
const today = new Date().toISOString().slice(0, 10);
const overdueItems = billings.filter(b => {
  const dueDate = b.due_date ? String(b.due_date).slice(0, 10) : "";
  const balance = Number(b.balance || 0);
  return dueDate && dueDate < today && balance > 0;
});
const overdueCount = overdueItems.length;
const overdueTotal = overdueItems.reduce((sum, b) => sum + Number(b.balance || 0), 0);
```

### Financial Metrics

**Collected This Month:**
```javascript
const thisMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
const collectedThisMonth = billings.reduce((sum, b) => {
  const billMonth = b.billing_period_from 
    ? String(b.billing_period_from).slice(0, 7) 
    : "";
  if (billMonth === thisMonth) {
    return sum + Number(b.total_paid || 0);
  }
  return sum;
}, 0);
```

**Outstanding This Month:**
```javascript
const outstandingThisMonth = billings.reduce((sum, b) => {
  const billMonth = b.billing_period_from 
    ? String(b.billing_period_from).slice(0, 7) 
    : "";
  const balance = Number(b.balance || 0);
  if (billMonth === thisMonth && balance > 0) {
    return sum + balance;
  }
  return sum;
}, 0);
```

**Due Today:**
```javascript
const today = new Date().toISOString().slice(0, 10);
const dueTodayItems = billings.filter(b => {
  const dueDate = b.due_date ? String(b.due_date).slice(0, 10) : "";
  return dueDate === today;
});
```

---

## API Integration

### Endpoints Used

1. **GET `/api/reports/occupancy`** - Aggregated occupancy data from vw_room_occupancy view
2. **GET `/api/billing`** - All billing records with appended total_amount, total_paid, balance
3. **GET `/api/tenants`** - All tenant records with status enum
4. **GET `/api/rooms`** - All room records with capacity and status

### Fallback Logic

**If `/api/reports/occupancy` returns zero total_beds:**
```javascript
// Compute from rooms list
const totalBeds = rooms.reduce((sum, r) => sum + Number(r.capacity || 0), 0);
const occupiedBeds = rooms.filter(r => r.status === 'occupied')
  .reduce((sum, r) => sum + Number(r.capacity || 0), 0);
```

### Error Handling

**Display inline error alert with retry button:**
```jsx
{error && (
  <Alert variant="error" className="mb-6">
    <AlertCircle className="h-4 w-4" />
    <div>
      <p className="font-semibold">Failed to load dashboard data</p>
      <p className="text-sm">{error}</p>
      <button onClick={handleRetry} className="btn-secondary mt-2">
        <RefreshCw className="h-4 w-4 mr-2" />
        Retry
      </button>
    </div>
  </Alert>
)}
```

---

## Animation Specifications

### Page Entrance
```javascript
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: 'easeOut' }
};
```

### KPI Card Stagger
```javascript
const kpiStagger = {
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
};

const kpiCardVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 }
};
```

### Table Row Stagger
```javascript
// Cap at 12 rows — rows 13+ appear instantly
const tableStagger = {
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05
    }
  }
};
```

---

## Responsive Breakpoints

### Mobile (< 768px)
- KPI cards: single column
- Due Today table: horizontally scrollable
- Quick Links: below table (full width)
- Page header actions: wrap to new line

### Tablet (768px - 1024px)
- Occupancy KPIs: 2-column grid
- Financial KPIs: 2-column grid
- Due Today + Quick Links: stacked

### Desktop (1024px+)
- Occupancy KPIs: 4-column grid
- Financial KPIs: 3-column grid
- Due Today + Quick Links: 2/3 + 1/3 split

---

## Accessibility Requirements

- [ ] All KPI cards have `aria-label` when they are links
- [ ] Due Today table has `<caption>` or `aria-label`
- [ ] "Record Payment" button has visible focus ring
- [ ] Status badges do not rely on color alone (include text)
- [ ] All animations respect `prefers-reduced-motion`
- [ ] Color contrast 4.5:1 minimum for all text
- [ ] Keyboard navigation works for all interactive elements

---

## Anti-Patterns (Dashboard-Specific)

- ❌ **KPI cards with translateY hover** — Causes layout shift
- ❌ **Multiple loading indicators** — Show one skeleton for entire dashboard
- ❌ **Error banner + empty state simultaneously** — Error takes priority
- ❌ **Stale data during loading** — Clear state before re-fetch
- ❌ **Generic "Loading..." text** — Use specific labels like "Loading dashboard..."
- ❌ **Hardcoded month names** — Always compute from current date
- ❌ **Displaying raw enum values** — Map to human labels (e.g., "Moved Out" not "moved_out")

---

## Z-Index Scale

```css
:root {
  --z-base: 0;
  --z-dropdown: 10;
  --z-sticky: 20;
  --z-modal-backdrop: 30;
  --z-modal: 40;
  --z-toast: 50;
}
```

**Usage:**
- KPI cards: `z-base` (0)
- Table sticky header: `z-sticky` (20)
- Error alerts: `z-base` (0)
- Modals: `z-modal` (40)

---

*This document defines Dashboard-specific design rules. For all other specifications, refer to `../MASTER.md`.*
