# HavenStay Frontend Coding Blueprint

**Version:** 7.4.0
**Status:** Authoritative Standard
**Scope:** `frontend/src` — Next.js Application
**Aligned to:** SRS.md v5.2 · SDD.md v5.3 · DATABASE.md v5.3 · API_REFERENCE.md v5.3 · BUSINESS_RULES.md v2.3 · BACKEND_CODING_BLUEPRINT.md v6.2

---

## 1. Scope

This blueprint is the implementation contract for the HavenStay frontend. It maps the visual specs from `MASTER.md` to concrete coding rules and module patterns. Read this before starting any new page or component.

Read this file before writing any page, component, hook, or
lib module. When implementation conflicts with this document,
follow this document and flag the conflict before coding.

---

## 2. Source of Truth Hierarchy

When sources conflict, resolve in this order:

1. `docs/SRS.md` (v5.2) — Functional requirements and business rules
2. `docs/BUSINESS_RULES.md` (v2.3) — Operational constraints
3. `design-system/havenstay/MASTER.md` — Visual and UX spec
4. `docs/API_REFERENCE.md` (v5.3) — API contract (field names, shapes)
5. `backend/database/sql/havenstay_schema.sql` (v5.0) — Authoritative column names and ENUMs
6. This blueprint — Implementation patterns and quality gates

Do not invent field names, status values, or UI labels that
are not present in the above documents. Phantom fields are
a defect.

---

## 3. Stack

| Concern | Technology | Constraint |
|---|---|---|
| Framework | Next.js 16 (App Router) | Locked |
| Architecture | Modular Feature-Based App Router | Authoritative |
| Language | JavaScript | No TypeScript |
| Styling | Tailwind CSS v4 + HS-Utilities | No inline `style={}` — use `hs-*` CSS classes from `globals.css` |
| Data fetching | SWR | No raw `useEffect` for remote data |
| Animation | framer-motion | Respect `useReducedMotion` always |
| Icons | lucide-react | No other icon libraries |
| Forms | React Hook Form | Use `react-hook-form` for all transactional inputs |

frontend/
├── public/                          # Static assets (brand SVG, icons, favicons)
└── src/
    ├── app/                         # ROUTING LAYER (Pure Routes)
    │   ├── layout.js                # Root layout — Server Component
    │   ├── page.js                  # Root redirect → /dashboard
    │   ├── (auth)/                  # Auth route group
    │   ├── (dashboard)/             # Main app route group
    │   │   ├── tenants/             # page.js, [id]/page.js, new/page.js
    │   │   ├── rooms/               # ...
    │   │   ├── contracts/
    │   │   ├── billing/
    │   │   ├── payments/
    │   │   ├── utilities/
    │   │   └── admin/
    │   │       ├── reports/         # Page components (+ exports)
    │   │       ├── audit-logs/
    │   │       └── users/
    │   └── globals.css              # Global styles
    │
    ├── features/                    # DOMAIN LAYER (Business Logic & UI)
    │   ├── contracts/               # Contract-specific domain
    │   │   ├── components/          # Forms, specialized widgets
    │   │   ├── hooks/               # Domain-specific behavior
    │   │   └── services/            # Specialized API calls
    │   ├── tenants/
    │   ├── rooms/
    │   ├── billing/
    │   ├── payments/
    │   ├── utilities/
    │   └── admin/
    │       └── reports/             # Domain-specific logic
    │
    ├── components/                  # UI PRIMITIVE LAYER (Shared UI)
    │   ├── layout/                  # Navigation & Shell (AppFrame, Sidebar)
    │   └── ui/                      # Base primitives (Button, Modal, Card)
    │
    ├── context/                     # STATE LAYER (Providers)
    │   ├── AuthContext.js
    │   └── SWRConfig.js
    │
    ├── hooks/                       # GLOBAL BEHAVIOR LAYER
    │   ├── usePaginatedFilters.js
    │   └── useTableSort.js
    │
    └── lib/                         # UTILITY LAYER (Pure JS)
        ├── api.js                   # apiRequest client
        ├── auth.js                  # Role predicates
        ├── constants.js             # ENUMS and status maps
        └── formatters.js            # Standard formatters

---

## 4. Architectural Layers

### 4.1 Pages (`src/app/**/page.js`)

