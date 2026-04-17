# Audit Trail Design Specification — v4.3 (Master-Aligned)

> **PROJECT:** HavenStay Boarding House Management System (BHMS)
> **Last Updated:** 2026-04-12
> **Page Type:** Administration / Security Oversight
> **Routes:** `/audit-logs`
> **Requirements:** SRS FR-034 (Audit Trail), FR-036 (Correlation Linkage)

> [!IMPORTANT]
> This specification follows the **Analytical Reporting Stack** defined in **[../MASTER.md](../MASTER.md)** (Section 23). It mandates absolute data fidelity for immutable security trails.

---

## 1. Page Purpose

The Audit Trail provides a tamper-proof record of all system interactions and state changes.
- **Data Integrity**: Visualizing the capture of 24 database-level triggers ensuring no update occurs without a trace.
* **Operational Accountability**: Linking actions (CRUD) to specific administrative users and timestamps.
* **Security Monitoring**: Tracking authentication events (login, logout, access denied).

---

## 2. Layout Structure (Analytical Stack §23)

### 2.1 Audit Hub (`/audit-logs`)
1.  **Page Header**: `Audit Trail` with subtitle `Who changed what: data changes, sign-ins, and access denied (admin).` Breadcrumbs, secondary outline link **Transaction logs** → `/transaction-logs`, **Export CSV** (primary teal per **MASTER §23.1**), User Role Badge. Do not embed the transaction table here (**MASTER §5.8.2**).
2.  **Summary KPIs** (§23): Two tiles only — **Rows after filters** (filtered `meta.total`, all pages) and **Access denied** (denials within that total). Filters and table sit *below* the KPI row; subcopy must not use misleading “above.” No third KPI (cross-page workflow totals belong on **Transaction logs**).
3.  **Activity Filter Strip**: `Registry Card` titled **Filters** (strip pattern per **MASTER §5.8.2**).
    - Combined Search (User/IP).
    - Entity Type Selector (Tenants, Rooms, etc.).
    - Action Type Selector (Create, Update, Status Change).
    - Date Range (From/To).
4.  **Immutable Table**: Standard `Table` primitive displaying chronological events.
5.  **Log Detail Modal**: Deep-dive into specific changes using the **Change Comparison View**.

---

## 3. Field changes (audit event modal)

The modal section titled **Field changes** is the pattern for attribute-level diffs from `old_values_json` and `new_values_json`.

### 3.1 Visual standards
- **Component**: Contained within the audit **Event detail** modal.
- **Table structure**:
    - **Header**: Column titles `Attribute`, `Original`, `Modified`.
    - **Attribute Column**: `bg-stone-50/20` vertical strip, `font-bold text-stone-900`.
    - **Original Value**: `line-through decoration-rose-400/50 text-rose-900/70` inside `bg-rose-50/50` pill.
    - **Modified Value**: `font-bold text-emerald-800` inside `bg-emerald-50` pill with `border-emerald-100/50`.
- **Empty State**: Use "No field changes recorded" visual for auth events or non-attribute logs.

---

## 4. Component Mapping & Tokens

### 4.1 Event Severity (StatusBadge)
Audit actions MUST use the standardized `StatusBadge` mapping defined in Master §25.

| Action | Badge Variant | Color Logic |
| :--- | :--- | :--- |
| `create` | `badge-success` | Growth/Addition (Emerald) |
| `update` | `badge-info` | Modification (Teal) |
| `status_change` | `badge-warning` | State Pivot (Amber) |
| `delete` | `badge-danger` | Removal (Red) |
| `access_denied` | `badge-danger` | Security Failure (Red) |
| `login` / `logout` | `badge-neutral` | Routine Session (Stone) |

### 4.2 Metadata Typography
- **Timestamp**: `font-mono tabular-nums text-stone-600`.
- **Entity ID**: `font-mono tracking-tighter text-stone-500` prefixed with `#`.
- **Raw JSON**: `font-mono text-[10px] text-stone-500` inside a collapsed `details` block.

---

## 5. Data Fidelity (Source of Truth)

Mappings must match `db/havenstay_schema.sql` exactly.

| UI Label | DB Field | Mapping |
| :--- | :--- | :--- |
| **Timestamp** | `created_at` | Browser-local `toLocaleString` (en-PH). |
| **Actor** | `user_id` | Join `users` table for full name + username. |
| **Action** | `action` | Map to `ACTION_LABELS` (Title Case). |
| **Resource** | `entity_name` | Table name or permission key — use **`formatAuditEntityOrResource()`** in `constants.js`. |
| **Correlation** | `correlation_id` | Optional UUID; may match a **Transaction logs** row for the same run; **`CorrelationIdCell`** (truncate + copy). |

---

## 6. Interaction & Defensive UX

- **Immutable State**: Audit logs are read-only. No Edit/Delete actions permitted.
- **Export control**: **MASTER §23.1** — include **Export CSV** in `PageHeader` actions for downloadable audit evidence.
- **Paging**: Infinity scroll or paginated table (25 rows/page default).

---

## 7. Page Titles and Subtitles (Master §21 Exact)

| Route | Title (H1) | Subtitle |
| :--- | :--- | :--- |
| `/audit-logs` | `Audit Trail` | `Who changed what: data changes, sign-ins, and access denied (admin).` |

---

*This document is a child of the Master Specification. For global primitives, refer to `../MASTER.md`.*
