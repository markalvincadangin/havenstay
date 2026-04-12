# Reports Page Design Specification

> **PROJECT:** HavenStay BHMS
> **Authoritative Specification:** Aligned to `MASTER.md` (Design Goals §1, Typography §3, Table §14, Components §19)
> **Implementation Scope:** `/reports`, `/reports/occupancy`, `/reports/collections`, `/reports/billing-summary`, `/reports/outstanding-balances`, `/reports/tenant-ledger`, `/reports/tenant-history`

---

## 1. Visual Architecture

The reporting module follows the **"Analytical Stack"** pattern. Unlike standard list pages, reports emphasize **quantitative fidelity** and **time-series comparison**. Every report surface must adhere to the vertical stacking order defined below.

---

## 2. Layout Structure (Master §4)

### 2.1 Inventory Overview
- **Occupancy Report**: Operational utilization tracking.
- **Purpose**: High-density table highlighting `Room Code`, `Bed Label`, and `Occupant Name`.
### 1.1 Page Construction (Stacking Order)

1.  **PageHeader**: Title (Standardized §21), Subtitle (Microcopy §21), Breadcrumbs, and Actions (UserRoleBadge + Export Button).
2.  **Summary Layer**: A grid of `KpiCard` units (Section 19) providing aggregate snapshots.
3.  **Filter card**: A **Registry Card (§5.1)** with search wells, date pickers, and categories. Strip title **Filters** (registry standard — **MASTER §5.8.3**).
4.  **Data Card**: A high-density card containing the **Embedded Table (Section 5.8)**.

### 1.2 Non-Negotiable Standards

- **Color Mood**: Neutral stone-50 backdrops with teal-600 focus. Do not use random color gradients.
- **Typography**: Numeric data (amounts, IDs, dates) must use **DM Mono** (`text-tabular`).
- **Surface**: Every major block must use the `rounded-2xl` shell with `stone-200` borders.

---

## 2. Core Components & Mapping

### 2.1 The Reports Hub (`/reports`)
The index page serves as the entry point for operational oversight.

- **Layout**: Hub pattern (§4.3) with a responsive grid of `HubItem` navigation cards.
- **Visuals**: Each card uses a `rounded-2xl` white surface with a bottom-aligned "Observe Report" CTA.
- **Iconography**: Standardized Lucide nodes per report type (see §3 below).

### 2.2 Report Header & Actions
- **Primary CTA**: The **"Export CSV"** button must be present in the `actions` slot of the `PageHeader`. It uses the `variant="teal"` styling (Section 5.5).
- **Secondary**: A **Refresh** button (ghost variant) may reload data from the API.
- **Timestamp**: Display a discrete generated timestamp (`text-[10px] uppercase cursor-default text-stone-400 font-mono`) either in the PageHeader subtitle or top-right action well.

### 2.3 Aggregate Summaries (`KpiCard`)
Summary layers must NOT use custom "Metric" or "Tile" components. Use the authoritative `KpiCard` primitives.

- **Grid Row**: `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`.
- **Styling**: `rounded-2xl`, `shadow-sm`, and `DM Mono` for the primary `value`.

---

## 3. Standardized Report Views

### 3.1 Occupancy Registry
- **Route**: `/reports/occupancy`
- **Purpose**: Operational utilization tracking.
- **KPI Metrics**: 
    - `Total Beds` (Stone)
    - `Occupied Units` (Teal)
    - `Vacant Status` (Rose/Danger if vacancy > 20%) 
    - `Occupancy Rate` (Teal + Progress Bar variant)
- **Table Structure**: Bed-level granularity highlighting `Room Code`, `Bed Label`, and `Occupant Name`.

### 3.2 Collections Performance
- **Route**: `/reports/collections`
- **Purpose**: Cash-flow throughput analysis.
- **KPI Metrics**:
    - `Net Collected` (Teal + PHP Currency)
    - `Payment Throughput` (Total transaction count)
    - `Top Method` (Most used payment method this period)
- **Data Table**: Chronological ledger including `Payment ID`, `Method`, `Reference`, and `Allocated Bill`.

### 3.3 Billing Aggregate
- **Route**: `/reports/billing-summary`
- **Purpose**: Yield observation.
- **KPI Metrics**: `Total Billed`, `Settled Amount`, `Partial Balance`, `Past Due`.

### 3.4 Outstanding balances
- **Route**: `/reports/outstanding-balances`
- **Purpose**: Liability management and debt collection.
- **KPI Metrics**: `Total Outstanding Liability`, `Overdue Accounts`, `Oldest Cycle`, `Risk Index`.
- **Visuals**: High-contrast rose tints for overdue amounts.

---

## 4. UI Patterns for Data Density

### 4.1 Comparison Chips (`FilterChips`)
Every filter applied must be reflected in **`FilterChips`** inside the filter card. **Clear all** resets filters and the table to match.

### 4.2 Empty States (`EmptyState`)
If a filter range yields zero results, do not show an empty table header. Render the `EmptyState` component (§5.16) with the `Search` icon and guidance to "Adjust filter parameters."

---

## 5. Implementation Roadmap (Reference)

1.  **Normalization**: Ensure all report titles match Section 21 and use `hs-page-title`.
2.  **Encapsulation**: Replace custom metric tiers with standardized `KpiCard` rows.
3.  **Harden Filters**: Standardize date pickers and select dropdowns inside `rounded-2xl` shells.
4.  **Audit Logs (Parity)**: Reports must align visually with the Audit Trail and Transaction Logs for consistent "Observer" experience.

---
*End of Design Specification. Aligned to HavenStay MASTER v4.3.*