**Rule:** Pages are for route composition only. Keep business logic out.

- Wrap every authenticated route in `<StandardPage />`. This
  provides `useAuthGuard`, `PageHeader`, `AppMain`, and the
  skeleton loading gate in one consistent shell.
- Pages contain only: KPI rows, filter cards, tables, and
  section layout. Extract anything reused twice into a component.
- Pass `title`, `subtitle`, `breadcrumbs`, and `actions` to
  `<StandardPage />` — do not render `PageHeader` manually
  inside a page that uses `StandardPage`.
- Map every page to its FR reference before building it.


### 4.3 Hooks (`src/hooks/`)

**Responsibility:** Behavior and state orchestration.

- Use `usePaginatedFilters` for all registry list pages to
  unify search, filter, pagination, and debounce state in one
  place. Do not manage these independently with separate
  `useState` calls.
- Use `useSWR` for all remote read operations. The global
  `SWRConfig` in `_context/SWRConfig.js` sets the base
  `fetcher`, `keepPreviousData`, `revalidateOnFocus`, and
  per-category `dedupingInterval`. Override only when a page
  has a documented reason.
- SWR deduplication intervals by data category:

  | Category | Interval |
  |---|---|
  | Payments, billing, contracts, audit logs | 30 seconds |
  | Tenants, rooms, users | 60 seconds |
  | Dashboard KPIs | 5 minutes |
  | Reports | 10 minutes |

### 4.5 Lib Modules (`src/lib/`)

**Responsibility:** Single source of truth for utilities.

- **`api.js`** — All HTTP traffic passes through `apiRequest`.
  No `fetch()` calls outside this module.
- **`constants.js`** — All ENUM labels, status maps, and
  domain constants. Keys must match schema ENUM values exactly.
- **`formatters.js`** — `formatPHP`, `formatTenantDirectoryName`
  ("Last, First"), `formatDateString`, `formatTimestamp`.
  Shared helpers only; no page-specific logic here.
- **`auth.js`** — Role predicate helpers (`canManageBilling`,
  `canManageUsers`, etc.). No raw role string comparisons
  anywhere else.
- **`errors.js`** — `flattenApiErrors` for mapping 422
  validation payloads to field-level messages.
- **`pagination.js`** — `buildPaginationQuery`,
  `normalizePaginatedList`, `readStoredPerPage`. All list
  pages use these; no custom query string builders.
- **`navItems.js`** — Navigation structure. Update this when
  adding a new module to the sidebar.

### 4.6 Integrity Mandates

The following boundaries are non-negotiable for system stability and forensic consistency.

1. **The API Choke Point**: Components must never use native `fetch()` or `axios` directly. All backend communication must route through custom hooks (e.g., `useTenants()`) utilizing `src/lib/apiRequest`. This ensures Sanctum tokens and global error handlers (401/403) are applied consistently.
2. **Server vs. Client Components**: By default, Next.js pages are Server Components. Any file in `src/app/` that uses `useState`, `onClick`, or `useEffect` must explicitly include `"use client";` at the top.
3. **Formatter Sovereignty**: UI components must not contain raw numeric formatting logic. Import `formatPHP()` or `formatDate()` from `lib/formatters.js` to ensure visual parity.
4. **Context Preservation**: After closing a Side-Sheet or Modal, the underlying table row must be visually highlighted (2s fade) to maintain user orientation.
5. **Interaction Triage**: No view shall exceed **3** primary CTAs. Move secondary operations into "More" (Kebab) menus to satisfy Hick's Law.
6. **Label Sovereignty**: All user-facing labels (Table headers, Button text, Page titles) must strictly adhere to the **Canonical Labeling Dictionary** (§8 of MASTER.md). Never use raw database field names or technical jargon.

---

## 5. Mandatory Patterns

### 5.1 Registry Card Layout

Every operational surface (filter panel, list, detail section) 
uses the registry card shell. Do not invent local surfaces.

Shell:   Use `<Card>` component — applies `.hs-glass-effect` + border and shadow from `globals.css`
Header:  Add `.hs-strip-header` class (bg-stone-50/50, border-b, px-8 py-5)
Title:   Use `.hs-strip-title` — uppercase, font-black, tracking-widest (defined in globals.css)
Body:    `hs-card-body` (padding p-8) for forms and prose | `!p-0` override when a Table fills the card

