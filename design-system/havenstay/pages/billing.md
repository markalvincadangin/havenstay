# Billing Page Design Specification

> **PROJECT:** HavenStay
> **VERSION:** 4.3 (Human-First Language Sync)
> **STATUS:** Authoritative Standard
> **Routes:** `/billing`, `/billing/[id]`, `/billing/new`

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
- **Search & Filters**: Simple search by name or room, plus status filters (Paid, Unpaid, Overdue).
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

- **Tenant & Room**: Choose the resident and their contract.
- **Billing Dates**: Select the start and end dates for this rent cycle.
- **Monthly Charges**: Enter the rent amount and any utility fees.
- **Actions**: Click **Generate Bill** to save or **Cancel** to go back.

---

## 3. Data & Labeling (Human-First)

| UI Label | Technical Key | Friendly Mapping |
| :--- | :--- | :--- |
| **ID** | `billing_id` | Simplified identifier |
| **Tenant** | `tenant_id` | The name of the resident |
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

*Verified against human-centric management goals for HavenStay.*
