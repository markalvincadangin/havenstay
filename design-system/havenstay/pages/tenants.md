# Tenant Directory Design Specification — v5.0 (Forensic-Hardened)

> **PROJECT:** HavenStay Boarding House Management System (BHMS)
> **Last Updated:** 2026-04-18
> **Page Type:** Directory / List View
> **Routes:** `/tenants`, `/tenants/[id]`, `/tenants/new`, `/tenants/[id]/edit`

> [!IMPORTANT]
> This specification follows the **Registry** pattern defined in **[../MASTER.md](../MASTER.md)** (Section 18.2). It mandates the use of forensic mono-prefixes for all IDs and strict adherence to the **Forensic Label** aesthetic for metadata.

## Form Contract Reference

- Shared form theme and validation behavior: `FORM_PAGES.md` §1
- Tenant form routes and allowed fields: `FORM_PAGES.md` §2.2
- Source of truth: `docs/SRS.md` (FR-008, FR-009, BR-016), `docs/API_REFERENCE.md`, `backend/database/sql/havenstay_schema.sql`

---

## 1. Page Purpose

The Tenant Directory is the central page for resident records. It supports **tenant history** (SRS FR-008) and accurate contact data through:
- **Searchable list**: High-density table with real-time multi-field search.
- **Operational KPIs**: Summary of active residents and bed saturation atop the directory.
- **Actionable Records**: Direct paths to contracts, profiles, and billing context.

---

## 2. Layout Structure (Master §4)

### 2.1 Tenants List (`/tenants`)
1.  **Page Header**: `Tenant Directory` with "Register Tenant" Primary CTA.
2.  **Summary KPIs**: 3-column `KpiCard` grid (Active, Saturation, Pending).
3.  **Filter Hub**: `Registry Card` with strip title **Filters** (**MASTER §5.8.3**).
4.  **Main List**: `Table` primitive with row-level navigation to details.

### 2.2 Tenant Profile Detail (`/tenants/[id]`)
- **Profile Header**: Displays `{First Name} {Last Name}` with Status Badge.
- **Split View**:
    - **Sidebar (4)**: Personal Information card (Contact, ID, Emergency).
    - **Main (8)**: Contract history table and payment history.

---

## 3. Component Standards (Master §5)

### 3.1 Registry Card (Filters)
- **Header**: Standard `hs-strip-title` "Filters" with `User` icon well.
- **Body**: `md:grid-cols-12` layout.
    - **Search (9)**: `Field` + `Input` with `Search` prefix. 
    - **Status (3)**: `Field` + `Select` (Active, Moved Out, Archived).

### 3.2 Registry Table
- **Component**: `<Table caption="List of active and historical resident records" />`.
- **Columns**: 
    1. **Resident**: `Avatar` + Name (Bold) + `#TENANT-{id}` (**Forensic Label** mono).
    2. **Contact**: Phone + Email (Stacked, Tabular Mono).
    3. **Room**: Room Code or "Unassigned".
    4. **Status**: Standard `StatusBadge`.
    5. **Actions**: `ActionGroup` with `ArrowUpRight` circle button.

### 3.3 Form Standards (New/Edit)
- **Form Shell**: Centered `max-w-4xl` column containing `PageHeader`, alerts, and cards.
- **Input Fields**: Standard `Input`, `Select`, `Textarea` from `Fields.js`.
- **Validation**:
    - Contact Number: PH Mobile Pattern (`09XXXXXXXXX`).
    - Required: First Name, Last Name, Contact Number, Email, Emergency Contact Name, Emergency Contact Number, Address.

### 3.4 Exact Form Labels (Parity with `FORM_PAGES.md` §2.2)
- First Name (`first_name`)
- Last Name (`last_name`)
- Contact Number (`contact_number`)
- Email (`email`)
- Emergency Contact Name (`emergency_contact_name`)
- Emergency Contact Number (`emergency_contact_number`)
- Address (`address`)

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

## 7. Page Titles and Subtitles (Master §21 Exact)

| Route | Title (H1) | Subtitle |
| :--- | :--- | :--- |
| `/tenants` | `Tenant Directory` | `Manage profile data, contact details, and historical lease statuses.` |
| `/tenants/[id]` | `*(Tenant name)*` | `Profile details — contact, lease, and billing context.` |
| `/tenants/new` and `/tenants/[id]/edit` | `Register tenant / Update details` | `Enter accurate information for tenant records to ensure billing and contract accuracy.` |

---

*This document is a child of the Master Specification. For all base rules on typography, color, and primitives, refer to `../MASTER.md`.*