Icon wells in strip headers: `h-7 w-7 rounded-lg` with a tinted
background. Form section cards use `h-8 w-8` wells.

### 5.2 Resource ID Display

Never render a bare database integer in an ID column.
Use `<ResourceIdCell />` with the correct prefix:

| Entity | Prefix |
|---|---|
| Tenant | `#TENANT-` |
| Room | `#ROOM-` |
| Bed space | `#BS-` |
| Contract | `#CONTRACT-` |
| Billing | `#BILL-` |
| Payment | `#PAY-` |
| Meter | `#METER-` |
| Utility Rate | `#RATE-` |
| User | `#USER-` |
| Audit log | `#AUDIT-` |

Typography: `font-mono text-[10px] font-bold uppercase
tracking-tighter text-stone-400 tabular-nums`.

### 5.3 Data State Handling (ResourceView)

All remote data containers must use `<ResourceView />`.
Never handle these states ad hoc inline.

| Prop | When to set | What renders |
|---|---|---|
| `isLoading` | No data, no error, fetching | Skeleton |
| `isSyncing` | SWR `isValidating` with data present | Teal progress bar (250ms grace period) |
| `isEmpty` | Data resolved, zero rows | `<EmptyState />` |
| `error` | SWR error or API rejection | `<Alert variant="error" />` |

The `isSyncing` dim opacity is `0.6` on content. Do not set
`pointer-events: none` on the content area during sync —
users must be able to read and scroll existing data.

### 5.4 Form Architecture (Command Center Paradigm)

- **Interaction Choice:** 
    - **Surgical Updates:** Use `<SideSheetOverlay />`. Slide-over maintains registry context.
    - **High-Stakes Creation:** Use `<WizardFrame />`. Multi-step focus reduces cognitive load.
    - **Glanceable Entities:** User management and Staff registries use the **Card Grid** pattern to provide visual search affordance.
- **Decommissioning:** Physical `/new` and `/edit` routes are prohibited for simple assets (Users, Meters, Rates) and minor updates (Tenant details).
- Forms with more than 4 fields inside an Overlay or Page use multiple registry cards logic.
- The entire form page or overlay content must respect the `max-w-4xl` logic where applicable.
- Action bar: `flex flex-col-reverse gap-3 sm:flex-row
  sm:justify-end pt-6`. Primary submit on the right;
  Cancel secondary.
- Server-side validation errors (422) are mapped to field-level
  messages using `applyServerFieldErrors` from `lib/forms.js`.
  All `*QuickEditForm.js` components MUST use this helper.
  Using `flattenApiErrors` directly in a form is an anti-pattern.
  Always show a page-level `<Alert variant="error" />`
  in addition to inline field errors for API failures.
- **Interaction Triage:** Every form or page header must respect the "Rule of Three" (§1.2 of MASTER.md).
- **Context Preservation:** On submission or close of a Side-Sheet, the system must trigger a `flashRow(id)` event on the parent table.
- **Viewer role:** disable or hide all write controls and show
  `<Alert variant="info" />` explaining read-only access.

### 5.5 SWR Cache Invalidation After Writes

After any successful create, update, or void operation,
call `mutate()` on the affected SWR keys to keep the
UI consistent without requiring a page refresh.

For writes that affect multiple pages (e.g., posting a payment
also updates billing status), invalidate all affected keys:

```js
// Example: after voiding a payment
await mutate(`/api/payments${qs}`);
await mutate(`/api/billing/${billingId}`);
```

### 5.6 Pagination

- All list pages use server-side pagination via
  `buildPaginationQuery` and `normalizePaginatedList`.
- `per_page` preference is stored in `localStorage` via
  `readStoredPerPage` / `writeStoredPerPage`.
- Clearing a filter chip (`onClear`, `onClearAll`) must reset
  `page` to `1` before firing the new SWR key.
- Client-side sort only sorts the current page — document this
  limitation in the page component where it applies. Never
  imply a full-dataset sort to the user.

### 5.7 Currency and Numeric Display

- All monetary values: `formatPHP()` from `lib/formatters.js`.
- Currency in table cells: use `<CurrencyCell />` for
  consistent mono tabular-nums typography.
