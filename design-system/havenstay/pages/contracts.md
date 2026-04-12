# Contract Ledger Design Specification — v4.3 (Master-Aligned)

> **PROJECT:** HavenStay Boarding House Management System (BHMS)
> **Last Updated:** 2026-04-12
> **Page Type:** Ledger / List / Detail / Form Pages
> **Routes:** `/contracts`, `/contracts/[id]`, `/contracts/new`, `/contracts/[id]/edit`

> [!IMPORTANT]
> This specification follows the **Ledger** pattern defined in **[../MASTER.md](../MASTER.md)** (Section 18.2). It mandates 100% usage of reusable components for Headers, Tables, and Forms to ensure architectural consistency across the application.

---

## 1. Page Purpose

The Contract Ledger serves as the authoritative ledger for all lease agreements between tenants and bed spaces. It manages the lifecycle of residency from inception to termination, ensuring financial and inventory integrity:
- **Chronological Ledger**: A searchable record of active and historical agreements.
- **Financial Oversight**: Tracking of security deposits and monthly rental yields.
- **Inventory Management**: Linking residents to specific room units and bed spaces (SRS §2.1).
- **Lifecycle Operations**: Processing move-ins (Registration) and move-outs (Completion).

---

## 2. Layout Structure (Master §4)

### 2.1 Contracts List (`/contracts`)
1.  **Page Header**: `Contract Ledger` with "Register Contract" Primary CTA.
2.  **Summary KPIs**: 3-column `KpiCard` grid (Active Agreements, Security Deposits, Monthly Potential).
3.  **Filter Hub**: `Registry Card` with strip title **Filters** (registry standard — **MASTER §5.8.3**).
4.  **Main Ledger**: `Table` primitive with mono IDs and row-level navigation.

### 2.2 Contract Profile Detail (`/contracts/[id]`)
- **Profile Header**: `Agreement Portfolio` with Status Badge and mono Registry ID.
- **Split View (Master §13)**:
    - **Sidebar (4)**: 
        - **Agreement Profile card**: Icon, title, and key metrics (Resident, Unit, Yield, Move-in).
        - **Lifecycle card**: "Process Move-out" action for active contracts.
    - **Main (8)**: 
        - **Resident & Assignment card**: Linked details for tenant and room.
        - **Financial & Dates grid**: Two-column layout for terms and move-in/out dates.
        - **Agreement Notes card**: Full-width prose area.
        - **Payment History Ledger**: Embedded `Table` of related payments.

### 2.3 Registration / Update (`/contracts/new`, `/edit`)
- **Form Shell**: Centered `max-w-4xl` column containing `PageHeader`, alerts, and cards.
- **Multi-Card Layout (Master §12)**:
    - Card 1: **Tenant & Unit Assignment** (Resident, Room, Bed Space).
    - Card 2: **Lease Period** (Inception, Expected Out).
    - Card 3: **Financial Yield** (Security Deposit, Monthly Rate).
    - Card 4: **Operational Remarks** (Notes).

---

## 3. Component Standards (Master §5)

### 3.1 Registry Card (Filters)
- **Header**: Standard `hs-strip-title` "Registry Filters" with `FileText` icon well.
- **Body**: `md:grid-cols-12` layout.
    - **Search (9)**: `Field` + `Input` with `Search` prefix. 
    - **Status (3)**: `Field` + `Select` (All, Active, Completed, Terminated).

### 3.2 Registry Table (List View)
- **Component**: `<Table caption="Operational ledger of lease agreements" />`.
- **Columns**: 
    1. **Registry ID**: `#CONTRACT-{id}` (DM Mono).
    2. **Tenant Resident**: Name (Bold) + Move-in Date (Muted).
    3. **Room / Bed**: Room Code (Bold) + Bed Label (Muted).
    4. **Monthly Yield**: `formatPHP(monthly_rate)` (DM Mono, Right-aligned).
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
| Monthly Yield | `monthly_rate` | Currency formatting; Tabular Mono. |
| Deposit | `deposit_amount` | Currency formatting; Tabular Mono. |
| Status | `status` | ENUM: `active`, `completed`, `terminated`. |

---

## 5. Interaction & Motion (Master §6)

- **Entry**: `pageVariants` (opacity + 8px y-translation).
- **Row Hover**: `hover:bg-stone-50` with `cursor-pointer`.
- **Move-out Process**: Triggers a confirmation modal with `AlertTriangle` icon and destructive action button.
- **Navigation**: Full-row click target; use `e.stopPropagation()` on links and action buttons.

---

## 6. Consistency Audit Checklist

- [ ] Does the Page Header use the standardized title and subtitle from Master §21?
- [ ] Is the form layout using the `max-w-4xl` parity rule (PageHeader + Cards + Footer)?
- [ ] Are all Registry IDs prefixed correctly (e.g., `#CONTRACT-1`, `#TENANT-5`)?
- [ ] Does the "Process Move-out" action use a confirm modal?
- [ ] Are currency fields (Monthly Yield, Deposit) using `DM Mono`?
- [ ] Is the primary CTA named "Register Contract" as per Master §8?

---

*This document is a child of the Master Specification. For all base rules on typography, color, and primitives, refer to `../MASTER.md`.*
