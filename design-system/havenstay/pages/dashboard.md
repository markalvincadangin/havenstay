# Dashboard Design Specification — v4.3 (Master-Aligned)

> **PROJECT:** HavenStay Boarding House Management System (BHMS)
> **Last Updated:** 2026-04-12
> **Page Type:** Dashboard / Operational Overview
> **Route:** `/dashboard`

> [!IMPORTANT]
> This specification implements the **Dashboard** module layout rules from **[../MASTER.md](../MASTER.md)** (Section 18.1, 21). It follows the **Registry Card** and **Table** patterns defined in Master Sections 5.1 and 5.8.

---

## 1. Page Purpose

The Dashboard serves as the primary command interface for property managers. It provides visual evidence of **data integrity** (SRS CCR-001) and **bed-level occupancy** (SRS 2.2) through:
- **Real-time Occupancy**: Bed-level vacancy tracking via `vw_room_occupancy`.
- **Financial Scrutiny**: Outstanding balances and collections performance via `vw_billing_summary` and `vw_collections_summary`.
- **Operational Priorities**: Immediate attention items (Dues today, recent payments).

**Design Philosophy:** Professional operational tool — no decorative "heat maps" or ornate animations. Focus on **scannable data density** and **monetary accuracy**.

---

## 2. Layout Structure (Master §4)

The page utilizes the **AppMain** column (`max-w-7xl`) with a vertical stack of operational regions.

### 2.1 Page Header (Master §5.4, §21)
- **Title (H1)**: `Dashboard` (uses `.hs-page-title`).
- **Subtitle**: `Monitor daily activities, occupancy updates, and pending administrative tasks.` (uses `.hs-page-subtitle`).
- **Breadcrumbs**: `Dashboard`.
- **Actions**:
  - `[Register Payment]` (Primary Link CTA — uses `primaryLinkCtaClass`).
  - `[UserRoleBadge]` (Master §5.13).

### 2.2 Section Stack

1.  **KPI Row** (Grid: 1 col mobile → 3 cols desktop):
    - Bed Occupancy (with progress bar)
    - Active Tenants (linked to /tenants)
    - Vacant Beds (linked to /rooms)
    - Past Due Cycles (Danger state if counts > 0)
    - Collected This Month
    - Outstanding This Month

2.  **Split Hub / Registry Grid** (Grid: `lg:grid-cols-12`):
    - **Main Column (lg:8)**:
        - **Quick Links**: Registry Card with Hub pattern grid.
        - **Attention: Due Today**: Registry Card with **embedded Table**.
    - **Sidebar Column (lg:4)**:
        - **Latest Collections**: Registry Card with **embedded Table** showing recent payments.

---

## 3. Component Specifications (Master §5)

### 3.1 KpiCard (New Shared Primitive)
- **File**: `src/app/_components/ui/KpiCard.js` (Proposed creation)
- **Shell**: `rounded-2xl border border-stone-200 bg-white shadow-sm`.
- **Props**: `label`, `value`, `sub`, `icon`, `href`, `progress`, `isLoading`, `isDanger`.
- **Typography**:
    - Label: `text-[10px] font-bold uppercase tracking-widest text-stone-400`.
    - Value: `text-2xl font-black tracking-tight text-stone-900`.
    - Sub-label (Mono): `font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400`.
- **Icons**: `Lucide` nodes in `h-10 w-10` tinted wells (Teal defaults; Amber for dues; red-600 for danger).

### 3.2 Operations Table (Master §5.8)
- **Component**: `<Table embedded ariaLabel="Description of table" />`.
- **Row Hover**: `hover:bg-stone-50 cursor-pointer`.
- **Typography**:
    - Names/Labels: `text-sm font-bold text-stone-900`.
    - Currency/Balances: `font-mono text-sm font-bold tabular-nums text-stone-800` (uses `.text-tabular`).
    - Negative/Danger: `text-red-600` for balances due today.

### 3.3 Empty States (Master §5.16)
- **Component**: `<EmptyState icon={Receipt} title="All clear" message="..." />`.
- **Usage**: Mandatory when `Due Today` or `Latest Collections` have zero records.

---

## 4. Data Fidelity (Source of Truth)

All data must map to the authoritative schema in `db/havenstay_schema.sql` and reporting views.

### 4.1 SQL Mapping (Master §10)
| UI Label | Mapping Source | Rule |
| :--- | :--- | :--- |
| Bed Occupancy | `vw_room_occupancy.occupied_beds` | `(occupied / total) * 100` |
| Active Tenants | `tenants` table | `status = 'active'` |
| Collected | `payments` table | `SUM(amount_paid)` WHERE `voided_at IS NULL` |
| Past Due | `vw_billing_summary` | `billing_status = 'overdue' AND total_paid = 0` |

### 4.2 Formatting
- **Money**: `formatPHP()` (Master §3).
- **Date**: `formatDateString()` or short ISO labels.
- **IDs**: `#PAY-{id}` or `#TENANT-{id}` (Master §3 ID pattern).

---

## 5. Interaction & Motion (Master §6)

- **Entrance**: `pageVariants` (opacity + gentle y-offset).
- **Interactive Lift**: Only on **Quick Link** hub items (`hover:-translate-y-1 shadow-lg`). **Static** cards remain static to maintain operational focus.
- **Reduced Motion**: Honored via `useReducedMotion()`.

---

## 6. Anti-Patterns (Dashboard-Specific)

- ❌ **TranslateY on main KPI/Registry cards**: Causes layout shift (Violation of MASTER §6).
- ❌ **Hand-rolled tables**: Duplicates styles and breaks accessibility (Violation of MASTER §14).
- ❌ **"No Records" text**: Use the `EmptyState` primitive (Violation of MASTER §5.16).
- ❌ **SaaS Color palette**: Only use **Stone** and **Teal** family from `globals.css` (Violation of MASTER §2).

---

## 7. Consistency & Improvements (Audit 2026-04-12)

The following items were identified for revision to achieve 100% Master Spec parity:

### 7.1 Component Transitions
- **Table Logic**: Transition from hand-rolled `<table>` tags in "Attention: Due Today" and "Latest Collections" to the `<Table embedded />` primitive. This ensures consistent sorting, staggering, and mobile responsiveness.
- **Empty States**: Replace inline zero-state divs with the `<EmptyState />` component to provide visual icons and consistent guidance text.

### 7.2 Terminology & Labels
- **Nomenclature**: Change primary CTA from "Pay" to "Register Payment" (§8.1).
- **Page Context**: Unified title as "Dashboard" across Breadcrumbs, H1, and navigation sidebar.
- **Table Headers**: Column headers like "Activity" updated to "Record" for operational clarity.

### 7.3 Visual Polish
- **KPI Radius**: Ensure all KPI cards use the `rounded-2xl` registry card shell override.
- **Mono Enforcement**: Verify DM Mono is applied to all IDs (e.g., `#PAY-001`) and currency values.

---

*This document is a child of the Master Specification. For all base rules on typography, color, and primitives, refer to `../MASTER.md`.*