- Never use `toFixed()` or `toLocaleString()` directly in a
  component. Route through `formatPHP`.
- Negative balances (overpayments/credits) display as a
  positive value with a **Credit** badge — not as a red
  negative number.

### 5.8 Status Badges

Use `<StatusBadge />` for every status value. Never hardcode
badge colors inline. The mapping from schema ENUM → badge
variant lives in `StatusBadge.js`.

active, paid, available, vacant   → badge-success (emerald) + **pulse**
unpaid, pending_payment, maintenance,
pending_sync                         → badge-warning (amber) + **pulse** (if pending sync)
partial                              → badge-info (sky)
overdue, terminated, voided,
unavailable                          → badge-danger (red)
completed, moved_out, archived,
replaced                             → badge-neutral (stone)
occupied                             → badge-info (teal)

**Motion Rule:** The `pulse` variant must be applied to `active` and `pending_sync` statuses to communicate live system synchronization.

### 5.9 Destructive Actions

Void, archive, and termination actions always require a
confirmation modal. Use `<ConfirmModal />` with:
- A descriptive title stating the consequence
- Secondary cancel button
- `danger` variant primary confirm button

Lifecycle transitions (deactivate, reactivate, archive,
restore) use `<LifecycleActions />`. Do not fork local
lifecycle button groups per page.

### 5.10 Meter and Utility Modules (New in v2.0)

Pages for meters, meter readings, utility rates, and the
billing wizard follow these additional rules:

- **Meter readings list:** Display `reading_value` with 2
  decimal places. Show the meter serial number and utility
  type as secondary identifiers. Link each reading to its
  source meter detail page.
- **Recording Readings:** The reading entry form (`/utilities/meters/[id]/readings/new` or the SideSheet) **must** include an explicit "Dial Rollover / Reset" toggle (`is_rollover`). This is a mandatory payload parameter for the backend to bypass monotonicity rejections (BR-MET-005).
- **Utility charge preview (`POST /api/billing/forecast`):**
  Present the calculated charge as a reference amount in a
  read-only `<CurrencyCell />`. Allow override with a text
  input. If the staff member overrides, a `reason` field
  becomes required before submission.
- **Rate policy list:** Always show `effective_from` in the
  table alongside `base_rate`. The currently active rate
  (effective from the most recent past date) must be
  visually distinguished — use a `StatusBadge` variant
  `badge-success` labeled "Active" on that row.
- **Meter assignment history:** Show as a timeline list
  (room code + effective-from date), newest first.
- **Shared Room Apportionment (BR-MET-010):** The utility billing preview **must** explicitly show the "Roommate Split" calculation. For shared rooms, display the unbilled reading total alongside the number of active roommates and the resulting per-tenant charge before finalizing the bill.
- **Deposit Clearance Indicator:** Contract profiles and Side-Sheets must display `is_cleared` as an emerald `<StatusBadge>cleared</StatusBadge>` when settled. Completed contracts without clearance show an amber warning (BR-PAY-010).


### 5.11 Forensic Tracing & Correlation

The following rules ensure "DNA-level" traceability across all transactional interfaces:

1. **Correlation Visibility:** Every registry table row (Tenants, Contracts, Billing, Payments) **must** display the `correlation_id` if present. Use the `CorrelationIdCell` chip with a copy-to-clipboard shortcut.
2. **Forensic Inspection:** The "Audit Log" inspector must be the sole source of truth for change history. The UI must enable tracking related entries via `correlation_id` to visualize the full scope of an administrative workflow.
3. **Triggered Legibility:** When viewing audit payloads (JSON Diff), map the machine-friendly table names to human-readable labels using `formatAuditEntityOrResource` from `lib/constants.js`.

### 5.12 Contract Lifecycle Hardening (BR-CON-011, BR-BIL-002)

1. **Contiguous Renewals:** The check-in and renewal forms must support contiguous dates. A tenant moving out on `2026-04-20` and renewing starting `2026-04-21` is valid and must not trigger an overlap error.
2. **Duplicate Billing Prevention:** Manual billing creation forms must validate against existence of billing records for the same contract and period *before* submission to prevent duplicate ledger entries.
3. **Room Type Sovereignty:** All room and contract displays must use the centralized `RoomType` enums. Legacy string references like `'solo'` are prohibited; use `ROOM_TYPE_LABELS` from `lib/constants.js`. Only `private` and `shared` are valid schema values.

