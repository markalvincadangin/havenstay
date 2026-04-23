## Design System — Master Specification — v8.0.0

> **What this document is:** This is the standard for how HavenStay looks and behaves. It implements the user-facing intent of **[docs/SRS.md](../../docs/SRS.md)** (v4.5) and is synchronized with **havenstay_schema.sql v4.8** (44-trigger forensic engine).

---

### Design goals (aligned with SRS §2 and SDD §2)

| Source | Intent for the UI |
| :--- | :--- |
| **SRS 2.1** | One coherent system instead of fragmented records — screens must make **relationships obvious** (tenant → bed space → contract → billing → payment → meter → utility rate). |
| **SRS 2.2–2.3** | Support **Admin**, **Staff**, and **Viewer** with clear **role affordances** (write vs read-only). Role gates are non-negotiable. |
| **SDD §2** | Protect **data integrity** in presentation — correct labels, schema ENUMs, no phantom fields, no invented column names. |
| **SRS 3.1** | **Responsive** web UI, sidebar + role-aware nav, design-system components, mobile drawer — layout rules in §20 implement this. |
| **Tone** | **Simple and direct** — use common terms like **tenant**, **room**, **bill**, and **payment**. Avoid tech jargon or marketing fluff. |

**Implementation:** `frontend/src/app/globals.css` (CSS variables and utility classes), `frontend/src/app/layout.js` (fonts), UI modules in §19 (`frontend/src/app/_components/ui/`).

**Reuse rule:** Prefer **documented primitives** over one-off Tailwind strings so spacing, type, and color stay aligned across modules. If a pattern repeats 3+ times outside one file, extract it.

---

## 1. Design direction

| Axis | Guidance |
| :--- | :--- |
| **Aesthetic** | **Structured operations UI** — warm neutrals (stone), teal primary for trust and action, restrained depth; professional small-business tool, not consumer entertainment. |
| **Density** | **Registry** list pages: scannable tables and filters. **Forms**: breathable `p-8` sections to reduce entry errors. **Meter/utility pages**: same registry density; numeric precision required. |
| **Motion** | List/hub: optional `framer-motion` for smooth enters. Forms: snappy and direct. Always honor `useReducedMotion`. |
| **Responsiveness** | Mobile-first stacks; tables always `overflow-x-auto`; sidebar / drawer per SRS §3.1 and `AppFrame` (§20). Floating surfaces must use **Viewport Guard** (§20.1). |
| **Integrity** | **Forensic Anchors** — high-stakes views (Side-Sheets, Details) must lead with a non-editable record identity to preserve context during modification. |

### 1.1 Human-Centric Operational Language (HCOL)

To satisfy **HCI Focus: Mental Models**, all user-facing copy must prioritize "Staff Reality" over "Database Logic." UI strings are not raw reflections of schema names.

| Database/Technical Jargon | Humanized Operational Term | Rationale |
| :--- | :--- | :--- |
| **Administrative Termination** | **Early Move-Out** | Focuses on the physical event, not the legal act. |
| **Rental Obligation** | **Monthly Rent** | Common industry term; reduces cognitive load. |
| **Bed Space** | **Bed** | Brief and intuitive; "space" is redundant. |
| **Asset / Resource** | **Room** or **Meter** | Concrete objects are easier to identify than abstractions. |
| **Inception Date** | **Start Date** | Simpler, active language. |
| **Expiration Date** | **End Date** | Pairs naturally with "Start Date." |
| **Transaction Sequence** | **Payment History** | Descriptive and predictable. |
| **Arrears / Delinquency** | **Overdue Balance** | Clear status without the "judgmental" tone of delinquency. |
| **Outstanding Balance** | **Remaining Balance** | "Remaining" implies progress toward completion. |
| **Dial Rollover** | **Meter Reset** | Describes the physical event for staff. |
| **Audit Payload** | **Change Details** | Avoids tech-heavy "payload" term. |
| **Correlation ID** | **Workflow ID** | Links the ID to the user's action (the workflow). |

- **Consistency Rule:** Once a term is humanized, it must be used identically in the Page Title, Subtitle, Table Headers, and Form Labels.
- **Tone:** Practical, trustworthy, and clear. Avoid marketing fluff or developer-centric terms like "Fetch," "Payload," or "Execute."

### 1.2 Interaction Hierarchy (Hick's Law & Interaction Triage)

To minimize cognitive load and decision paralysis, every view must follow the **Rule of Three**:
- **Primary Actions:** Maximum of **3** primary CTAs (Teal buttons) per viewport context.
- **Secondary Actions:** Move all other operations into a "More" (Kebab) menu or onto the context-preserving Side-Sheet.
- **Job-to-be-Done Focus:** If an action doesn't support the primary task of the screen (e.g., "Manage Billing" while on a "Tenant Profile"), it must be secondary.

### 1.3 Visual Search & Anchors (Recognition over Recall)

In high-density registry tables, users must be able to scan and identify records instantly:
- **Anchor Column:** The first column (Tenant Name or Room Code) acts as the primary anchor. It must be high-contrast and bold.
- **Status Scanning:** Use `StatusBadge` colors as functional signals, not decoration. Red/Amber must immediately draw attention to "Action Required" states (Overdue, Maintenance).
- **Forensic Gutter:** Group metadata (ID, Correlation ID) in a secondary typography style (`text-stone-400 font-mono`) to visually separate "Operational Data" from "Audit Data."

---

## 2. Color, theme and tokens

Palette aligns with **Tailwind stone** + **teal** and `**:root` variables in `globals.css`. Prefer **semantic tokens** in primitives (`Button`, `Field`, `Input`); use **stone/teal utility classes** on registry cards, `PageHeader`, and the `Table` shell where the spec calls for explicit contrast.

### 2.1 CSS variables (source of truth)

**Note:** v7.0 introduces full Dark Mode support via `next-themes` and CSS variables. Variables define the explicit light/dark map without relying purely on Tailwind `dark:` variants.

