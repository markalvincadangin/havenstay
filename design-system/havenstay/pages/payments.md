# Payments Design Specification — v5.0 (Forensic-Hardened)

> **Last Updated:** 2026-04-18
> **PROJECT:** HavenStay BHMS
> **Authoritative Sources:** `MASTER.md`, `havenstay_schema.sql`
> **Routes:** `/payments` (list), `/payments/[id]` (detail), `/payments/new` (register). **List PageHeader title** follows **MASTER.md §21**: **Payments** (not “Payment Registry”).

## Form Contract Reference

- Shared form theme and validation behavior: `FORM_PAGES.md` §1
- Payment form routes and allowed fields: `FORM_PAGES.md` §2.7
- Source of truth: `docs/SRS.md` (FR-024 to FR-027a, BR-007, BR-022), `docs/API_REFERENCE.md`, `backend/database/sql/havenstay_schema.sql`

## 1. Module Overview

The **Payments** module records all payment entries for the boarding house. It helps staff track what has been paid and link payments to billing records.

### 1.1 Keyboard shortcuts (implementation)

Canonical shortcut definitions live in the app, not only in this doc:

- **Payment method ENUM labels** and posting/void labels: `frontend/src/lib/constants.js` (`METHOD_LABELS`, `PAYMENT_STATUS_LABELS`).
- **Open new payment form:** **Alt+Shift+P** (not Ctrl+P — reserved for browser **Print**). **Refresh app data:** **Alt+Shift+R** (not Ctrl+R — browser reload). See `frontend/src/lib/appKeyboardShortcuts.js` and `frontend/src/hooks/useKeyboardShortcuts.js`.

### 1.2 Design Goals
- **Clarity:** Scannable transaction IDs and dates.
- **Auditability:** Transparent "Processed By" and "Void" trails.
- **Trust:** Emphasize currency with high-contrast mono typography (DM Mono).

---

## 2. Terminology (Human-First Labeling)

Aligning with **MASTER.md Section 8**, we eliminate technical jargon:

| Technical / Old | Human-First (Preferred) |
| :--- | :--- |
| Reception | **Register Payment** |
| Post to Ledger | **Record Payment** |
| System Gateway | **Payment Method** |
| Allocation Strategy | **Payment Information** |
| Processed By | **Recorded By** |
| Transaction Metadata | **Details** |
| Technical Notice | **Important Notes** |
| External Reference | **Reference Number** |

---

## 3. Data Schema Mapping

| UI Label | Schema Field | Note |
| :--- | :--- | :--- |
| Payment ID | `payment_id` | Format: `#PAY-{id}` (Mono) |
| Amount Paid | `amount_paid` | DM Mono, tabular-nums |
| Collection Date | `payment_date` | |
| Recorded By | `processed_by` | Linked to `users.username` |
| Method | `payment_method` | `cash`, `gcash`, `bank_transfer`, `other` |
| Reference Number | `reference_number` | DM Mono |
| Status | `voided_at` ? 'voided' : 'posted' | |

---

## 4. Page Layouts

### 4.1 Payments list (`/payments`)
- **PageHeader:** Title **Payments**, subtitle **Chronological ledger of payments, reference codes, and contract links.** (**MASTER.md §21** — supersedes older “Payment Registry” / alternate subtitle copy.)
- **KPI Grid:**
  - **Total Collected Today:** Emerald emphasis.
  - **Total Collected This Month:** Teal emphasis.
- **Filters Card:**
  - Search: Resident name, Payment ID, or Reference.
  - Filters: Status, Date Range.
- **Registry Table:**
  - Columns: ID, Date, Resident, Amount, Method, Status, Actions.
  - **Action Row:** Use `ArrowUpRight` (size 16) navigation icon in a standard well.

### 4.2 Record Payment Form (`/payments/new`)
- **Outer Wrapper:** `mx-auto w-full max-w-4xl space-y-6`.
- **Structure:** Vertical stack of registry cards.
  - **Card 1: Payment Information** (Billing Record, Amount Paid).
  - **Card 2: Details** (Payment Date, Payment Method, Reference Number, Notes).
- **Summary Panel:** Side panel (on desktop) or inline `Section` (MASTER §5.3) showing "Current Balance" and "New Balance" after payment.
- **Footer:** Cancel + Record Payment (primary teal).

### 4.4 Exact Form Labels (Parity with `FORM_PAGES.md` §2.7)
- Billing Record (`billing_id`)
- Amount Paid (`amount_paid`)
- Payment Date (`payment_date`)
- Payment Method (`payment_method`)
- Reference Number (`reference_number`) - optional
- Notes (`remarks`) - optional

### 4.3 Payment Detail (`/payments/[id]`)
- **Structure:** Split Hub Layout (33/67).
- **Sidebar (33%):**
  - **Yield Breakdown Card:** Dark card (stone-900) showing Amount Paid, Status, Date, and Method.
  - **Processing Trail Card:** Recorded By, Timestamp, Reference Number.
- **Main (67%):**
  - **Resident Allocation Card:** Resident Name, ID, Assigned Unit/Bed.
  - **Linked Billing Ledger Card:** Billing Cycle (#id), Period, Summary of items.
- **Context Footer:** "This payment record is part of the official billing history."

---

## 7. Page Titles and Subtitles (Master §21 Exact)

| Route | Title (H1) | Subtitle |
| :--- | :--- | :--- |
| `/payments` | `Payments` | `Chronological ledger of payments, reference codes, and contract links.` |

---

## 5. Visual Standards & Components

### 5.1 Icons & Assets
- **Detail Navigation:** `ArrowUpRight` (size 16).
- **Payment Method Icons:**
  - Cash: `Wallet`
  - GCash/Mobile: `Smartphone`
  - Bank: `Building2`
  - Other: `CreditCard`

### 5.2 Financial Summary Surface (Reusable Pattern)
- **Visuals:** `Card` with `bg-stone-900`, `text-white`, and high-contrast currency (`text-emerald-400`).
- **Usage:** Used for the primary "Payment Summary" or "Outstanding Balance" panel in detail views.
- **Classes:** `!p-0 overflow-hidden bg-stone-900 rounded-2xl shadow-xl`.

### 5.3 Colors (Financial Semantics)
- **Currency:** `text-emerald-700` (positive state) or `text-stone-300 line-through` (voided state).
- **Status Badges:**
  - `posted` -> `variant="success"`
  - `voided` -> `variant="neutral"`

### 5.3 Interactions
- **Confirmations:** Voiding a payment MUST trigger a confirm modal with destructive (red) action.
- **Success:** Redirect to detail view with a success toast.

---

## 6. Implementation Checklist

- [x] Use `PageHeader` with title **Payments** (MASTER §21) and **Register Payment** CTA when user can post.
- [x] Primary submit: **Record Payment** (footer on `/payments/new`).
- [x] Field label **Payment Method** (not legacy “System Gateway”).
- [x] List/detail: IDs use `#PAY-{id}` style in DM Mono where shown.
- [x] Table action column: `ArrowUpRight` (size 16).
- [x] Register form: outer wrapper `mx-auto w-full max-w-4xl` includes **PageHeader + form** (MASTER §12 — no full-width header above narrow cards).
- [x] Side summary: **Current Balance** / **New Balance** (see §4.2); teal/stone panel pattern aligned with registry cards.

**Note:** Detail view “Payment Summary” dark card (**§5.2**) is optional polish; list/register follow **MASTER** typography and `KpiCard` for KPIs.