#### 5.12.1 Field Immutability Matrix

Frontend forms must enforce the following lockdown rules based on contract status to satisfy BR-CON-005 and BR-CON-010:

| Status | Editable | Immutable |
| :--- | :--- | :--- |
| `pending_payment` | `monthly_rate`, `monthly_rate_override`, `deposit_amount`, `expected_move_out`, `notes` | `tenant_id`, `bed_space_id`, `move_in_date` |
| `active` | `expected_move_out`, `notes` | All financial terms (Rate, Deposit, IDs, Move-in Date) |
| `completed` / `terminated` / `voided` | `notes` | Everything else |

### 5.13 Table Expandability (Progressive Disclosure)

Registry tables must implement the **Expandable Row** pattern for secondary data:
1. **Trigger:** Use `<RowOpenIndicator />` (chevron) in the first column or far-right action well.
2. **Expansion:** Use `AnimatePresence` and `motion.div` to animate height from `0` to `auto`.
3. **Density:** Keep expanded content focused (e.g., viewing bill line items, or contract notes) to avoid visual noise.

### 5.14 Persona-Based Routing & Dashboards

To satisfy **HCI Focus: Cognitive Load Reduction**, dashboards and navigation are strictly tailored to the user's role:

| Persona | Primary Focus | Key UI Pattern |
| :--- | :--- | :--- |
| **Admin** | Financial Health & Security | Forensic Audit Pulse + Aggregated KPIs |
| **Staff** | Daily Operations & Tasks | "Jobs-to-be-Done" Grid + Expiry Alerts |
| **Viewer** | Directory Search | Read-only Table Lists (No Dashboard) |

- **Rule:** A `Staff` user must not see `Admin` metrics (e.g., system-wide profit/loss) to prevent information overload.
- **Implementation:** Use role predicates from `lib/auth.js` in the `Dashboard` component to switch sub-modules.

### 5.15 Latency Compensation (Optimistic UI)

To maintain a "Premium" feel, the system should feel instantaneous where safe:

