# HavenStay Test Readiness Reference (v2.1)

This document serves as the canonical mapping between the **documentation** and the **frontend implementation**. Use this to configure TestSprite's navigation and verification steps.

## 1. Primary Navigation (Sidebar)

TestSprite should look for these labels in the Sidebar (`nav` element):

| Document Label | UI Label | Target Route |
| :--- | :--- | :--- |
| Dashboard | **Dashboard** | `/dashboard` |
| Tenants | **Tenants** | `/tenants` |
| Rooms | **Rooms** | `/rooms` |
| Contracts | **Contracts** | `/contracts` |
| Billing | **Billing** | `/billing` |
| Payments | **Payments** | `/payments` |
| Reports | **Reports** | `/reports` |
| User Management | **Users** | `/users` |
| Audit Logs | **Audit Logs** | `/audit-logs` |
| Transaction Logs | **Transaction Logs** | `/transaction-logs` |

## 2. Report Registry (`/reports`)

When navigating the report hub, use these card titles/links:

| Report Name | UI Card Label | Frontend Path | API Endpoint |
| :--- | :--- | :--- | :--- |
| Occupancy | **Occupancy** | `/reports/occupancy` | `/api/reports/occupancy` |
| Billing Summary | **Billing summary** | `/reports/billing-summary` | `/api/reports/billing-summary` |
| Outstanding Balances | **Outstanding balances** | `/reports/outstanding-balances` | `/api/reports/outstanding-balances` |
| Collections Performance | **Collections performance** | `/reports/collections` | `/api/reports/collections-performance` |
| Tenant Ledger | **Tenant ledger** | `/reports/tenant-ledger` | `/api/reports/tenant-ledger` |
| Tenant History | **Tenant history** | `/reports/tenant-history` | `/api/reports/tenant-history` |

## 3. High-Priority Search & Filter Targets

The UI has been standardized to the following patterns for test assertions:

- **Registry Search**: Look for the `Input` with placeholder text matching `Search...`, `Tenant name...`, or `Room code...`.
- **Primary Actions**:
  - Tenants: `Register Tenant`
  - Rooms: `Create Room`
  - Billing: `Create Billing Entry`
  - Payments: `Receive Payment`
- **Breadcrumbs**: Use Title Case (e.g., `Tenant Registry`, `Room Details`).
- **KPI Cards**: Titles are in bold sans-serif, monetary amounts use `tabular-nums`.

## 4. Role-Based Access Scenarios

- **Admin**: Has access to all Sidebar items and Report hub. Total 10 nav items.
- **Staff**: No `/users` access. Total 9 nav items.
- **Viewer**: Read-only access. Registration buttons (e.g., `Register Tenant`) should NOT be rendered.

## 5. API Response Expectations

Frontend components expect the following standard response formats:
- **Lists**: Array of objects or `{ data: [], meta: {} }`.
- **Errors**: `422 Unprocessable Content` with `{ message: "...", errors: { field: ["error"] } }`.
- **Audit Logs**: Expect `old_values_json` and `new_values_json` fields.

## 6. Admin-only pages (Viewer / Staff assertions)

When a **Viewer** (or **Staff** where applicable) opens a route they cannot use, the page must render a warning `Alert` (not a blank screen). Copy includes the sentence:

**`You do not have permission to view this page.`**

| Route | `data-testid` (optional) |
| :--- | :--- |
| `/users` | `access-denied-users` |
| `/audit-logs` | `access-denied-audit-logs` |
| `/transaction-logs` | `access-denied-transaction-logs` |

## 7. Billing create form (`/billing/new`)

- Contract list is loaded from `GET /api/contracts?status=active` only.
- When at least one active contract exists, the **first contract is pre-selected** in the dropdown so automated runs do not submit with an empty `contract_id`.
- If there are **no** active contracts, the page shows **No active contracts** and a link to `/contracts`.

## 8. Extended test matrix (TC016+)

Use **`npm run build && npm run start`** for TestSprite with **`serverMode: production`** (up to ~30 high-priority cases). Dev mode caps at ~15.

### 8.1 Reports & exports

| ID | Case | Edge / assertion |
| :--- | :--- | :--- |
| TC016 | Viewer `/reports` hub | Each report card links to its path; no create buttons on report pages. |
| TC020 | CSV export | Trigger export on occupancy or billing-summary; expect 200 or file download. |
| TC023 | Report date filters | Apply start/end on billing-summary or receivables; table or empty state updates. |
| TC024 | Tenant ledger | Select tenant from dropdown; table loads or empty state (no crash). |

### 8.2 Auth & session edge cases

| ID | Case | Edge / assertion |
| :--- | :--- | :--- |
| TC025 | Bad password | Wrong password shows error alert; stays on `/login`. |
| TC026 | Logged-in visit `/login` | Redirects toward `/dashboard` when token present. |
| TC027 | Deep link without token | `/contracts` redirects to `/login`. |

### 8.3 RBAC regression (previously flaky)

| ID | Case | Edge / assertion |
| :--- | :--- | :--- |
| **TC003** | **Viewer** `/users` + `/audit-logs` | After login as **viewer** / **HavenStay123!**, open `/users` — visible text includes **`You do not have permission to view this page.`** Optional: `[data-testid="access-denied-users"]`. Repeat for `/audit-logs` (`access-denied-audit-logs`). |
| TC017 | **Staff** `/users` | Login **staff** / **HavenStay123!**, navigate `/users` — same denial copy (Staff is not admin). |

### 8.4 Financial & contract edge cases

| ID | Case | Edge / assertion |
| :--- | :--- | :--- |
| **TC011** | **Billing create** | Login **staff**, `/billing/new` — contract dropdown must have a **pre-selected active** contract; submit period + base rent > 0; success or clear validation message (not “empty contract”). |
| TC018 | Payment void | Staff opens a payment detail → void → confirm modal; list reflects void. |
| TC028 | Billing with no active contracts | If DB has zero active contracts, `/billing/new` shows **No active contracts** + link to `/contracts`. |
| TC029 | Payment amount validation | Attempt payment ≤ 0 or exceeds balance; UI shows error (422 surfaced). |

### 8.5 Registry & navigation

| ID | Case | Edge / assertion |
| :--- | :--- | :--- |
| TC021 | Tenant deactivate/reactivate | From tenant detail or list; status badge updates. |
| TC022 | Keyboard help | Open shortcuts modal; **Escape** closes (desktop). |
| TC030 | Breadcrumb back | From a detail page, breadcrumb or back returns to list without losing session. |
| TC031 | Rooms search / filter | Filter or search rooms list; no full-page error. |

### 8.6 Admin-only tooling

| ID | Case | Edge / assertion |
| :--- | :--- | :--- |
| TC032 | Admin **Users** list loads | **admin** user; `/users` shows registry (not access denied). |
| TC033 | Audit log filters | Admin applies entity/action filter; table or empty state. |

---
*Verified & Synchronized: 2026-04-11 · v2.1*
