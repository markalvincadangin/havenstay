# Reports Design Specification — v5.0 (Forensic-Hardened)
> **Last Updated:** 2026-04-18
> **PROJECT:** HavenStay BHMS
> **Authoritative Specification:** Aligned to `MASTER.md` v5.0.0
> **Implementation Scope:** `/reports`, `/reports/occupancy`, `/reports/collections`, `/reports/billing-summary`, `/reports/outstanding-balances`, `/reports/tenant-ledger`, `/reports/tenant-history`, `/reports/active-contracts`, `/reports/occupancy-status`

---

## 1. Visual Architecture

The reporting module follows the **Analytical Stack** pattern. Reports prioritize quick interpretation, consistent filtering, and clean export-ready data views.

### 1.1 Page Construction (Stacking Order)

1. **PageHeader**: Title + subtitle from `MASTER.md` Section 21, breadcrumbs, and actions (`UserRoleBadge`, `Export CSV` when available).
2. **Summary Layer**: `KpiCard` grid for high-priority metrics.
3. **Filter Card**: Registry `Card` with strip title **Filters**, controls, and `FilterChips`.
4. **Data Card**: Embedded `Table` for review and export parity.

### 1.2 Non-Negotiable Standards

- **Readable first**: Data should be understandable in under 5 seconds for common tasks.
- **Chart discipline**: Use bar and line charts for quantity and trends; avoid decorative chart types that reduce readability.
- **Numeric consistency**: Amounts, IDs, and timestamps use `DM Mono` (`tabular-nums`).
- **Surface consistency**: Use `rounded-2xl` card shells with stone borders.
- **Data freshness**: Show generated timestamp where applicable.

---

## 2. Core Components and Behavior

### 2.1 Reports Hub (`/reports`)

- Use the hub-card pattern with clear report names and plain-language descriptions.
- Card CTA label should be **Generate Report**.
- Do not use technical labels in card descriptions.

### 2.2 Filters and Table

- Filters must be discoverable and visibly active when applied.
- Provide search + date + status/category filters based on report context.
- Always include `FilterChips` and **Clear all** behavior.
- Empty states must explain why no rows appear and provide a next step.

### 2.3 Data Table Rules

- Prioritize columns needed for find, compare, and export tasks.
- Use frozen/sticky headers where large datasets are expected.
- Keep column labels human-readable and stable across report + CSV.

---

## 3. Standardized Report Views

### 3.1 Occupancy (`/reports/occupancy`, `/reports/occupancy-status`)
- Purpose: Room and bed utilization.
- Key metrics: Total beds, occupied beds, vacant beds, occupancy rate.

### 3.2 Billing and Collections (`/reports/billing-summary`, `/reports/collections`)
- Purpose: Billing totals and payment performance.
- Key metrics: Total billed, total collected, outstanding balance.

### 3.3 Outstanding Balances (`/reports/outstanding-balances`)
- Purpose: Unpaid and past-due monitoring.
- Key metrics: Total outstanding, past-due accounts, highest due balance.

### 3.4 Tenant Financial History (`/reports/tenant-ledger`, `/reports/tenant-history`)
- Purpose: Resident-level payment/billing timeline and status history.
- Key metrics: Running balance, billed amount, paid amount, outstanding amount.

### 3.5 Active Contracts (`/reports/active-contracts`)
- Purpose: Current contract commitments and room assignment context.
- Key metrics: Active contracts, occupied bed spaces, monthly contract total.

---

## 4. Accessibility and UX Quality Gates

- All filter controls are keyboard-accessible with visible focus states.
- Pointer targets should be at least 24x24 CSS px minimum (prefer 44x44 for primary actions on mobile).
- Error and empty states use clear, plain language and one recovery step.
- Keep labels persistent (do not rely on placeholder-only forms for meaning).

---

## 5. Page Titles and Subtitles (Master Section 21 Exact)

| Route area | Title (H1) | Subtitle |
| :--- | :--- | :--- |
| `/reports` | `Reports` | `Operational exports and summaries.` |
| `/reports/*` | `*(Report name)*` | `Filter, review, and export - columns match the CSV.` |

---

*Verified against HavenStay MASTER v5.0.0 Forensic Hardening pass.*
