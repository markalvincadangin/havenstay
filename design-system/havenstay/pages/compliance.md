# Compliance Management Specifications

## 1. Overview
The Compliance module handles non-core operational data that directly impacts financial itemization: the **Appliance Registry** (Master items) and **Utility Metering** (Room sub-meters).

**Primary Objective:** Ensure every appliance and utility charge has a clear, non-regressive, and auditable trail (SRS FR-023a, FR-023b).

---

## 2. Appliance Registry List (`/compliance/registry`)

### 2.1 Visual Specification
- **Layout:** `StandardPage` with a single `Table` inside a **Registry Card** (p-0).
- **Header Actions:** 
  - `+ Register Item` (Primary Teal CTA).
- **Table Columns:**
  | Header | Traceability | Data/Type |
  | :--- | :--- | :--- |
  | **Registry ID** | `#APP-{id}` | DM Mono (Stone-400) |
  | **Item Name** | `item_name` | Title Case (Black) |
  | **Default Rate** | `default_monthly_rate` | `CurrencyCell` |
  | **Status** | `is_active` | `StatusBadge` (Active/Inactive) |
  | **Last Updated** | Timestamp | DM Mono (metadata tier) |
  | **Actions** | Edit / Archive | Standard Registry Actions |

---

## 3. Utility Metering Hub (`/compliance/meters`)

### 3.1 Room Consumption Grid
A specialized view to track pending meter readings for the current month.
- **Layout:** Grid of **Registry Cards** or a compact `Table`.
- **Primary KPI Row:**
  - **Electric Coverage:** X% (Rooms with readings this cycle).
  - **Water Coverage:** Y% (Rooms with readings this cycle).
  - **High Delta Alert:** Count of readings > 200% historic avg.

### 3.2 Reading History Detail (`/rooms/[id]/meters`)
Detailed chronological log of readings for a specific room.
- **Header:** Showing "Last Reading: 450.20 kWh" with a secondary action `+ Record Reading`.
- **Table Columns:**
  | Header | Data | Forensic Note |
  | :--- | :--- | :--- |
  | **Reading Date** | Date | Standard Date |
  | **Utility Type** | Badge | Electric (Yellow) / Water (Blue) |
  | **Value** | 1245.50 | DM Mono |
  | **Consumption** | +45.20 | Indicates delta from previous. |
  | **Actor** | Staff Name | High-density metadata label. |

---

## 4. Interaction Patterns

### 4.1 Non-Regressive Validation
When the user enters a `reading_value` less than the `previous_reading`:
- **Visual:** Instant `error` state on the input.
- **Text:** "Value cannot be lower than the previous reading (1245.50 kWh recorded on Apr 01)".

### 4.2 Impact Preview (Add-ons)
When negotiating a rate for a `contract_add_on`:
- **UI:** A small `Section` block showing:
  - `Base Rent: ₱8,000.00`
  - `New Add-on: + ₱500.00`
  - **Total: ₱8,500.00** (Teal Highlight)

---

## 5. Metadata Signatures
Use the **Forensic Label** token (`text-[10px] uppercase font-black tracking-widest`) for:
- Registry ID prefixes (`#APP-`, `#RDG-`).
- Reading types in tables.
- "Last Validated By" markers.

---

*Aligned to: SRS v5.2 · MASTER.md v5.0.0 · FORM_PAGES.md v1.2.0*
