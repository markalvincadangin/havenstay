# Billing Page Design Specification

> **PROJECT:** HavenStay
> **VERSION:** 4.3 (Human-First Language Sync)
> **STATUS:** Authoritative Standard
> **Routes:** `/billing`, `/billing/[id]`, `/billing/new`, `/billing/generate` (alias of `/billing/new`)

## Form Contract Reference

- Shared form theme and validation behavior: `FORM_PAGES.md` §1
- Billing form routes and allowed fields: `FORM_PAGES.md` §2.6
- Source of truth: `docs/SRS.md` (FR-020 to FR-023, BR-001, BR-003, BR-014), `docs/API_REFERENCE.md`, `backend/database/sql/havenstay_schema.sql`

---

## 1. Module Purpose
The Billing module manages all rent collections, utility charges, and payment tracking. It provides a clear, simple way for staff to see who has paid and who still owes.

**Design Philosophy:** Human-Centric Management. Financial data should be clear and easy to read, using familiar boarding house terms like "Rent" and "Unpaid Balance" instead of technical jargon.

---

## 2. Page Architecture

### 2.1 Billing List
A bird's-eye view of all current and past rent cycles.

**Layout Summary:**
- **Summary Cards**: Quick count of **Total Collections**, **Unpaid Rent**, and **Active Bills**.
- **Filters**: Simple search by name or room, plus status filters (Paid, Unpaid, Overdue).
- **Billing Table**: A scannable list showing the resident, room, billing dates, and current balance.

### 2.2 Billing Detail
A deep dive into a specific resident's monthly bill.

- **Sidebar (Summary)**: Shows the current balance, total paid, and the **Record Payment** button.
- **Main View**:
  - **Billing Summary**: Basic details like the billing dates and the room assigned.
  - **Charges & Fees**: A breakdown of rent and utility costs for the month.
  - **Recent Payments**: List of payments already made toward this bill.

### 2.3 New Billing Form
Used to create a new monthly bill for a resident.

- **Contract**: Choose the active contract.
- **Billing Dates**: Select Billing Period Start, Billing Period End, and Due Date.
- **Line Items**: Enter Charge Type, Description, and Amount.
- **Actions**: Click **Generate Bill** to save or **Cancel** to go back.

### 2.5 Exact Form Labels (Parity with `FORM_PAGES.md` §2.6)
Header fields:
- Contract (`contract_id`)
- Billing Period Start (`billing_period_from`)
- Billing Period End (`billing_period_to`)
- Due Date (`due_date`)

Line item fields:
- Charge Type (`item_type`)
- Description (`item_description`)
- Amount (`amount`)

### 2.4 Billing Generate Alias
`/billing/generate` is a route alias that renders the same page as `/billing/new`.

- **Behavior**: Same form, validation, and submit flow as `/billing/new`.
- **Labeling**: Keep user-facing copy as **Generate Bill** / **Create Bill** (no separate alias-specific wording).

---

## 3. Data & Labeling (Human-First)

| UI Label | Technical Key | Friendly Mapping |
| :--- | :--- | :--- |
| **ID** | `billing_id` | Simplified identifier |
| **Contract** | `contract_id` | Selected active contract for the billing cycle |
| **Total Amount** | `total_amount` | The full amount of the bill |
| **Paid** | `total_paid` | Amount already collected |
| **Unpaid Balance** | `balance` | Remaining amount to collect |
| **Billing Cycle** | `period_from/to` | The start and end dates of the stay |
| **Status** | `status` | Paid, Unpaid, Partial, or Overdue |

---

## 4. UI Standards

### 4.1 Typography
- **Currency**: Clear, aligned numbers (Mono).
- **Labels**: Small, bold, and clear caps for headers.
- **Descriptive Text**: Medium font weight for easy reading.

### 4.2 Friendly Terminology
- **Header Button**: "Generate Bill"
- **Detail Button**: "Record Payment"
- **Form Action**: "Create Bill"
- **Navigation**: "Go Back" or "Cancel"

---

## 5. Quality Checklist

- [ ] Does the page use "Unpaid Balance" instead of "Receivable"?
- [ ] Is "Record Payment" used instead of "Process Reception"?
- [ ] Are dates clearly labeled "Billing Cycle"?
- [ ] Are all section headers simple (e.g., "Charges & Fees" instead of "Ledger Items")?

---

## 6. Page Titles and Subtitles (Master §21 Exact)

| Route | Title (H1) | Subtitle |
| :--- | :--- | :--- |
| `/billing` | `Billing` | `Monitor account balances and track monthly billing cycles across all contracts.` |
| `/billing/[id]` | `Billing *(# id)*` | `Line items, payments, and status for this cycle.` |
| `/billing/new` and `/billing/generate` | `Billing` | `Monitor account balances and track monthly billing cycles across all contracts.` |

---

*Verified against human-centric management goals for HavenStay.*
