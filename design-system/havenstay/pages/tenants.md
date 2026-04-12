# Tenant Directory Design Specification — v4.3 (Master-Aligned)

> **PROJECT:** HavenStay Boarding House Management System (BHMS)
> **Last Updated:** 2026-04-12
> **Page Type:** Directory / List View
> **Routes:** `/tenants`, `/tenants/[id]`, `/tenants/new`, `/tenants/[id]/edit`

> [!IMPORTANT]
> This specification follows the **Directory** pattern defined in **[../MASTER.md](../MASTER.md)** (Section 18.2). It mandates 100% usage of reusable components for Headers, Tables, and Forms to ensure architectural consistency with the Dashboard.

---

## 1. Page Purpose

The Tenant Directory acts as the central ledger for all resident data. It provides visual evidence of **tenant history** (SRS FR-008) and **contact integrity** through:
- **Searchable Ledger**: High-density table with real-time multi-field search.
- **Operational KPIs**: Summary of active residents and bed saturation atop the directory.
- **Actionable Records**: Direct paths to contracts, profiles, and billing context.

---

## 2. Layout Structure (Master §4)

### 2.1 Tenants List (`/tenants`)
1.  **Page Header**: `Tenant Directory` with "Register Tenant" Primary CTA.
2.  **Summary KPIs**: 3-column `KpiCard` grid (Active, Saturation, Pending).
3.  **Filter Hub**: `Registry Card` with strip title **Filters** (**MASTER §5.8.3**).
4.  **Main Ledger**: `Table` primitive with row-level navigation to details.

### 2.2 Tenant Profile Detail (`/tenants/[id]`)
- **Profile Header**: Displays `{First Name} {Last Name}` with Status Badge.
- **Split View**:
    - **Sidebar (4)**: Personal Information card (Contact, ID, Emergency).
    - **Main (8)**: Contract History registry table and Payment Ledger.

---

## 3. Component Standards (Master §5)

### 3.1 Registry Card (Filters)
- **Header**: Standard `hs-strip-title` "Registry Filters" with `User` icon well.
- **Body**: `md:grid-cols-12` layout.
    - **Search (9)**: `Field` + `Input` with `Search` prefix. 
    - **Status (3)**: `Field` + `Select` (Active, Moved Out, Archived).

### 3.2 Registry Table
- **Component**: `<Table caption="List of active and historical resident records" />`.
- **Columns**: 
    1. **Resident**: `Avatar` + Name (Bold) + `#TENANT-{id}` (Mono).
    2. **Contact**: Phone + Email (Stacked, Tabular Mono).
    3. **Room**: Room Code or "Unassigned".
    4. **Status**: Standard `StatusBadge`.
    5. **Actions**: `ActionGroup` with `ArrowUpRight` circle button.

### 3.3 Form Standards (New/Edit)
- **Form Shell**: Centered `max-w-4xl` column containing `PageHeader`, alerts, and cards.
- **Input Fields**: Standard `Input`, `Select`, `Textarea` from `Fields.js`.
- **Validation**:
    - Contact: PH Mobile Pattern (`09XXXXXXXXX`).
    - Required: First Name, Last Name, Contact.

---

## 4. Data Fidelity (Source of Truth)

All data mappings must strictly follow `db/havenstay_schema.sql` enums and field types.

| UI Label | DB Attribute | Rule |
| :--- | :--- | :--- |
| Resident Name | `first_name`, `last_name` | Concat for UI; individual for forms. |
| Tenant ID | `tenant_id` | Prefix with `#TENANT-` (Master §3). |
| Status | `status` | ENUM: `active`, `moved_out`, `archived`. |
| Contact | `contact_number` | Tabular Mono formatting required. |

---

## 5. Interaction & Motion (Master §6)

- **Entry**: `pageVariants` (opacity + 8px y-translation).
- **Row Hover**: `hover:bg-stone-50` with `cursor-pointer`.
- **Navigation**: Full-row click target; use `e.stopPropagation()` on row-level action buttons.

---

## 6. Consistency Audit Checklist

- [ ] Does the page title match the Master Spec Table (§21)?
- [ ] Are all currency/number fields using `font-mono tabular-nums`?
- [ ] Is the primary button using `primaryLinkCtaClass`?
- [ ] Are custom `div` zero-states replaced with `<EmptyState />`?
- [ ] Are all icons sourced from the shared `Icons.js` or `Lucide` keys?

---

*This document is a child of the Master Specification. For all base rules on typography, color, and primitives, refer to `../MASTER.md`.*
