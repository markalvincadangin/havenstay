# Billing Design Specification — v5.0 (Forensic-Hardened)
> **Last Updated:** 2026-04-18
> **Routes:** `/billing`, `/billing/[id]`, `/billing/wizard` (v3.0 itemizer)

## Form Contract Reference

- Shared form theme and validation behavior: `FORM_PAGES.md` §1
- Itemized Billing Wizard contract: `FORM_PAGES.md` §2.13
- Source of truth: `docs/SRS.md` (FR-020 to FR-023c), `docs/API_REFERENCE.md`, `havenstay_schema.sql` v3.0

---

## 1. Module Purpose
The Billing module manages the lifecycle of monthly ledger entries. For Release 1, it utilizes the **Itemized Billing Wizard** to ensure that rent, utilities (sub-metered), and appliances are captured atomically.

**Design Philosophy:** Disciplined Operational Integrity. Financial data is presented with forensic precision (Mono IDs, audit trails) but with frictionless administrative flows.

---

## 2. Page Architecture

### 2.1 Billing List
- **Summary Layer**: `KpiCard` grid (Total Collections, Outstanding Balance, Active Cycles).
- **Filters**: Registry Card with **Filters** strip. Search by Tenant Name or `#BILL-{id}`.
- **Billing Table**: 
  - **Billing ID**: `#BILL-{id}` (**Forensic Label** mono).
  - **Tenant**: `{LastName}, {FirstName}`.
  - **Cycle**: `MM/DD - MM/DD`.
  - **Balance**: `CurrencyCell` (Outstanding amount).
  - **Status**: `StatusBadge` (Paid, Partial, Overdue, Unpaid).

### 2.2 Billing Detail (`/billing/[id]`)
- **Split View**:
  - **Sidebar (4)**: Balance Summary (Total Billed, Total Paid, Remaining) and `Record Payment` Primary CTA.
  - **Main (8)**: 
    - **Line Items**: Table of `base_rent`, `utility`, and `add_on` entries.
    - **Payment History**: Table of non-voided payments.
    - **Metadata Strip**: Forensic trail (Created by, Correlation ID).

### 2.3 Itemized Billing Wizard (`/billing/wizard`)
The authoritative generation workflow. 
- **Section 1: Lease Context**: Selection of active contract (auto-fills Base Rent).
- **Section 2: Utility Sync**: Multi-select unbilled meter readings (`reading_ids`).
- **Section 3: Appliance Add-ons**: Toggle active appliances for the period.
- **Section 4: Summary**: Impact Preview showing the **Total Bill Amount**.

---

## 3. Data & Labeling (Forensic-Hardened)

| UI Label | Technical Key | Format |
| :--- | :--- | :--- |
| **Billing ID** | `billing_id` | `#BILL-{id}` (Mono) |
| **Cycle** | `period_from/to` | Date Range |
| **Unpaid Balance** | `balance` | `CurrencyCell` |
| **Status** | `status` | `StatusBadge` |
| **Correlation** | `correlation_id` | `CorrelationIdCell` |

---

## 4. UI Standards
- **Currency**: `DM Mono` tabular-nums.
- **IDs**: `#BILL-` prefix mandatory.
- **Wizard Labels**: All Caps strip titles (e.g., `UTILITY SYNC`, `LEASE CONTEXT`).

---

## 5. Page Titles and Subtitles (Master §21 Exact)

| Route | Title (H1) | Subtitle |
| :--- | :--- | :--- |
| `/billing` | `Billing` | `Monitor account balances and track monthly billing cycles across all contracts.` |
| `/billing/[id]` | `Billing *(# id)*` | `Line items, payments, and status for this cycle.` |
| `/billing/wizard` | `Billing Wizard` | `Generate monthly ledger entries with automated utility and appliance itemization.` |

---

*Verified against forensic v3.0 schema and ManagesWorkflows requirement.*
