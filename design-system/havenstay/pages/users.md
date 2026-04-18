# User Directory Design Specification — v5.0 (Forensic-Hardened)

> **PROJECT:** HavenStay Boarding House Management System (BHMS)
> **Last Updated:** 2026-04-18
> **Page Type:** Administration / Access Control
> **Routes:** `/users`, `/users/new`, `/users/[id]/edit`

> [!IMPORTANT]
> This specification handles sensitive administrative access. It mandates usage of the **analytical reporting stack** (Master §23) for the list view and the **multi-card form pattern** (Master §12) for account management.

## Form Contract Reference

- Shared form theme and validation behavior: `FORM_PAGES.md` §1
- User form routes and allowed fields: `FORM_PAGES.md` §2.8 and §2.9
- Source of truth: `docs/SRS.md` (FR-005 to FR-007), `docs/API_REFERENCE.md`, `backend/database/sql/havenstay_schema.sql`

---

## 1. Page Purpose

The User Directory is the main page for staff account management and security oversight (SRS FR-005–007).
- **Staff list**: Unified view of all accounts, roles, and current activation status.
- **Role Assignment**: Granting and revoking system-level permissions (Admin, Staff, Viewer).
- **Account Control**: Deactivating or reactivating staff access to prevent unauthorized entry.

---

## 2. Layout Structure

### 2.1 User Directory (`/users`)
1.  **Page Header**: `User Directory` with subtitle `Staff accounts and roles (Admin only).` and "Register Account" primary CTA.
2.  **Summary KPIs**: 3-column `KpiCard` grid (Total Accounts, Active, Administrators).
3.  **Filter strip**: `Registry Card` with strip title **Filters** (**MASTER §5.8.3**) — Search, Role, and Status.
4.  **Account Table**: `Table` primitive with row-level "Edit" and "Active Toggle" actions.

### 2.2 User Registration & Edit (`/users/new`, `/users/[id]/edit`)
- **Header**: `Register Account` or `Update details`.
- **Form Columns**: Single column `max-w-4xl`.
- **Card 1: Identity Details**: Name, Username, Email.
- **Card 2: System Access**: `System Role` selection and `Account is active` toggle.
- **Card 3: Security Credentials**: Password input/reset fields.

### 2.3 Exact Form Labels (Parity with `FORM_PAGES.md` §2.8 and §2.9)
Create form (`/users/new`):
- First Name (`first_name`)
- Last Name (`last_name`)
- Username (`username`)
- Email (`email`)
- System Role (`role_id`)
- Password (`password`)

Edit form (`/users/[id]/edit`):
- First Name (`first_name`)
- Last Name (`last_name`)
- Username (`username`)
- Email (`email`)
- System Role (`role_id`)
- New Password (`password`) - optional
- Account Active (`is_active`) - optional

---

## 3. Component Standards

### 3.1 Account Summary (KPIs)
- **Component**: `<KpiCard />` from `src/app/_components/ui/KpiCard.js`.
- **Total Accounts**: Neutral stone-900 value.
- **Active Accounts**: Emerald-800 value (`teal-600` theme).
- **Administrators**: Bold stone-900 (Security-critical count).

### 3.2 Access Control Toggle (New Pattern)
- **Requirement**: Standardized visual pattern for account deactivation.
- **Implementation**: A labeled `Checkbox` inside a tinted `Card` section with a description.
- **Context**: "Account is active - Check to enable system access; uncheck to block login entry."

### 3.3 User Audit Log (New Pattern)
- **Requirement**: Quick visibility of recent actions by an account.
- **Implementation**: A secondary `Registry Card` at the bottom of the Edit page (collapsed by default or linked) showing `audit_logs` for that specific `user_id`.

---

## 4. Terminology and Microcopy (Section 8 Compliance)

Avoid "Registry" and technical CRUD jargon in labels.

| Legacy Label | Human-First Label | Rationale |
| :--- | :--- | :--- |
| **Legacy Filter Panel** | **Filters** | Matches strip title (MASTER §5.8.3). |
| **User Registry** | **User Directory** | More intuitive for staff listing. |
| **Identity Settings** | **Identity Details** | Clear administrative label. |
| **Revoke Access** | **Deactivate** | Standard SaaS activation state. |
| **Baseline Role** | **System Role** | User-friendly permission label. |

---

## 5. Security & Permission Rules

- **Self-Protection**: Users cannot deactivate their own account or change their own role (prevents lockouts).
- **Admin Lock**: Only accounts with the `admin` role can access the `/users` route. Redirect `staff` or `viewer` users with an `Alert`.
- **Monetary IDs**: User IDs should use `font-mono tracking-tighter` with a `#` prefix (e.g. `#101`).

---

## 6. Consistency Audit Checklist

- [ ] Does the PageHeader use the `User directory` title from Master §21?
- [ ] Is the "Register Account" button using `Plus` icon and teal-600 background?
- [ ] Do role badges match the Role Color tokens in Section 3.2?
- [ ] Are all API errors flattened via `flattenApiErrors()` and surfaced in an `Alert`?

---

## 7. Page Titles and Subtitles (Master §21 Exact)

| Route | Title (H1) | Subtitle |
| :--- | :--- | :--- |
| `/users` | `User Directory` | `Staff accounts and roles (Admin only).` |

---

*This document is a child of the Master Specification. Final authority for visual primes remains with `../MASTER.md`.*