- **Optimistic Updates:** Use SWR `optimisticData` for non-financial status toggles (e.g., deactivating a meter, updating a tenant's phone number).
- **Blocking Loaders:** Financial commits (Payment record, Contract creation, Billing generation) must use **Blocking Loading States** (Spinners/Skeletons) to ensure data integrity and prevent double-submission.

---

## 6. Role-Based Access Rules

Enforce access via `lib/auth.js` predicates only.
Never compare `user.role` directly in page or component code.

| Predicate | Admin | Staff | Viewer |
|---|---|---|---|
| `canManageUsers` | ✓ | — | — |
| `canViewAuditLogs` | ✓ | — | — |
| `canManageBilling` | ✓ | ✓ | — |
| `canViewBilling` | ✓ | ✓ | ✓ |
| `canManageTenants` | ✓ | ✓ | — |
| `canManageMeters` | ✓ | ✓ | — |
| `canManageContracts` | ✓ | ✓ | — |
| `canViewReports` | ✓ | — | — |

For any page a Viewer can access in read-only mode:
- Hide all CTA buttons (Register, Update, Void, Generate)
- Show `<Alert variant="info" />` once at the top explaining
  read-only access
- Show `<Alert variant="warning" title="Access Denied" />` for restricted forensic surfaces (Audit Logs).
- Do not show empty action columns in tables

---

## 7. Required Checks per Module

Before marking any frontend module complete, verify all of:

**Data integrity**
- [ ] All displayed field names match `db/havenstay_schema.sql`
      column names or `API_REFERENCE.md` response shapes.
      No phantom fields.
- [ ] All status values come from `lib/constants.js` ENUM maps.
- [ ] Monetary values use `formatPHP`. IDs use `ResourceIdCell`.

**Role enforcement**
- [ ] Write controls hidden/disabled for Viewer role.
- [ ] Admin-only pages return 403 + `<Alert>` for Staff/Viewer.
- [ ] Auth guard prevents flash of unauthorized content.

**Data states**
- [ ] `isLoading` shows skeleton (not blank page).
- [ ] `isSyncing` shows progress bar without disabling content.
- [ ] `isEmpty` shows `<EmptyState />` with guidance copy.
- [ ] API errors surface via `<Alert variant="error" />`.

**Pagination and filters**
- [ ] Filter chip clear resets page to 1.
- [ ] `per_page` is read from and written to localStorage.
- [ ] SWR key changes on every filter/page state change.

**After writes**
- [ ] `mutate()` called on affected SWR keys after success.
- [ ] Success state shows confirmation (toast or page message).
- [ ] Error state shows field-level errors + page-level Alert.

**Traceability**
- [ ] Page maps to at least one `FR-*` in SRS.
- [ ] Acceptance criteria from `TEST_PLAN.md` are satisfied.

---

## 8. PR Review Gate

A frontend PR is merge-ready only when all items below pass:

- [ ] Page uses `<StandardPage />` with correct title/subtitle
      from MASTER §21.
- [ ] Remote data uses `useSWR` + `apiRequest`. No raw fetch.
- [ ] Tenant names use `formatTenantDirectoryName` ("Last, First").
- [ ] IDs use `<ResourceIdCell />` with correct prefix.
- [ ] Write actions gated by `lib/auth.js` predicates.
- [ ] Currency uses `formatPHP` or `<CurrencyCell />`.
- [ ] Status values use `<StatusBadge />`. No hardcoded colors.
- [ ] No `user.role === '...'` string comparisons in components.
- [ ] No magic label strings — all from `lib/constants.js`.
- [ ] No `style={}` inline styles (except `framer-motion` props).
- [ ] `ResourceView` wraps all remote data containers.
- [ ] Destructive actions use confirmation modal.
- [ ] Relevant `TC-*` from `TEST_PLAN.md` verified.

---

## 9. Anti-Patterns (Immediate Rejection)

| Anti-pattern | Correct approach |
|---|---|
| `user.role === 'admin'` in a component | Use `lib/auth.js` predicate |
| Hardcoded `"Active"` or `"Paid"` label | Use `TENANT_STATUS_LABELS.active` etc. from `lib/constants.js` |
| `style={{ color: 'red' }}` | Use `<Alert variant="error" />` or status badge |
| `fetch('/api/...')` directly | Use `apiRequest` from `lib/api.js` |
| `useEffect` for remote data | Use `useSWR` |
| Bare integer in ID column | Use `<ResourceIdCell prefix="#TENANT-" id={t.tenant_id} />` |
| `amount.toFixed(2)` in JSX | Use `formatPHP(amount)` |
| Manual pagination query string | Use `buildPaginationQuery` from `lib/pagination.js` |
| Flash of unauthorized content | Ensure `StandardPage` loading gate is active |
| Inline empty state div | Use `<EmptyState />` |
| Standalone /edit pages for simple assets | Use `<SideSheetOverlay />` |
| Manual creation routes for simple assets | Use Side-Sheet / Modal on registry page |
| Standalone /edit pages for minor updates | Use `<SideSheetOverlay />` on detail/registry |
| Magic strings for form steps | Use `<WizardFrame />` steps and components |
| Fixed height modas for data entry | Use context-aware Side-Sheets |
| Local lifecycle button group | Use `<LifecycleActions />` |
| Spinner for page-level loading | Use `SkeletonListPage` or `SkeletonDetailPage` |
| `pointer-events: none` during sync | Drop it — dim content only |
| `flattenApiErrors(err)` in a form | Use `applyServerFieldErrors` for field mapping |
| Manual room status override | Remove status dropdown; status is maintained automatically |
| **Action Overload** | Header with >3 primary CTAs; move to "More" menu |
| **Excessive Whitespace** | Using `p-20` on tables; stick to registry standard `p-8` / `px-6` |
| **Inconsistent Labeling** | Mixing "Resident" and "Tenant" or using "Submit" instead of "Save Changes" |
| **Technical Jargon** | Showing "Correlation ID" or "Status Enum" directly to users |
| **Silent Failures** | Mutation without user feedback or SWR invalidation |

---

## 10. File Header & Traceability

Every page-level `page.js` needs a JSDoc block at the top. This connects the code to the actual requirements in the SRS and ensures we know why the file exists.

### 10.1 Standard Header Template

```js
/**
 * @module Billing/Registry
 * @description Central ledger for billing cycles and utility splits.
 * @version 4.8.0
 * 
 * @traceability
 * - Requirements: FR-032, FR-035, FR-038
 * - Business Rules: BR-BIL-001, BR-BIL-002
 * - Forensic: Audit Log
 * 
 * @performance
 * - Category: Financial (30s cache)
 * - Pattern: SWR Paginated
 */
```

### 10.2 Field Reference
1. **@module**: The path to the feature (e.g., `Admin/AuditLogs`).
2. **@description**: What this page actually does for the user.
3. **@traceability**: The specific FR/BR codes from the docs.
4. **@performance**: The SWR refresh category from §4.3.

---

## 11. Output Format for Agent Responses

When an AI agent implements or modifies a frontend module,
the response must follow this structure:

**1. Requirement Mapping**
- FR: [list]
- BR: [list]
- TC: [list]

**2. Changes Made**
- Files created or modified
- Key component and hook decisions
- Any new `constants.js` entries or `lib/` additions

**3. Validation**
- Roles tested (Admin, Staff, Viewer paths)
- Data states tested (loading, syncing, empty, error)
- Filter/pagination behavior verified
- Write + invalidation flow verified

**4. Evidence**
- Which `TEST_PLAN.md` acceptance criteria are satisfied
- Any schema field or ENUM used — confirmed against
  `havenstay_schema.sql`

**5. Residual Risks**
- Open issues, untested paths, follow-up tasks

---

## 12. Revision History

| Version | Date | Summary |
|---|---|—|
| v1.0 | 2026-03 | Initial frontend blueprint |
| v1.1 | 2026-04 | Synced with operational design system |
| v2.0 | 2026-04 | Full structural rewrite. Aligned to SDD format. |
| **v3.0** | **2026-04-19** | **3NF Normalization Sync.** Hardened for 16-table backend. Aligned to SRS v3.4 and BR v1.6. |
| **v3.1** | **2026-04-19** | **Architectural Lockdown.** Mandated directory structure, enforced API Choke Point (§4.5), codified Server/Client component boundaries. |
| **v3.2** | **2026-04-19** | **Structure Correction.** Aligned directory structure with actual Next.js App Router patterns. |
| v3.3 | 2026-04-19 | Forensic Route Mapping. Grounded Directory Structure in SRS/BR requirements. |
| v4.0 | 2026-04-20 | Transaction Log Retirement. Removed TX log references. Consolidated forensics under Audit Logs. |
| **v4.5** | **2026-04-20** | **Forensic Hardening Pass.** Codified Correlation ID tracing (§5.11), shared-room apportionment UI (§5.10), and contiguous renewal logic (§5.12). Synced with v4.8 Database Engine. |
| **v4.6** | **2026-04-20** | **Forensic Normalization Pass.** Synced StatusBadge logic and Resource ID prefixes. Fixed stale file paths and removed deprecated Add-on Registry route tree. |
| **v7.0.0** | **2026-04-21** | **Command Center Paradigm.** Decommissioned legacy `/new` and `/edit` folders. Mandated `SideSheetOverlay` and `WizardFrame` as the authoritative interaction model. |
| **v7.1.0** | **2026-04-21** | **Forensic Form Hardening.** Codified field immutability matrix (§5.12.1). Mandated `applyServerFieldErrors`. Added Deposit Clearance and Void workflow rules. |
| **v7.2.0** | **2026-04-23** | **Strategic HCI Integration.** Institutionalized Hick's Law (Rule of 3), Persona-driven dashboards (§5.14), Optimistic UI guidance (§5.15), Context Preservation mandates (§4.6). |
| **v7.3.0** | **2026-04-23** | **Label Sovereignty Pass.** Enforced the Canonical Labeling Dictionary across all routes. Purged technical jargon and standardized action-oriented verbs. |
| **v7.4.0** | **2026-05-02** | **Docs Remediation Pass.** Confirmed styling framework as Tailwind CSS v4. Updated source-of-truth hierarchy versions (SRS v5.2, BR v2.3). Fixed BR-MET-011 → BR-MET-010 reference in §5.10. Confirmed Next.js 16.x version. Sorted revision history chronologically. |