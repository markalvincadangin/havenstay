# Contracts Design Specification — v5.0 (Forensic-Hardened)

> **PROJECT:** HavenStay Boarding House Management System (BHMS)
> **Last Updated:** 2026-04-18
> **Page Type:** List / Detail / Form Pages
> **Routes:** `/contracts`, `/contracts/[id]`, `/contracts/new`, `/contracts/[id]/edit`

> [!IMPORTANT]
> This specification follows the list-page pattern defined in **[../MASTER.md](../MASTER.md)** (Section 18.2). It mandates 100% usage of reusable components for headers, tables, and forms to ensure architectural consistency across the application.

## Form Contract Reference

- Shared form theme and validation behavior: `FORM_PAGES.md` §1
- Contract form routes and allowed fields: `FORM_PAGES.md` §2.4 and §2.5
- Source of truth: `docs/SRS.md` (FR-016 to FR-019f, BR-005), `docs/API_REFERENCE.md`, `backend/database/sql/havenstay_schema.sql`

---

## 1. Page Purpose

This module manages lease agreements between residents and bed spaces. It tracks the full contract lifecycle from move-in to move-out while keeping financial and room assignment data accurate:
- **Contract history**: A searchable record of active and past agreements.
- **Financial tracking**: Security deposits and monthly rent.
- **Inventory Management**: Linking residents to specific room units and bed spaces (SRS §2.1).
- **Lifecycle Operations**: Processing move-ins (registration) and move-outs (completion).

---

## 2. Layout Structure (Master §4)

### 2.1 Contracts List (`/contracts`)
1.  **Page Header**: `Contract Ledger` with subtitle `Chronological history of active and historical lease agreements.` and "Register Contract" primary CTA.
2.  **Summary KPIs**: 3-column `KpiCard` grid (Active Agreements, Security Deposits, Monthly Potential).
3.  **Filter Hub**: `Registry Card` with strip title **Filters** (registry standard — **MASTER §5.8.3**).
4.  **Main Table**: `Table` primitive with mono IDs and row-level navigation.

### 2.2 Contract Profile Detail (`/contracts/[id]`)
- **Profile Header**: Dynamic title (contract ID or short title) with subtitle `Lease terms, billing, and payment history.`
- **Split View (Master §13)**:
    - **Sidebar (4)**: 
        - **Agreement Profile card**: Icon, title, and key metrics (Resident, Unit, Monthly Rate, Move-in).
        - **Lifecycle card**: "Process Move-out" action for active contracts.
    - **Main (8)**: 
        - **Resident & Assignment card**: Linked details for tenant and room.
        - **Financial & Dates grid**: Two-column layout for terms and move-in/out dates.
        - **Agreement Notes card**: Full-width prose area.
        - **Payment History**: Embedded `Table` of related payments.

### 2.3 Registration / Update (`/contracts/new`, `/edit`)
- **Form Shell**: Centered `max-w-4xl` column containing `PageHeader`, alerts, and cards.
- **Multi-Card Layout (Master §12)**:
    - Card 1: **Tenant & Unit Assignment** (Tenant, Room, Bed Space).
    - Card 2: **Lease Period** (Inception, Expected Out).
    - Card 3: **Financial Terms** (Security Deposit, Monthly Rate).
    - Card 4: **Notes**.

### 2.4 Exact Form Labels (Parity with `FORM_PAGES.md` §2.4 and §2.5)
Create form (`/contracts/new`):
- Tenant (`tenant_id`)
- Bed Space (`bed_space_id`)
- Move-in Date (`move_in_date`)
- Expected Move-out Date (`expected_move_out_date`)
- Security Deposit (`deposit_amount`)
- Monthly Rate Override (`monthly_rate_override`)
- Notes (`notes`)

Edit form (`/contracts/[id]/edit`):
- Expected Move-out Date (`expected_move_out_date`)
- Security Deposit (`deposit_amount`)
- Monthly Rate Override (`monthly_rate_override`)
- Notes (`notes`)

---

## 3. Component Standards (Master §5)

### 3.1 Registry Card (Filters)
- **Header**: Standard `hs-strip-title` "Filters" with `FileText` icon well.
- **Body**: `md:grid-cols-12` layout.
    - **Search (9)**: `Field` + `Input` with `Search` prefix. 
    - **Status (3)**: `Field` + `Select` (All, Active, Completed, Terminated).

### 3.2 Registry Table (List View)
- **Component**: `<Table caption="Operational ledger of lease agreements" />`.
- **Columns**: 
    1. **Registry ID**: `#CONTRACT-{id}` (DM Mono).
    2. **Tenant Resident**: Name (Bold) + Move-in Date (Muted).
    3. **Room / Bed**: Room Code (Bold) + Bed Label (Muted).
    4. **Monthly Rate**: `formatPHP(monthly_rate)` (DM Mono, Right-aligned).
    5. **Status**: Standard `StatusBadge`.
    6. **Actions**: `ActionGroup` with `ArrowUpRight` circle button.

### 3.3 Detail Rows (Master §13)
- **Label**: `text-[10px] font-bold uppercase tracking-widest text-stone-400`.
- **Value**: `text-sm font-semibold text-stone-900`.
- **Pattern**: Use `DetailRow` or `MetricItem` components for consistency.

---

## 4. Data Fidelity (Source of Truth)

All data mappings must strictly follow `db/havenstay_schema.sql` enums and field types.

| UI Label | DB Attribute | Rule |
| :--- | :--- | :--- |
| Registry ID | `contract_id` | Prefix with `#CONTRACT-` (Master §3). |
| Resident | `tenant_id` | Linked first_name/last_name. |
| Assignment | `bed_space_id` | Resolved room_code + bed_label. |
| Monthly Rate | `monthly_rate` | Currency formatting; Tabular Mono. |
| Deposit | `deposit_amount` | Currency formatting; Tabular Mono. |
| Status | `status` | ENUM: `pending_payment`, `active`, `completed`, `terminated`. |

---

## 5. Interaction & Motion (Master §6)

- **Entry**: `pageVariants` (opacity + 8px y-translation).
- **Row Hover**: `hover:bg-stone-50` with `cursor-pointer`.
- **Move-out Process**: Triggers a confirmation modal with `AlertTriangle` icon and destructive action button.
    - **Gate Pass Constraint**: The confirmation modal must be disabled/blocked with a warning state if the associated tenant has an outstanding balance > ₱0.00.
- **Navigation**: Full-row click target; use `e.stopPropagation()` on links and action buttons.

---

## 6. Consistency Audit Checklist

- [ ] Does the Page Header use the standardized title and subtitle from Master §21?
- [ ] Is the form layout using the `max-w-4xl` parity rule (PageHeader + Cards + Footer)?
- [ ] Are all Registry IDs prefixed correctly (e.g., `#CONTRACT-1`, `#TENANT-5`)?
- [ ] Does the "Process Move-out" action use a confirm modal?
- [ ] Are currency fields (Monthly Rate, Deposit) using `DM Mono`?
- [ ] Is the primary CTA named "Register Contract" as per Master §8?

---

## 7. Page Titles and Subtitles (Master §21 Exact)

| Route | Title (H1) | Subtitle |
| :--- | :--- | :--- |
| `/contracts` | `Contract Ledger` | `Chronological history of active and historical lease agreements.` |
| `/contracts/[id]` | `*(Contract ID or short title)*` | `Lease terms, billing, and payment history.` |

---

*This document is a child of the Master Specification. For all base rules on typography, color, and primitives, refer to `../MASTER.md`.*