| Token | Variable | Typical use |
| :--- | :--- | :--- |
| Page backdrop | `--color-background` | `body`, `AppMain` (Light: `#FAFAF9`, Dark: `#1C1917`) |
| Surface | `--color-surface` | Cards (Light: `white`, Dark: `#292524`) |
| Surface Floating | `--color-surface-floating` | Modals, Side-Sheets (Light: `rgba(255,255,255,0.7)`, Dark: `rgba(28,25,23,0.8)`) |
| Primary | `--color-primary` | CTAs, focus rings, chips (#0D9488) |
| Primary hover | `--color-primary-dark` | Hover / active |
| Text | `--color-text` | Body, labels |
| Muted text | `--color-text-secondary` | Help, captions |
| Border | `--color-border`, `--color-border-strong` | Inputs, cards |
| Sidebar | `--color-sidebar` | Navigation chrome |
| Danger copy | `--color-danger` | Errors, destructive hints |

### 2.2 Utility-level tokens (registry and primary surfaces)

- **Backdrop:** `stone-50` / `bg-[var(--color-background)]` (Supports dark inversion).
- **Glassmorphism (Floating):** Side-Sheets, Modals, and Sticky headers use `backdrop-blur-md bg-[var(--color-surface-floating)]` to establish deep Z-index hierarchy and spatial context without breaking connection to the table beneath.
- **Structural border:** `stone-200` (Dark: `stone-700`).
- **Soft divider:** `stone-100` (Dark: `stone-800`).
- **Primary action:** `teal-600` / `bg-teal-600` (match `--color-primary` family).
- **Danger action:** `red-600` / rose palette for alerts (see `Alert` variants).
- **Shadows:** `shadow-sm` default elevation; `shadow-lg shadow-teal-900/10` **only** on the **single** primary registry CTA per page row
- **Radius scale:** `rounded-2xl` — registry cards and `Table` outer shell · `rounded-xl` — buttons, inputs, small panels · `rounded-lg` — icon wells, inline chips

### 2.3 Logo and branding

**Format:** SVG only. All identity assets must be SVG for resolution independence.

**Source location:** `frontend/public/brand/`

| Asset | File path | Usage context |
| :--- | :--- | :--- |
| **Inverted Logo** | `/brand/logo-light.svg` | Primary for `Sidebar` (`bg-slate-900`) and dark backgrounds. |
| **Full/Dark Logo** | `/brand/logo-dark.svg` | Auth routes (white/stone backgrounds) and light surfaces. |
| **Favicon** | `/brand/favicon.svg` | Browser tab icon / metadata. |

**Implementation:** Next.js `Image` component. Sidebar brand well: `width={24} height={24}` (square glyph) or as defined by the parent flex container.

---

## 3. Typography

**Loaded fonts** (`layout.js`): **Plus Jakarta Sans** (headings), **DM Sans** (UI/body via `--font-sans`), **DM Mono** (amounts, IDs, codes, meter readings, rates).

| Role | Font | Classes / rule |
| :--- | :--- | :--- |
| **Page title** (`PageHeader` H1) | Plus Jakarta | **`hs-page-title`** — `font-black`, `tracking-tight`; includes word-spacing so multi-word titles do not look cramped. |
| **Subtitle** (under H1) | DM Sans | `text-sm font-medium leading-relaxed text-stone-500` + **`hs-page-subtitle`** (word-spacing). |
| **Card / strip titles** (registry) | Plus Jakarta | **`hs-strip-title`** (`font-black`) + **All Caps** copy (see §3.1). |
| **Field labels** | DM Sans | `text-sm font-medium`. |
| **Table column headers** | DM Sans | `text-[10px] font-black uppercase tracking-widest text-stone-400`. |
| **Compact strip labels** (filters) | DM Sans | Same 10px bold uppercase; optional `tracking-[0.2em]` only on narrow strips. |
| **Breadcrumb row** | DM Sans | `text-[10px] font-bold uppercase tracking-wide` + `[word-spacing:0.12em]`. |
| **Registry / mono IDs** | DM Mono | `font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400` — see §3.2 for full prefix list. |
| **Money and numeric columns** | DM Mono | `font-mono tabular-nums`. |
| **Forensic / metadata labels** | DM Sans | `text-[10px] font-black uppercase tracking-widest text-stone-400` — used for meter reading types, utility categories, audit metadata, and timestamp secondary rows. |
| **Search UI** | DM Sans + Icons | `Input` with `icon={Search}` — group-focus teal coloration on primary search wells. |
| **Empty state copy** | DM Sans | `text-sm font-bold text-stone-900` (title) + `text-xs text-stone-500` (guidance). |
| **Immutability Signifier** | DM Sans | `text-stone-400 italic font-medium` — used for fields that are locked due to business rules (e.g., Move-in date on active contracts). |

### 3.1 Heading casing and optical spacing

- **Registry card strip titles:** Must use **All Caps** with the `uppercase` utility and `hs-strip-title` class. This distinguishes management sections from page-level content (e.g., `FILTERS`, `BASIC INFORMATION`, `LEASE TERMS`, `UTILITY SYNC`).
- **Page titles (H1):** Title case with standardised word spacing via `.hs-page-title`.
- **Implementation:** Spacing and tracking are defined in `frontend/src/app/globals.css`.

### 3.2 Registry ID prefix vocabulary (canonical)

Every entity ID displayed in a table or detail view must use the mono prefix form. Never render a bare integer in an ID column.

| Entity | Prefix | Schema PK |
| :--- | :--- | :--- |
| Tenant | `#TENANT-{id}` | `tenants.tenant_id` |
| Room | `#ROOM-{id}` | `rooms.room_id` |
| Bed Space | `#BS-{id}` | `bed_spaces.bed_space_id` |
| Contract | `#CONTRACT-{id}` | `contracts.contract_id` |
| Billing | `#BILL-{id}` | `billing.billing_id` |
| Payment | `#PAY-{id}` | `payments.payment_id` |
| User | `#USER-{id}` | `users.user_id` |
| Audit Log | `#AUDIT-{id}` | `audit_logs.id` |
| Meter | `#METER-{id}` | `meters.meter_id` |
| Utility Rate | `#RATE-{id}` | `utility_rates.rate_id` |

---

## 4. Layout and spacing

### 4.1 Page shell

- **`AppMain`** (`ui/AppShell.js`): `max-w-7xl` content column, vertical `gap-8`, responsive padding `px-4 py-8` → `sm:px-6 sm:py-10` → `lg:px-8 lg:py-12`.
- **Authenticated chrome:** `AppFrame` + `Sidebar` + `MobileNav`; max width cap `max-w-[1600px] mx-auto` on the shell wrapper.
- **Auth routes** (`(auth)/login`): full bleed content; brand colors + typography, no `AppShell`.

### 4.2 Page header (`PageHeader`)

Every authenticated module page opens with:

1. **Breadcrumbs** (optional) — hierarchy; last crumb = current area name.
2. **Title + subtitle** — one clear H1; subtitle explains what this screen is for in boarding-house terms (see §21 for canonical values per route).
3. **Actions** — `flex flex-wrap justify-end gap-3`: **at most one** primary teal CTA per header row; secondary actions; `UserRoleBadge` on registry-style pages.

**Back control:** Detail and new/edit flows must expose an `h-11 w-11` rounded-xl **back** control in the header `actions` slot (link to parent registry or record).

### 4.3 Content grids

| Pattern | Use |
| :--- | :--- |
| **KPI row** | 1 col mobile → 2–4 cols `md:+` for occupancy, collections, pending, meter coverage. |
| **Hub** | 2–4 column responsive grid of short-links / summary cards. |
| **Split hub (detail)** | `lg:grid-cols-12`: sidebar **4** cols (summary), main **8** cols (cards, embedded tables). |
| **Forms** | `mx-auto w-full max-w-4xl` column — includes `PageHeader`, alerts, cards, and action bar (§12). |

### 4.4 Horizontal rhythm

- **Registry card header strip:** `px-8 py-5`.
- **Filter toolbar inside card:** `px-6` (aligns with table `px-6` cells).
- **Do not** invent `px-5` / `px-7` for main structural rows — stick to the `6 / 8` system.

---

## 5. UI components (spec and reuse rules)

**Rule:** New screens must compose from this file catalog (§19). If a pattern repeats 3+ times across unrelated pages, extract a shared primitive. Never duplicate long Tailwind strings across files.

### 5.1 Registry card (primary surface pattern)

The primary white surface for filters, tables, and grouped detail on operational pages.

- **Shell:** `bg-white border border-stone-200 rounded-2xl shadow-sm`
- **Header strip:** `border-b border-stone-100 bg-stone-50/50 px-8 py-5` + optional icon in `h-7 w-7 rounded-lg` tinted well + **`hs-strip-title`** (All Caps, font-black — §3.1)
- **Body:** `p-8` for prose/forms · `p-0` when a `Table` fills the card

**Implementation:** Use `Card` with `className` overrides, e.g., `className="!p-0 border-stone-200 shadow-sm overflow-hidden"` + header strip div inside.

### 5.2 `Card` primitive (`ui/Card.js`)

- Default: `rounded-xl`, `p-6`, border via `var(--color-border)`.
- Use for: nested panels, small summaries, login panels.
- **Do not** rely on default radius for registry pages; apply registry card classes (§5.1).

### 5.3 `Section` primitive (`ui/Card.js`)

Tinted nested block: `rounded-xl border border-[var(--color-primary)]/10 bg-[var(--color-bg)] p-4`. Use sparingly for sub-grouping inside a registry card (e.g., the apportionment impact preview in the billing wizard).

### 5.4 `PageHeader` (`ui/PageHeader.js`)

**Props:** `title` (string), `subtitle` (node), `breadcrumbs` (node), `actions` (node).

**Spacing:** Outer `flex flex-col gap-3 py-2`; title stack `space-y-1.5`; actions wrap with `gap-3`. H1 uses **`hs-page-title`**; subtitle uses **`hs-page-subtitle`** + `leading-relaxed`.

### 5.5 Buttons (`ui/Button.js`)

**Variants:** `primary` | `secondary` | `danger` | `ghost` | `dangerGhost`. The legacy `outline` alias maps to `secondary`.

**Sizes:** `sm` → `h-8` · `md` → `h-10` · `lg` → `h-12`.

For registry-style primary CTAs (tall, uppercase), pass `className` to reach `h-11 rounded-xl text-xs font-black uppercase tracking-widest` **or** use `primaryLinkCtaClass` from `LinkTokens.js` for link-styled primary actions.

**Destructive actions** (void, archive, terminate, decommission): always require a confirmation modal before execution; use `danger` / `dangerGhost` variants.

### 5.6 Primary and secondary link CTAs (`ui/LinkTokens.js`)

- `primaryLinkCtaClass`: filled teal link button (`h-10` baseline) — use for "Register …", "Record payment", "Add Reading".
- `secondaryOutlineLinkClass`: bordered neutral — use for "Update details" when rendered as `<Link>`.

Keep **one** filled primary CTA per major screen region.

### 5.7 Forms — `Field`, `Input`, `Select`, `Textarea` (`ui/Fields.js`)

- **Field label:** `text-sm font-medium` + required asterisk in red.
- **Control height:** default `h-10` (`Input` / `Select`); use `className="!h-11"` where the screen standardises on 48px fields.
- **Decorators:** `Input` supports native `icon` (Lucide node) and `prefix` (string) props. Icon focus animation (stone-400 → teal-600) is handled by the primitive.
- **Errors:** `text-xs` red below control; pass `hasError` to inputs. Always show a page-level `Alert variant="error"` in addition to field-level errors for API failures.
- **Grid:** `grid gap-6 md:grid-cols-2` for wide forms.

**Sectioning:** For > 4 fields, use multiple registry cards, each with a header strip + icon (`h-8 w-8` icon well, `size={16}` glyphs in form cards — slightly larger than the `h-7 w-7` list-page strip icons).

### 5.7.1 The Forensic Header Pattern

Every management form (Update, Move-Out, Record Payment) must lead with a contextual anchor to establish the system state before data entry:

- **RESOURCE IDENTITY:** A top-level section (within the first registry card or a separate compact card) containing:
  - **StatusBadge:** Current lifecycle state (e.g., `active`).
  - **ResourceIdCell:** The unique forensic identifier (e.g., `#CONTRACT-44`).
  - **Contextual Label:** Humanized name of the subject (e.g., "Santos, Benjamin").
- **IMMUTABLE FIELDS:** Highlight locked terms (Move-in date, Monthly rate) using a `stone-50` background tint to signal they cannot be modified per BR-CON-010.
- **HCI Benefit:** Reduces errors by confirming "Who" and "What" is being modified before the user scrolls to inputs.

### 5.7.2 Smart Financial Input Standards

When a form field captures a financial amount with a base/override relationship (e.g., `monthly_rate`):

- **Rule:** If a `monthly_rate_override` is active, the UI must show it as the **Primary Value**.
- **Agreed Rent Pattern:**
  - **Input label:** **Monthly Rent** (HCOL).
  - **Subtext:** "Base: ₱{base} · [Custom Rate Active]".
  - **Visuals:** Use a `badge-info` chip to flag overrides.
- **Agreed Rent Metric:** In read-only summaries (KPI cards, Profile headers), the **Monthly Rent** value must reflect the override, not the base rate, to ensure "One Version of the Truth."

**Action bar (clean bottom):** `flex flex-col-reverse gap-3 sm:flex-row sm:justify-end pt-6`. Primary submit on the right; Cancel secondary. This bar sits **outside** the last card, at the bottom of the `max-w-4xl` column.

### 5.7.1 Meter and utility input rules

When a form field captures a meter reading value (`reading_value`) or a utility rate (`base_rate`):

- **Meter readings:** Use `Input type="number"` with step `0.0001` (DECIMAL(12,4) in schema). Display the previous reading value and date as a visible hint below the input before the user enters a new value (BR-MET-005 non-regressive enforcement aid). Show a validation error immediately if the entered value is less than the previous reading.
- **Utility rates:** Use `Input type="number"` with step `0.01` (DECIMAL(10,2)). Always prefix with the `₱` symbol via the `prefix` prop. Display as `formatPHP()` in read-only contexts — never as a raw decimal.
- **Dial Rollover Toggle:** The `is_rollover` field required for meter reading entry must be presented as a standalone Checkbox or Switch below the reading input, labeled "Dial Rollover / Meter Reset". When toggled `true`, display an `<Alert variant="warning">` advising the user that this will bypass standard regression checks.
- **Override reason:** When the billing wizard allows a staff override of a calculated utility charge (FR-029, BR-MET-008), the reason `Textarea` becomes required on override and must be wired to server-side validation.
- **Contract Rate Override:** When a `monthly_rate_override` is active on a contract (BR-CON-013), display the base `monthly_rate` with `line-through text-stone-400` and the override in `font-bold text-teal-700`. Append a `badge-info` chip reading **"Custom Rate"** to the row or field for clarity.


### 5.8 `Table` (`ui/Table.js`)

- **Standalone registry table:** shell `rounded-2xl border border-stone-200 bg-white shadow-sm overflow-x-auto`.
- **Embedded in a registry card** (`p-0` body): pass `embedded` — shell becomes `min-w-0 overflow-x-auto` only (no double border).
- **Thead:** `bg-stone-50/50 border-b border-stone-100`; **th:** 10px bold uppercase (§3).
- **Rows:** `border-t border-stone-100`; interactive rows `hover:bg-stone-50 cursor-pointer`.
- **Action column pattern:** Last column is right-aligned with fixed width. Action button: `h-8 w-8`, `rounded-lg`, `border-stone-200`, `bg-white`, `text-stone-400`. Hover: `border-teal-200 bg-teal-50 text-teal-600`. Use `e.stopPropagation()` to prevent triggering parent row-click handlers.
- **Accessibility:** Always pass `caption` and `ariaLabel`.
- **Animation:** `framer-motion` stagger on tbody — respect `useReducedMotion`.

#### 5.8.1 Table column labels (registry standard)

Column semantics follow `db/havenstay_schema.sql` and `docs/SRS.md`. Labels are user-facing (Title Case, plain language), not raw SQL names.

| Rule | Guidance |
| :--- | :--- |
| **Stable vocabulary** | Reuse the same header for the same concept everywhere. Never alternate between "Tenant" on one screen and "Resident" on another. |
| **Tenant names in tables** | Header: **Tenant**. Display using **Last, First** via `formatTenantDirectoryName()`. |
| **Primary keys** | Use **`<Entity> ID`** when multiple entity types appear in one table (`Contract ID`, `Payment ID`). Use short **ID** when the table has a single subject. |
| **Registry ID cells** | Always mono prefix form per §3.2. Never a bare integer. |
| **Assignment** | **Room / Bed** when the row is anchored to `contracts.bed_space_id`. **Room** when only `rooms.room_code` is shown. |
| **Dates** | **Move-in** → `contracts.move_in_date` · **Billing period** → `billing_period_from` / `billing_period_to` · **Payment date** → `payments.payment_date` · **Due** → `billing.due_date`. |
| **Money** | **Monthly rate** → `monthly_rate` · **Amount paid** → `payments.amount_paid` · **Balance** / **Outstanding balance** → computed (no stored column). |
| **Meter values** | **Reading** → `meter_readings.reading_value` · **Consumption** → derived delta · **Rate** → `utility_rates.base_rate` · Always include unit suffix (kWh, m³) in header. |
| **Status** | Header: **Status**. Cell values use `StatusBadge` + enums from `lib/constants.js`. |
| **Actions column** | Header text `""` (empty string) for icon-only affordance. Do not use "Actions", "Control", or similar unless the column contains labeled buttons. |
| **Redacted PII (Viewers)** | When API returns masked data (`***`, `j***@gmail.com`) due to RBAC, render in `text-slate-400` and append a `Lock` icon (14px, `text-slate-300`) to indicate intentional redaction. |
| **Expandable Rows** | Toggleable rows using `framer-motion` (height) to reveal context inline (e.g., latest payment, contract summary) without page navigation. |

**Default column sets (list pages):**

| Registry | Column headers (left → right) |
| :--- | :--- |
| **Tenants** | Tenant ID, Name, Contact, Room, Outstanding balance, Status, (open) |
| **Rooms** | Room ID, Room code, Type, Capacity, Monthly rate, Status, (open) |
| **Contracts** | Contract ID, Tenant, Move-in, Room / Bed, Monthly rate, Status, (open) |
| **Billing** | Billing ID, Tenant, Billing period, Balance, Due, Status, (open) |
| **Payments** | Payment ID, Payment date, Tenant, Amount paid, Payment method, Status, (open) |
| **Users** | User ID, Name, Username, Email, Role, Status, (open) |
| **Meters** | Meter ID, Serial number, Utility type, Assigned room, Status, (open) |
| **Utility Rates** | Rate ID, Utility type, Base rate, Effective from, (open) |
| **Meter Readings** (embedded in meter detail) | Reading date, Value, Consumption (delta), Recorded by, Linked billing |

#### 5.8.2 Audit Log (`/admin/audit-logs`)

- **Role**: Tracks system changes and security events.
- **Filter**: Card titled **Filters**. Includes resource, actor, and Correlation ID.
- **Columns**: Audit ID (`#AUDIT-{id}`), Date, Actor, Action, Resource, Correlation, Record ID.
- **Standard**: Always use `embedded={true}` inside a registry card.
- **Tracing**: Group rows by Correlation ID to see the full context of an action.

#### 5.8.4 Expandable Rows (Progressive Disclosure)

To satisfy **HCI Focus: Progressive Disclosure** (§2.4 of UX Plan), tables support expandable context rows:
- **Trigger**: Chevron icon (`RowOpenIndicator`) in the first or last column.
- **Content**: Use a nested `Section` (§5.3) or a compact summary card to reveal related data (e.g., viewing the list of line items inside a billing row) without a hard context switch.
- **Animation**: Smooth vertical slide via `framer-motion`.

#### 5.8.5 Report tables (`/reports/*`)

- **Filter card strip title:** **Filters** (registry standard). Do not use "Filter ledger" or any non-standard variation.
- Use `embedded={true}` on `Table` only when inside a registry `Card` with `!p-0`.
- Reuse §5.8.1 vocabulary: **Billing ID**, **Billing period**, **Payment date**, **Amount paid**, **Tenant**, **Contract ID**, **Due**. Avoid one-off synonyms.
- Report IDs in cells use §3.2 prefixes.

### 5.9 `Breadcrumbs` (`ui/Breadcrumbs.js`)

Discrete small trail; final item = current page name. Avoid redundant H1 text repetition.

### 5.10 `FilterChips` (`ui/FilterChips.js`)

Active filter summary chips + "CLEAR ALL"; always pair with a **Filters** registry card.

**Pagination rule:** Filter chip clear (`onClear`, `onClearAll`) must reset `page` to `1` to avoid stale empty states after filter removal.

### 5.11 `Alert` (`ui/Alert.js`)

Variants: `info` | `success` | `warning` | `error`. Use for read-only role hints, API errors, export notices.

### 5.11.1 `RecordStateAlert` (`ui/RecordStateAlert.js`)

Thin wrapper around `Alert` for record lifecycle state messaging:
- Policy constraints (e.g., active contract blocks archive, completed contract blocks billing generation).
- Action-level failures returned by API validation.
- Keep titles action-specific and humanised (e.g., **Lifecycle locked**, **Action blocked**).

### 5.12 `Spinner` and skeletons (`ui/Spinner.js`, `ui/Skeleton.js`)

Centred spinner for inline loading. `SkeletonDetailPage` / `DashboardSkeleton` for route-level suspense. Never show a blank page — always show the skeleton while data loads.

### 5.13 `UserRoleBadge` (`ui/UserRoleBadge.js`)

Shows signed-in identity in header actions on operational pages.

### 5.13.1 `LifecycleActions` (`ui/LifecycleActions.js`)

Reusable action group for record lifecycle transitions:
- Supports `deactivate`, `reactivate`, `archive`, `restore`, `decommission` (meters) with role gating.
- Must disable transitions when policy guards are active (e.g., active contract blocks tenant archive per BR-TEN-004).
- Use shared `Button` variants only; no page-local lifecycle button forks.

### 5.13.2 `CurrencyCell` (`ui/CurrencyCell.js`)

Reusable mono financial cell for tables — formats values with `formatPHP()` and tabular numerals. Use for **Outstanding balance**, **Amount paid**, **Monthly rate**, **Base rate**, and any monetary column in registries and reports.

### 5.14 `StatusBadge` and status semantics

**File:** `frontend/src/app/_components/ui/StatusBadge.js` — all component files use `.js`, never `.jsx`.

Map domain values to predictable colors:

| Semantic | Statuses | Context / Notes |
| :--- | :--- | :--- |
| Positive | `active`, `paid`, `available`, `vacant`, `cleared` | Emerald. **Pulse** for `active`. `cleared` is for contract deposits. |
| Caution | `unpaid`, `pending_payment`, `maintenance`, `pending_sync` | Amber. **Pulse** for `pending_sync`. |
| Partial / Info | `partial` | Sky / Gray-blue. |
| Negative | `overdue`, `terminated`, `voided`, `unavailable` | Red. |
| Neutral | `completed`, `moved_out`, `archived`, `replaced` | Stone / Gray. Note: `voided` for CONTRACTS is also neutral-rose. |
| Occupied | `occupied` | Teal. `occupied` is for Beds. |

**Pulse indicators:**
The `active` (emerald) and `pending_sync` (amber) status dots must use a subtle scaling pulse animation (`animate-pulse` or custom keyframe) to signal that the system is actively monitoring and synchronised in real-time (§2.3 of UX Plan).

**Inclusive Design Rule:**
Status must not rely on color alone. Every `StatusBadge` must include clear text and, where possible, a supporting icon (e.g., `CheckCircle` for paid, `AlertTriangle` for overdue) to support users with color vision deficiencies.

Use `size` props (`xs` | `sm`) for density. Do not duplicate badge markup inline.

### 5.15 Modals (`ui/ConfirmationDialog.js`)

Destructive confirmations: descriptive title stating the consequence + secondary cancel + `danger` variant primary confirm. Required for: void payment, archive, terminate contract, decommission meter.

### 5.16 Empty state (`ui/EmptyState.js`)

**Pattern:** Card with centred stone icon (`Search` default) + title + guide copy + optional CTA.

- **Usage:** Replaces table logic for filtered searches with zero hits or empty landing modules.
- **Visuals:** `border-dashed border-stone-200 bg-stone-50/30 py-16`.
- Never replace with an inline `div` or raw text.

---

## 6. Interaction and feedback

- **Hover:** Table/list rows `bg-stone-50`; no layout shift.
- **Interactive lift:** Hub cards and navigation links use `transition-all duration-300 hover:shadow-lg hover:-translate-y-1`. Standard registry cards (§5.1) remain static (border/shadow only).
- **Focus:** Visible `outline` / `ring` teal per `globals.css` `*:focus-visible`.
- **Empty states:** Icon `text-stone-300`, bold title, one sentence of guidance + optional CTA.
- **Motion:** `pageVariants` for route content; disable when `useReducedMotion`.

---

## 8. Canonical Labeling Dictionary (The Staff Mental Model)

To satisfy **HCI Focus: Information Scent and Predictability**, all UI labels must use the standardized terms defined below. Technical jargon or database-centric terms are strictly prohibited in user-facing components.

### 8.1 Action-Oriented Vocabulary

Button and link labels must use specific, literal verbs that provide a high "Information Scent"—the user should predict exactly what happens next.

| Verb | Usage Context | Example Action |
| :--- | :--- | :--- |
| **Register** | Creating a new identity or permanent entity. | Register Tenant, Register Room, Register Meter. |
| **Record** | Logging a point-in-time event or transaction. | Record Payment, Record Reading. |
| **Update** | Modifying an existing record. | Update Profile, Update Rates. |
| **Generate** | Batch-creating records or derived data. | Generate Bills, Generate Report. |
| **Archive** | Moving an entity to a terminal, non-active state. | Archive Tenant, Archive Room. |
| **Void** | Cancelling a financial record while preserving the trail. | Void Payment, Void Bill, Void Contract. |
| **Early Move-Out** | Terminating an active lease agreement early. | Early Move-Out (Contract Action). |
| **Save Changes** | Finalizing a form and committing data. | Save Changes (Submit Button). |

### 8.2 Entity and Data Labels (The scannability standard)

| Database Term | Standard UI Label | Context / Rationale |
| :--- | :--- | :--- |
| **Tenant / Resident** | **Tenant** | Primary identity label. |
| **Bed Space** | **Bed** | Intuitive and brief; "Bed ID" for IDs. |
| **Rental Obligation** | **Monthly Rent** | Common industry term. |
| **Inception Date** | **Start Date** | Contract beginning. |
| **Expected Move-Out** | **End Date** | Contract conclusion. |
| **Arrears / Delinquency** | **Overdue Balance** | Neutral, action-oriented status. |
| **Outstanding Balance** | **Remaining Balance** | Focuses on completion. |
| **Dial Rollover** | **Meter Reset** | Physical meter limit event. |
| **Consumption** | **Usage** | Common utility terminology (e.g., "Water Usage"). |
| **Base Rate / Unit Rate** | **Rate** | Cost per unit (e.g., "Rate per kWh"). |
| **Correlation ID** | **Workflow ID** | Links the ID to the user's task. |

### 8.3 "Jobs-to-be-Done" Page Titles

Page titles must reflect the staff member's primary task, not just the entity name.

- **Tenant Directory** (Task: Finding people)
- **Room Inventory** (Task: Checking availability)
- **Contract Ledger** (Task: Managing agreements)
- **Billing & Collections** (Task: Financial oversight)
- **Meter Registry** (Task: Hardware management)
- **Audit History** (Task: Investigation)

### 8.4 Inclusive Confirmation and Error Copy

Feedback must follow the **Visibility of System Status** principle.

| Scenario | Standard Feedback Pattern |
| :--- | :--- |
| **Success** | "[Entity] [Action] successfully." (e.g., "Payment recorded successfully.") |
| **Forensic Success** | "[Entity] [Action]; history preserved in audit trail." |
| **Error** | "Could not [Action]. [Brief reason]." (e.g., "Could not record reading. Reading must be greater than previous.") |
| **Access Denied** | "You do not have permission to [Action]." |

---

## 10. Data fidelity and schema mapping

UI labels must map to real columns and ENUMs in `db/havenstay_schema.sql`. Friendly rename is acceptable; phantom fields are not.

| UI label (title case) | Table / field | Notes |
| :--- | :--- | :--- |
| Room Code | `rooms.room_code` | Unique |
| Room Category / Type | `rooms.room_type` | `private` / `shared` |
| Room Status | `rooms.status` | `available` / `unavailable` / `maintenance` |
| Bed Label | `bed_spaces.bed_label` | |
| Bed Status | `bed_spaces.status` | `vacant` / `occupied` / `maintenance` |
| Tenant Name | `tenants.first_name`, `last_name` | Always "Last, First" in tables |
| Phone Number | `tenants.contact_number` | |
| Contract Type | `contracts.contract_type` | `fixed_term` / `month_to_month` |
| Lease Period | `contracts.move_in_date`, `expected_move_out_date` | |
| Contract Status | `contracts.status` | `pending_payment` / `active` / `completed` / `terminated` / `voided` |
| Custom Rate | `contracts.monthly_rate_override` | Precedes base rate in billing if set (BR-CON-013) |
| Deposit Cleared | `contracts.is_cleared` | TRUE if refunded or rolled over (BR-PAY-010) |

| Billing Status | `billing.status` | `unpaid` / `partial` / `paid` / `overdue` |
| Payment Category | `payments.payment_category` | `billing` / `deposit` / `refund` / `rollover` |
| Payment Method | `payments.payment_method` | `cash` / `gcash` / `bank_transfer` / `other` |
| Serial Number | `meters.serial_number` | Unique per meter |
| Utility Type | `utilities.name` | Related via `utility_id` |
| Meter Value / Reading | `meter_readings.reading_value` | DECIMAL(10,2); display with unit suffix |
| Unit Rate / Base Rate | `utility_rates.base_rate` | DECIMAL(10,2); display as `formatPHP()` |
| Effective From | `utility_rates.effective_from` | DATE; applicable rate based on billing start |

**Room type display rule:** Use `private` / `shared` in API payloads and schema references. Optionally display as "Private Room" / "Shared Room" in copy-heavy UI contexts (labels, descriptions). Never display raw enum values to users — always use `lib/constants.js` label maps.

---

## 12. Form architecture

1. **Multi-card** for any form with more than four inputs (excluding paired small fields).
2. Each card: registry header strip + icon + body `p-8 space-y-6` (or `space-y-8` for dense sections).
3. **Width column (register vs update parity):** One outer wrapper for the whole screen:

   `mx-auto w-full max-w-4xl space-y-6`

   It must include `PageHeader`, any page-level `Alert`, all registry cards, and the clean bottom action bar. Do **not** render `PageHeader` full-width while only the `<form>` sits inside `max-w-4xl`.

4. **Validation:** Inline `Field` errors; top `Alert` for API / global failures. Never reset the form on a 422 response.
5. **Role-gating:** Disable or hide write controls for Viewer; explain with `Alert variant="info"`.

---

## 13. Profile detail pattern (split hub)

**Sidebar (~33%):** Avatar/icon, name, `StatusBadge`, key metrics (deposit, current room, dates, meter count for room detail).

**Main (~67%):** Registry cards — contact blocks, `embedded Table` for lease/payment/reading history, notes.

**Detail rows:** `label / value` row: label `text-xs font-bold uppercase tracking-wider text-stone-400`, value `text-sm text-stone-800`.

---

## 14. Data tables

- Prefer `Table` over hand-rolled `<table>` class soup.
- **Money and IDs:** DM Mono + tabular nums.
- **Actions column:** header label empty string; `className: "text-right"` via column def.
- **Export (reports):** CSV columns must match on-screen table order and labels.

---

## 15. Implementation checklist

- `PageHeader` with BHMS-accurate title + subtitle (§21); `hs-page-title` / `hs-strip-title` from `globals.css`
- Breadcrumbs + back control on detail / forms
- `AppMain` wraps page content; max width respected
- **Form pages:** `PageHeader` + alerts + cards + footer inside one `mx-auto w-full max-w-4xl space-y-6` column (§12)
- Registry card shell for registry + detail sections (`rounded-2xl border-stone-200 shadow-sm`)
- `Table` with `caption` / `ariaLabel`; `embedded` inside `p-0` cards
- At most **one** primary teal CTA per header (or justified footer submit)
- `FilterChips` when multiple filters
- Terminology (§8) + schema ENUMs (§10)
- Viewer read-only messaging where needed
- Responsive: stacked header actions; horizontal scroll for tables
- Reduced motion honoured on animations
- Meter / utility pages: previous reading hint, unit suffixes, `formatPHP()` for rates (§22.3)

---

## 16. Registry parity matrix

| Page type | Navigation | Surfaces | Labels |
| :--- | :--- | :--- | :--- |
| Registry list | `PageHeader` + optional hub | Filters registry card + `Table` or room grid | Filters |
| Detail | Back + **Update details** / actions | Split hub | Profile / record context |
| New / Edit | Back + save | Multi-card form | §8.2 section titles |
| Meter reading entry | Back + save | Single-card form with previous reading hint | §8.3 labels |
| Billing wizard | Step indicator + exit | Multi-step cards with impact preview | Utility Sync, Apportion, Confirm |

---

## 17. Document map (section numbers)

Sections **7**, **9**, and **11** are intentionally omitted to preserve stable references from earlier drafts. New material extends Sections 1–6, 8, 10, 12–16, or adds 18+ — do not renumber existing sections.

---

## 18. Universal module coverage

Sections 2–6, 8, 10, 12–14, and 19–21 apply to every product surface unless noted.

### 18.1 Module × pattern matrix

| Area | Primary patterns | Notes |
| :--- | :--- | :--- |
| **Dashboard** | KPI grid + hub links + Audit Pulse cards | Includes Turnover Forecast, Collections, and high-priority security events as highlighted cards. |
| **Tenants** | List + filters + table | Register / Update tenants. |
| **Rooms** | Grid or table + filters | Rooms, bed spaces, and meter link. |
| **Contracts** | List + filters + table | Link tenant to bed space. `fixed_term` and `month_to_month` types. |
| **Billing** | List + detail + wizard | No stored `amount_due`; show computed copy. Wizard for utility apportionment. |
| **Payments** | List + detail | Void = destructive confirm. |
| **Reports** | Filters + KPI summary + table + export | Date range in filter card. Report timestamp shown. |
| **Users** (Admin) | Card Grid + Side-Sheet | User Profile Cards instead of sterile tables. Side-Sheet for surgical edits. |
| **Utilities** | Hub + detail + Registration | Utility Catalog, profile, and Rate schedules. |
| **Meters** | List + detail + reading entry | Serial number, utility type, room assignment, reading history. |
| **Audit Log** (Admin) | Read-only list + diff modal | Tracks changes. Correlation ID connects related entries. |
| **Login** | Auth panel | Same colors/type; no sidebar or role badge. |

### 18.2 Non-negotiables

1. `PageHeader` on every authenticated route: title, subtitle, optional breadcrumbs, actions with `UserRoleBadge`.
2. **Back** control on detail / new / edit (§4.2).
3. **One** primary filled CTA per logical header/footer region.
4. Registry lists: filter strip + `FilterChips` when multiple active filters.
5. `Table` captions + mono IDs (§14 and §3.2).
6. Large forms: multi-card + clean bottom bar (§12).
7. Meter and utility forms: previous reading hint + unit suffix + `formatPHP()` for rates (§22.3).

### 18.3 Allowed variations

- **Rooms** list: card grid instead of table — cards use the registry card shell (§5.1) and must include **Predictive Status Indicators** (amber/red icons) for rooms with expiring leases.
- **Reports:** extra controls (date range, status, payment method) inside filter card.
- **Billing / payments:** emphasise mono for currency.
- **Billing wizard:** multi-step with `StepIndicator`, sticky action footer, exit prompt (§20.3).

---

## 19. Authoritative reusable components (file catalog)

Paths relative to `frontend/`.

| Name | File | Responsibility |
| :--- | :--- | :--- |
| `AppMain` | `src/components/ui/AppShell.js` | Main content column, padding, `max-w-7xl` |
| `AppFrame`, `Sidebar`, `MobileNav` | `src/components/layout/AppFrame.js`, `Sidebar.js`, `MobileNav.js` | App chrome |
| `PageHeader` | `src/components/ui/PageHeader.js` | Title, subtitle, breadcrumbs, actions |
| `PageHeaderActions` | `src/components/ui/PageHeaderActions.js` | Navigation and action group for operational pages |
| `Card` | `src/components/ui/Card.js` | Default surface; override classes for registry card (§5.1) |
| `Section` | `src/components/ui/Card.js` | Tinted inner panel |
| `KpiCard` | `src/components/ui/KpiCard.js` | Quantitative summary surface |
| `Button` | `src/components/ui/Button.js` | All `<button>` actions |
| `primaryLinkCtaClass`, `secondaryOutlineLinkClass` | `src/components/ui/LinkTokens.js` | `<Link>` CTA utility classes |
| `Field`, `Input`, `Select`, `Textarea` | `src/components/ui/Fields.js` | Form controls |
| `Table` | `src/components/ui/Table.js` | Registry + embedded tables (`embedded` prop) |
| `TablePagination` | `src/components/ui/TablePagination.js` | Server-side pagination control row |
| `Breadcrumbs` | `src/components/ui/Breadcrumbs.js` | Trail |
| `FilterChips` | `src/components/ui/FilterChips.js` | Active filters |
| `FilterPanelCard` | `src/components/ui/FilterPanelCard.js` | Filters registry card wrapper |
| `Alert` | `src/components/ui/Alert.js` | Banners |
| `RecordStateAlert` | `src/components/ui/RecordStateAlert.js` | Lifecycle / policy constraint messaging |
| `Spinner` | `src/components/ui/Spinner.js` | Inline loading |
| `Skeleton` | `src/components/ui/Skeleton.js` | Layout loading placeholders |
| `UserRoleBadge` | `src/components/ui/UserRoleBadge.js` | Role capsule |
| `StatusBadge` | `src/components/ui/StatusBadge.js` | Status / enum pill (`.js`, not `.jsx`) |
| `LifecycleActions` | `src/components/ui/LifecycleActions.js` | Record lifecycle transition group |
| `CurrencyCell` | `src/components/ui/CurrencyCell.js` | Mono financial cell |
| `ResourceIdCell` | `src/components/ui/ResourceIdCell.js` | Prefixed mono ID cell |
| `ResourceView` | `src/components/ui/ResourceView.js` | Data state handler (loading / syncing / empty / error) |
| `CorrelationIdCell` | `src/components/ui/CorrelationIdCell.js` | Correlation ID chip with hover link |
| `EmptyState` | `src/components/ui/EmptyState.js` | Zero-results visual guidance |
| `Icons` | `src/components/ui/Icons.js` | Shared SVG icons |
| `StepIndicator` | `src/components/ui/StepIndicator.js` | Multi-step wizard progress |
| `WizardFrame` | `src/components/ui/WizardFrame.js` | Multi-step unilineal data creation flow for high-stakes records |
| `SideSheetOverlay` | `src/components/ui/SideSheetOverlay.js` | Context-aware slide-over for rapid edits |
| `OccupancyBar` | `src/components/ui/OccupancyBar.js` | Bed occupancy visual progress bar |
| `Avatar` | `src/components/ui/Avatar.js` | Tenant initials avatar |
| `DetailRow` | `src/components/ui/DetailRow.js` | Label / value row for detail views |
| `RowOpenIndicator` | `src/components/ui/RowOpenIndicator.js` | Chevron affordance for clickable rows |
| `KeyboardHelpModal` | `src/components/ui/KeyboardHelpModal.js` | Keyboard shortcut help |
| `ConfirmationDialog` | `src/components/ui/ConfirmationDialog.js` | Destructive action confirmation modal |

**When adding a new module:** import from this set first. Add a new shared UI file only if the pattern is reused by two or more unrelated modules or is central to the system (then list it here).

---

## 20. Responsive behavior (standard)

| Breakpoint | Layout behavior |
| :--- | :--- |
| `< md` | Sidebar hidden; `MobileNav` visible; stack `PageHeader` actions below title. |
| `md+` | Sidebar fixed; main scrolls. |
| Tables | Always wrap in `Table` (handles `overflow-x-auto`); never shrink text below readable minimum — scroll instead. |
| Forms | `grid-cols-1` default; `md:grid-cols-2` for paired fields; max-width `max-w-4xl`. |
| Hub cards | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (adjust per content). |
| Detail hub | Stack sidebar above main until `lg:`, then split columns. |
| Empty | Use `EmptyState` to prevent "broken" look on search mismatch. |

### 20.1 Viewport Guard (Safe Zones)

To prevent "Viewport Clipping" in high-density forms (e.g., long notes or multi-step wizards):

- **Floating Shells (Modals/Sheets):** Must use `max-h-[90vh]` and `overflow-y-auto`.
- **Vertical Centering:** Use `flex items-center` only when content is guaranteed to fit; otherwise, use `items-start py-8` to ensure the header is always visible and the footer is reachable via scroll.
- **Adaptive Padding:** Use `p-6 sm:p-10` to maximize data visibility on smaller viewports.

Touch targets: minimum **44px** height for primary controls on mobile (`h-11` satisfies this).

### 20.3 Wizard layouts (Legacy Specific)

For older multi-step flows like the Utility Billing Wizard at `/billing/wizard`. For all other record creation flows in v7.0+, use the standard Wizard architecture (§20.4).

- **Header:** Simplified `PageHeader` with explicit exit/cancel action ("×" or "Cancel") that triggers `useUnsavedChangesWarning` before navigation.
- **Progress:** Horizontal `StepIndicator` at the top.
- **Navigation:** "Next", "Back", "Generate" buttons pinned to the bottom of the viewport or card in a sticky footer.

### 20.4 Standard Wizard & Edit Overlays (v7.0+)

To minimize interaction costs (Fitts's Law) and reduce cognitive load for data entry, standard list-based modules apply these rules:

- **Create/New flow (Wizards):** Use `<WizardFrame>` for all complex entity creations (New Tenant, New Contract).
  - Break forms over 6 inputs into bite-sized logical steps (e.g., Identity -> Contact -> Reference).
  - Hide unrelated chrome (sidebar, global search) to focus attention purely on data entry accuracy.
  - Final step always acts as a "Review & Confirm" summary.
- **Update/Edit flow (Side-Sheets):** Use `<SideSheetOverlay>` for entity modifications instead of routing to fully standalone `/edit` pages.
  - The side-sheet slides in from the right over the active registry table or detail view.
  - Applies a `backdrop-blur-sm bg-white/70` (Glassmorphism) to dim but not completely hide the underlying data, keeping the user contextually grounded.
  - Useful for surgical edits: updating a phone number or correcting a typo without a hard page reload.

### 20.5 Context Preservation (The Highlight Pattern)

To maintain the user's "Place" after a context switch:
- When a `SideSheetOverlay` or `ConfirmationDialog` is closed, the system **must** briefly highlight the target row in the underlying table (e.g., a 2-second teal-50 fade) to confirm where the user's attention should return.
- This satisfies the **HCI principle of Visibility of System Status** and reduces the "Where was I?" cognitive overhead.

---

## 21. Page Titles and Subtitles

| Route | Title (H1) | Subtitle |
| :--- | :--- | :--- |
| `/dashboard` | Overview | Daily activities, occupancy, and security pulse. |
| `/tenants` | Tenant Directory | Manage tenant profiles, contact info, and history. |
| `/tenants/[id]` | *(Tenant Name)* | Profile with embedded Side-Sheets for surgical updates. |
| `/tenants/new` | Register Tenant | Step-by-step registration for new tenants. |
| `/rooms` | Room Inventory | Track room status, bed occupancy, and availability. |
| `/rooms/[id]` | *(Room Code)* | Room details — beds, status, and meters. |
| `/contracts` | Contract Ledger | History of leases and agreements. |
| `/contracts/[id]` | Contract *(#id)* | Lease terms, billing, and payments. |
| `/contracts/new` | Register Contract | Link a tenant to a bed space. |
| `/billing` | Billing & Collections | Track bills, overdue balances, and payments. |
| `/billing/[id]` | Bill *(#id)* | Itemized charges and payments for this bill. |
| `/billing/new` | Generate Bills | Create new billing cycles for tenants. |
| `/payments` | Payment History | List of all payments and financial settlements. |
| `/payments/[id]` | Payment *(#id)* | Amount, method, and status. |
| `/admin/reports` | Reports | Data exports and operational summaries (Admin only). |
| `/admin/reports/*` | *(Report Name)* | Filter and export system data. |
| `/admin/users` | Users | Manage staff accounts and role permissions (Admin only). |
| `/utilities` | Utility Catalog | Categories and unit rates. |
| `/utilities/meters` | Meter Registry | Manage utility meters and readings. |
| `/admin/audit-logs` | Audit History | Investigation trail for system changes (Admin only). |
| `(auth)/login` | Welcome | Sign in to manage HavenStay. |

**API errors (user-facing):** Short headline + one recovery sentence ("Try again" / "Check your connection") — no stack traces.

---

## 22. Reducing long code and inconsistency

1. **Prefer imports:** `PageHeader`, `Card`, `Table`, `Field`/`Input`/`Select`, `Button`, `Alert`, `FilterChips`, `Breadcrumbs`, `UserRoleBadge`.
2. **Repeatable class recipes** (primary CTA, registry card shell) → keep in one `const` per file or import from `LinkTokens.js`.
3. **Do not** fork `Table` header styles in page-level CSS — use the shared component.
4. **Registry ID format:** always full prefix pattern (§3.2) for scanability.
5. **Colors:** prefer `globals.css` variables inside primitives; use stone/teal utilities on registry cards and page chrome.

### 22.3 Metrology formatting (readings and rates)

- **Meter readings:** Strip trailing zeros but preserve up to 2 decimal places if they exist (`145.6700` → `145.67`; `145.0000` → `145`). Always suffix with the unit of measurement if available (`145.67 kWh`, `12.00 m³`). The unit suffix must come from the utility type definition — do not hardcode.
- **Utility rates:** Always render as currency using `formatPHP()` (`₱15.50` per kWh). Never display as a raw decimal. This visually distinguishes a rate from a reading volume.
- **Consumption deltas:** Display as `+{value} {unit}` (e.g., `+45.20 kWh`) in a consumption column. Use `text-emerald-700` for normal consumption and `text-amber-700` for high-delta alerts (> historical average threshold defined by the backend).

---

## 23. Analytical reports pattern

Analytical views (Reports, Performance Summaries) focus on quantitative fidelity. They must follow this standardised vertical stack:

### 23.1 The reporting stack

1. **PageHeader**: Includes **"Export CSV"** (Primary Teal) in `actions`.
2. **Summary layer (KPI grid)**: Responsive row of `KpiCard` components (§24) for immediate numerical feedback.
3. **Active filter strip**: Registry card (§5.1) with strip title **Filters**. Contains controls and `FilterChips`.
4. **Observer table**: Full-width card with embedded `Table` (§5.8).

### 23.2 Generated lifecycle

Display data freshness timestamp in the `PageHeader` subtitle or top-right action well:

- **Format:** `text-[10px] font-mono uppercase tracking-widest text-stone-400`
- **Logic:** `Generated {timestamp} · {record_count} records`

---

## 24. Data summary card (KpiCard)

`KpiCard` is the authoritative component for high-level metrics. It replaces all local "Metric" or "Tile" implementations.

- **Value font:** DM Mono (`tabular-nums`) for currency, counts, and percentages.
- **Color semantics:** `isDanger` for negative trends (overdue, vacancy loss); teal-600 for positive status (collections, occupancy gain). Pass `isActiveDecision={true}` alongside warnings to trigger a predictive pulse animation outlining the critical path explicitly.
- **Actionability:** Every `KpiCard` on a dashboard should ideally be a **Hot Target**. Clicking the card should navigate the user to the corresponding filtered registry (e.g., clicking "5 Overdue" takes the user to `/billing?status=overdue`).
- **Responsive:** Default `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` for major report summaries.

---

## 25. User management and security patterns

Administration pages (Users, Roles, Audit) prioritise defensive UX to prevent accidental misconfiguration.

### 25.1 Access control toggle

High-visibility status section for deactivating accounts:
- **Visuals:** Contained in a `Card` section with `bg-stone-50/50`.
- **Label:** Bold weight, stone-700.
- **Safety:** Descriptive sub-text explaining the consequence (e.g., "This account will no longer be able to sign in").

### 25.2 User activity summary (embedded)

An embedded summary table showing the last 5–10 actions performed by a specific user in their detail view:
- **Component:** `Table` with `embedded={true}`.
- **Columns:** Timestamp (Mono), Action (Badge), Entity Reference.

---

## 26. Audit and compliance patterns

Security-sensitive trails are read-only and immutable in presentation.

### 26.1 Field changes (audit diff modal)

3-column diff table for `old_value` vs `new_value` JSON (labeled **Field changes** in the product):
- **Attribute:** Bold stone-900.
- **Original:** `line-through decoration-rose-400/50` in `bg-rose-50/50`.
- **Modified:** `font-bold text-emerald-800` in `bg-emerald-50`.

### 26.2 Trail typography

- **Timestamps:** `tabular-nums` for vertical alignment.
- **Registry IDs:** Mono prefixes per §3.2 — never bare integers in ID columns.

### 26.3 The Correlation Bridge

The `CorrelationIdCell` is the primary "Time Travel" affordance. It must be rendered in every table row that represents a forensically logged action (Payments, Contract Status Changes, Meter Readings).

- **Interaction:** Hovering reveals the "Correlation sequence" (e.g., "Part of Billing Cycle #4").
- **Constraint:** Correlation IDs are immutable once recorded.

---

## 27. UI Quality Gates (2026)

### 27.1 Clean Labels

- Use plain language: **Filters**, **Payment Method**, **Record Payment**, **Meter Value**.
- One term for one concept. No corporate jargon.

### 27.2 Readability

- Keep the top 3-5 KPIs visible at a glance.
- Tables are for finding things. Filters must be obvious.
- Figures over charts when precision is needed.

### 27.3 Accessibility

- Keyboard focus must be visible.
- Don't hide controls behind sticky bars.
- Target size: 44px for primary mobile actions.
- Form labels must always stay visible.
- Error messages must explain how to fix the problem.
- Reading errors must show the previous value so the user knows what's wrong.

### 27.4 The "Doomed Action" Gate

To prevent "API Frustration" (422 Validation Errors), the UI must strictly synchronize its controls with backend lifecycle constraints (**BR-CON-005**, **BR-CON-010**):

- **Rule:** If a backend rule forbids a status transition or metadata change in a specific context, the UI **must not** show an editable control.
- **Implementation:** Replace the `<Select>` or `<Input>` with a read-only `StatusBadge` or `DetailRow`.
- **Example:** In `ContractQuickEditForm`, the `status` field is hidden for archived contracts, as the lifecycle is terminal.

---

## Document history

| Version | Summary |
| :--- | :--- |
| **v8.0.0** | **Humanized Forensic Standard.** Established Human-Centric Operational Language (HCOL) framework. Codified the "Forensic Header" anchor pattern. Implemented the "Doomed Action Gate" for state-machine integrity. Standardized "Smart Financial Inputs" and Viewport Guard safe zones. |
| v7.1.0 | **Forensic UI Hardening.** Codified `monthly_rate_override` strikethrough pattern, `is_cleared` emerald badge, and contract `voided` lifecycle mapping. Locked immutable fields in documentation. |
| **v7.0.0** | **Next Gen UX Paradigm.** Institutionalized `isActiveDecision` predictive Dashboard KPIs, inline Glassmorphism Side-Sheets for surgical data updating, and Miller's Law validated Wizard patterns for complex system registration. |

| **v6.6.0** | **Forensic Normalization.** Synced all ENUMs with v4.8 Database Schema. Reconciled StatusBadge map. Purged deprecated Add-on Registry. |
| **v6.5.0** | **Forensic Cleanup.** Purged legacy Transaction Log references. Synced with havenstay_schema.sql v4.8 (44 triggers). Simplified language to remove jargon. |
| v6.0.0 | Full structural audit. Corrected schema ENUMs and component catalog. |
| v5.1.0 | FSD Architectural Upgrade. Aligned location references to `src/shared/ui/`. Added Redacted PII standards, Wizard Layouts (§20.3), and Metrology Formatting (§22.3). |
| v5.0.0 | Forensic Backend Synchronization. Synced with havenstay_schema.sql v4.6 and FRONTEND_CODING_BLUEPRINT.md v3.3. |
| v4.7.5 | UX quality gates based on current standards. |
| v4.7.4 | Link CTAs documented as `LinkTokens.js`. Removed obsolete `frontend/src/components/ui/` path. |
| v4.7.3 | Separate Audit trail vs Transaction logs routes. Filters strip standard. |
| v4.0 | BHMS voice; full component catalog (§19); responsive (§20); copy table (§21); CSS var bridge. |
| ≤ v3.0 | Early "command center" visual metaphor. |

---

*Aligned to: **HavenStay BHMS** — `docs/SRS.md` v4.5 · `docs/BUSINESS_RULES.md` v1.8 · `backend/database/sql/havenstay_schema.sql` v4.8 · `docs/API_REFERENCE.md` v4.8 · `docs/SDD.md` v4.5 · `docs/DATABASE.md` v4.8.*

*Implementation: `src/app/globals.css`, `src/app/_components/ui/`, `src/app/_components/layout/`, and domain-specific pages in `src/app/`.*

*The SRS and BUSINESS_RULES are authoritative for requirements. Schema follows the v4.8 forensic engine. UI labels and behavior are specified here.*
