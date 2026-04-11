# Reports Page Design Specification

> **PROJECT:** HavenStay
> **Last Updated:** 2026-04-10
> **Page Type:** Index / Report Display Pages
> **Routes:** `/reports`, `/reports/occupancy`, `/reports/financial`, `/reports/outstanding`

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`../MASTER.md`) for Reports pages only.

---

## Page Purpose

The Reports pages provide analytical views and data exports across multiple report types:

1. **Reports Index** (`/reports`) - Navigate to available reports
2. **Occupancy Report** (`/reports/occupancy`) - Room and bed occupancy analysis
3. **Financial Summary Report** (`/reports/financial`) - Revenue and collection analysis
4. **Outstanding Balances Report** (`/reports/outstanding`) - Unpaid and overdue billing

**Design Philosophy:** Clarity, Speed, Trust — operators must access accurate data, understand trends, and export reports for record-keeping.

**Research Foundation (UI reasoning #19: SaaS Dashboard - Data-Dense):**
- **Pattern**: Data-Dense Dashboard with export functionality
- **Color Mood**: Cool to Hot gradients for data visualization
- **Typography**: Clear + Readable for data scanning
- **Key Effects**: Hover tooltips + Chart zoom + Data export
- **Decision Rules**: 
  - MUST HAVE: data-export (CSV functionality)
  - IF large_dataset: virtualize-lists for performance
- **Anti-Patterns to AVOID**: 
  - Ornate design that obscures data
  - No filtering options
  - Slow rendering

---

## Layout Structures

### Reports Index Page

```
[Page Header]
  [H1: Reports]
  [Subtitle: Generate and export reports]

[Report Cards Grid] (3 columns on desktop, 2 on tablet, 1 on mobile)
  Each card shows:
    - Report icon
    - Report name
    - Description
    - "View Report" link
```

### Report Display Page (Generic Structure)

```
[Page Header]
  [Breadcrumb: Reports / {Report Name}]
  [H1: {Report Name}]                    [Export CSV (btn-primary)]
  [Subtitle: {Report Description}]
  [Generated: {timestamp}]

[Filter Controls]
  [Date Range Filter]  [Additional Filters]  [Generate Report (btn-secondary)]

[Summary KPI Cards] (2-4 cards depending on report)
  Key metrics for the report

[Data Table or Visualization]
  Report-specific data display

[Footer: Generated timestamp + record count]
```

---

## Component Overrides

### Report Navigation Cards (Index Page)

**Override Reason:** Reports index uses card-based navigation for report types.

```css
.report-cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

@media (max-width: 1024px) {
  .report-cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .report-cards-grid {
    grid-template-columns: 1fr;
  }
}

.report-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  cursor: pointer;
  transition: box-shadow 150ms ease, border-color 150ms ease;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.report-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
  border-color: var(--color-primary);
}

.report-card-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: rgba(13, 148, 136, 0.1);  /* Teal at 10% */
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
}

.report-card-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
}

.report-card-description {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.report-card-link {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-primary);
  margin-top: auto;
}

.report-card-link-arrow {
  transition: transform 200ms ease;
}

.report-card:hover .report-card-link-arrow {
  transform: translateX(4px);
}
```

**Available Reports:**
1. **Occupancy Report** - Icon: `BarChart2`, Description: "View room and bed occupancy rates over time"
2. **Financial Summary** - Icon: `Receipt`, Description: "Analyze revenue, collections, and outstanding balances"
3. **Outstanding Balances** - Icon: `AlertCircle`, Description: "Track unpaid and overdue billing records"

---

### Report Header with Generated Timestamp

**Override Reason:** Reports need timestamp to indicate data freshness.

```css
.report-header {
  margin-bottom: 24px;
}

.report-generated-timestamp {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  margin-top: 8px;
  font-style: italic;
}
```

**Timestamp Format:**
```javascript
const formatReportTimestamp = () => {
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(new Date());
};

// Output: "Generated Apr 10, 2026, 2:45 PM"
```

---

## Report-Specific Specifications

### Occupancy Report

**Filter Controls:**
- Date Range (default: current month)
- Floor Filter (optional)

**Summary KPI Cards:**
1. **Average Occupancy Rate** - Percentage across date range
2. **Total Bed Spaces** - Total capacity
3. **Currently Occupied** - Current occupied count
4. **Vacant Beds** - Current vacant count

**Data Table Columns:**
1. **Date** - formatDateString(date)
2. **Total Beds** - Total capacity
3. **Occupied** - Occupied count
4. **Vacant** - Vacant count
5. **Occupancy Rate** - Percentage with progress bar

**CSV Export Columns:**
```
Date,Total Beds,Occupied,Vacant,Occupancy Rate (%)
```

---

### Financial Summary Report

**Filter Controls:**
- Date Range (default: current month)
- Tenant Filter (optional)

**Summary KPI Cards:**
1. **Total Revenue** - Sum of all billing amounts
2. **Total Collected** - Sum of all payments
3. **Outstanding Balance** - Total unpaid
4. **Collection Rate** - (Collected / Revenue) * 100%

**Data Table Columns:**
1. **Period** - formatDateRange(from, to)
2. **Billed Amount** - formatPHP(total_amount)
3. **Collected** - formatPHP(total_paid)
4. **Outstanding** - formatPHP(balance)
5. **Collection Rate** - Percentage with color indicator

**CSV Export Columns:**
```
Period,Billed Amount,Collected,Outstanding,Collection Rate (%)
```

---

### Outstanding Balances Report

**Filter Controls:**
- Status Filter (unpaid, partial, overdue, all)
- Tenant Search
- Sort By (balance desc, due date asc)

**Summary KPI Cards:**
1. **Total Outstanding** - Sum of all balances
2. **Overdue Amount** - Sum of overdue balances
3. **Overdue Count** - Number of overdue records
4. **Oldest Overdue** - Days since oldest due date

**Data Table Columns:**
1. **Tenant** - `${first_name} ${last_name}`, clickable link
2. **Room** - room_number
3. **Period** - formatDateRange(from, to)
4. **Due Date** - formatDateString(due_date)
5. **Days Overdue** - Calculated from due_date (if overdue)
6. **Balance** - formatPHP(balance), bold, teal
7. **Status** - StatusBadge component
8. **Actions** - "PAY" link

**Days Overdue Calculation:**
```javascript
const calculateDaysOverdue = (dueDate) => {
  const today = new Date();
  const due = new Date(dueDate);
  const diffTime = today - due;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};
```

**Days Overdue Display:**
```jsx
{daysOverdue > 0 && (
  <span className="text-red-700 font-semibold">
    {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'}
  </span>
)}
```

**CSV Export Columns:**
```
Tenant,Room,Period,Due Date,Days Overdue,Balance,Status
```

---

### CSV Export Functionality

**Override Reason:** Reports require CSV export with proper formatting.

```javascript
const exportToCSV = (data, filename) => {
  // Convert data to CSV format
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Usage
const handleExport = () => {
  exportToCSV(reportData, 'occupancy_report');
  toast.success('Report exported successfully');
};
```

---

### Report Filter Controls

```css
.report-filter-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.report-filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.report-filter-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .report-filter-grid {
    grid-template-columns: 1fr;
  }
  
  .report-filter-actions {
    flex-direction: column;
  }
}
```

---

### Report Summary KPI Cards

```css
.report-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

@media (max-width: 1024px) {
  .report-kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .report-kpi-grid {
    grid-template-columns: 1fr;
  }
}

.report-kpi-card {
  /* Inherits .kpi-card from MASTER.md */
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px 24px;
}

.report-kpi-label {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.report-kpi-value {
  font-size: 1.875rem;
  font-weight: 600;
  color: var(--color-text);
  font-family: var(--font-sans);
  letter-spacing: -0.025em;
  line-height: 1;
}

.report-kpi-value.amount {
  font-family: var(--font-mono);
}

.report-kpi-value.percentage {
  font-family: var(--font-mono);
}

.report-kpi-value.danger {
  color: #991B1B;
}

.report-kpi-value.success {
  color: #065F46;
}
```

---

### Report Footer

```css
.report-footer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .report-footer {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
}
```

**Footer Content:**
```jsx
<div className="report-footer">
  <span>Generated {formatReportTimestamp()}</span>
  <span>{reportData.length} records</span>
</div>
```

---

## API Integration

### Endpoints Used

1. **GET `/api/reports/occupancy`** - Occupancy data with date range
2. **GET `/api/reports/financial`** - Financial summary with date range
3. **GET `/api/reports/outstanding`** - Outstanding balances with filters

**Query Parameters:**
- `date_from` - ISO date string (YYYY-MM-DD)
- `date_to` - ISO date string (YYYY-MM-DD)
- `tenant_id` - Filter by tenant (optional)
- `status` - Filter by status (optional)
- `floor` - Filter by floor (optional)

---

## Loading States

```jsx
{loading && (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
    <span className="ml-3 text-sm text-gray-600">Generating report...</span>
  </div>
)}
```

---

## Empty States

```jsx
<div className="table-empty">
  <p>No data available for the selected period</p>
  <p className="text-sm">Try adjusting the date range or filters</p>
</div>
```

---

## Responsive Breakpoints

### Mobile (< 768px)
- Report cards: single column
- KPI cards: single column
- Table: horizontally scrollable
- Filters: stacked vertically

### Tablet (768px - 1024px)
- Report cards: 2-column grid
- KPI cards: 2-column grid
- Table: full width

### Desktop (1024px+)
- Report cards: 3-column grid
- KPI cards: 4-column grid
- Table: full width

---

## Accessibility Requirements

- [ ] All report cards have aria-label
- [ ] Tables have <caption> describing report type
- [ ] Export button has clear label
- [ ] All KPI cards have aria-label
- [ ] Color contrast 4.5:1 minimum
- [ ] Keyboard navigation works for all filters

---

## Anti-Patterns (Reports-Specific)

- ❌ **No export functionality** — Always provide CSV export
- ❌ **Missing generated timestamp** — Users need to know data freshness
- ❌ **No default date range** — Default to current month
- ❌ **Unclear filter state** — Show active filters clearly
- ❌ **No record count** — Display total records in footer
- ❌ **Slow rendering** — Optimize for large datasets
- ❌ **No empty state guidance** — Provide filter adjustment hints

---

*This document defines Reports-specific design rules. For all other specifications, refer to `../MASTER.md`.*
