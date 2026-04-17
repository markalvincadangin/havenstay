# Transaction Logs — Page Specification (MASTER-aligned)

> **PROJECT:** HavenStay BHMS  
> **Last updated:** 2026-04-12  
> **Route:** `/transaction-logs`  
> **SRS:** FR-034, FR-035, CCR-007 (`transaction_logs` application-level lifecycle)  
> **MASTER:** §5.8.2, §14, §24; implementation: `frontend/src/app/transaction-logs/page.js`

## Purpose

**Transaction logs** are **not** MySQL transaction boundaries and **not** stored procedures. They record **one row per critical business workflow run** (payment post, void, move-out, billing generation, etc.): `started` → `committed` | `rolled_back` | `failed`, per `docs/SRS.md` §4.9 and `transaction_logs.status` in `havenstay_schema.sql`.

**Audit Trail** (`/audit-logs`) is separate: row-level changes and security events. Link between the two when present: optional **`correlation_id`** (same UUID on a workflow row and on related `audit_logs` rows).

---

## Layout (registry + analytical)

1. **`PageHeader`** — Title **Transaction logs**; subtitle **Workflow runs and database transaction outcomes (started, committed, rolled back, or failed).**; breadcrumbs **System Administration → Transaction logs**; secondary outline link **Audit Trail** → `/audit-logs`; **`UserRoleBadge`**.
2. **KPI row** — **One** `KpiCard`: **Runs after filters** — `meta.total` (all pages). Subcopy: *Same rules as the table below · all pages* (filters below the KPI row). Do **not** mix page-only stats unless the API exposes aggregates.
3. **Filters `Card`** — Same registry pattern as **Audit Trail**: strip **Filters** + **Refresh** (ghost), body **`flex flex-col gap-6`** with **`form`**: row 1 **Search** (`lg:col-span-8`) + **Status** (`lg:col-span-4`); row 2 **From** / **To** (`lg:col-span-8` inner two-column grid) + **Apply filters** (`secondary`, `!h-12`, `lg:col-span-4`). **Apply-on-submit** (draft fields vs `applied*` state driving the API — mirrors audit). **`FilterChips`** reflect **applied** filters.
4. **`Table` `embedded`** — Caption e.g. process runs; columns per **MASTER §5.8.2**: Transaction log ID (`#TX-{id}`), Started at, Transaction (`tx_name` humanized), Initiated by, Status (`StatusBadge`), Correlation (`CorrelationIdCell`), Reference.
5. **`TablePagination`** — `meta` from API.
6. **Modal (run detail)** — Title **Run detail**; process name; status badge; **Times & reference** (started, completed, reference, correlation); **Details (JSON)** for `details_json`. Button **Close** (not “inspector” jargon).

---

## Status badges

Map `transaction_logs.status` ENUM to `StatusBadge` / `TX_LOG_STATUS_LABELS`:

| `status`       | Typical badge variant (see `StatusBadge.jsx`) |
| :------------- | :--------------------------------------------- |
| `started`      | `badge-info`                                   |
| `committed`    | `badge-success`                                |
| `rolled_back`  | `badge-warning`                              |
| `failed`       | `badge-danger`                                 |

---

## Data mapping (schema)

| UI              | Column / notes |
| :-------------- | :------------- |
| Log id          | `tx_log_id` — display `#TX-{id}` |
| Process         | `tx_name` — humanize (remove `sp_` prefix if present; title-case) |
| Times           | `started_at`, `completed_at` — `tabular-nums`, locale per app |
| Status          | `status` |
| Reference       | `reference_entity` + `reference_id` |
| Correlation     | `correlation_id` — **`CorrelationIdCell`** |
| Details         | `details_json` — JSON in `<pre>`, optional |

There are **no** stored procedures in the HavenStay schema; do not document `sp_*` as DB execution.

---

## Access

Admin-only (same RBAC as Audit Trail list). Read-only list; no destructive actions on this page.

---

## Page Titles and Subtitles (Master §21 Exact)

| Route | Title (H1) | Subtitle |
| :--- | :--- | :--- |
| `/transaction-logs` | `Transaction logs` | `Workflow runs and database transaction outcomes (started, committed, rolled back, or failed).` |

---

*Parent spec: [`../MASTER.md`](../MASTER.md). API: `docs/API_REFERENCE.md` — `GET /api/transaction-logs`.*
