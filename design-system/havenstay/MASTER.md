# HavenStay Boarding House Management System (BHMS)

## Design System — Master Specification — v4.3 (SRS/SDD–aligned)

> **What this document is:** The **visual, interaction, and component** specification for the HavenStay **frontend**. It implements the user-facing intent of **[docs/SRS.md](../../docs/SRS.md)** (especially **Section 2** Overall Description, **Section 3.1** User Interface) and stays consistent with the system context in **[docs/SDD.md](../../docs/SDD.md)** (Sections **1–3**, **Design goals**, module breakdown). It does **not** replace the SRS or SDD for functional or backend behavior.

### Why “Command Center” is not the product name

Earlier drafts used **“Command Center”** and **“cockpit”** as informal **visual metaphors** (dense tables, strong hierarchy, quick scanning). That language is **not** from the SRS/SDD and can sound like a different product (e.g. NOC dashboards). **HavenStay** is defined in the SRS as a **centralized web-based BHMS** for **small-scale boarding house operations**—replacing fragmented paper and spreadsheets with one relational source of truth, with **RBAC**, **auditability**, and **reporting**. This spec uses **BHMS** and **registry / operations** vocabulary instead.

### Design goals (aligned with SRS Section 2 & SDD Section 2)


| Source            | Intent for the UI                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SRS 2.1**       | One coherent system instead of fragmented records—screens should make **relationships obvious** (tenant → bed space → contract → billing → payment).           |
| **SRS 2.2–2.3**   | Support **Owner/Admin**, **Staff/Manager**, and **Viewer** with clear **role affordances** (write vs read-only).                                               |
| **SDD Section 2** | Protect **data integrity** and **bed-level occupancy** in presentation (correct labels, enums, no phantom fields).                                             |
| **SRS 3.1**       | **Responsive** web UI, sidebar + role-aware nav, design-system components, mobile drawer—layout rules in **Section 20** match this.                            |
| **Product tone**  | **Clear, calm, and trustworthy**—staff can complete daily tasks without hunting; copy uses **boarding house / tenant / lease** language (see **Section 8**). |


**Implementation:** `frontend/src/app/globals.css` (CSS variables), `frontend/src/app/layout.js` (fonts), UI modules in **Section 19** (`_components/ui/` under `app/` plus shared `components/ui/`).

**Reuse:** Prefer **documented primitives** over one-off Tailwind strings so spacing, type, and color stay aligned across modules.

---

## 1. Design direction


| Axis               | Guidance                                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Aesthetic**      | **Structured operations UI** — warm neutrals (stone), teal primary for trust and action, restrained depth; professional small-business tool, not consumer entertainment |
| **Density**        | **Registry** list pages: scannable tables and filters; **forms**: breathable `p-8` sections to reduce entry errors                                                      |
| **Motion**         | List/hub: optional `framer-motion` + `pageVariants`; forms: keep snappy (daily administrative use)                                                                      |
| **Responsiveness** | Mobile-first stacks; tables always `overflow-x-auto`; sidebar / drawer per **SRS Section 3.1** and `AppFrame` (**Section 20**)                                          |


---

## 2. Color, theme & tokens

Palette aligns with **Tailwind stone** + **teal** and with `**:root` variables** in `globals.css`. Prefer **semantic tokens** in primitives (`Button`, `Field`, `Input`); use **stone/teal utility classes** on **registry cards**, `PageHeader`, and the `Table` shell where the spec calls for explicit contrast.

### 2.1 CSS variables (source of truth)


| Token         | Variable                                  | Typical use               |
| ------------- | ----------------------------------------- | ------------------------- |
| Page backdrop | `--color-background` (#FAFAF9)            | `body`, `AppMain`         |
| Surface       | `--color-surface` / white                 | Cards                     |
| Primary       | `--color-primary` (#0D9488)               | CTAs, focus rings, chips  |
| Primary hover | `--color-primary-dark`                    | Hover / active            |
| Text          | `--color-text`                            | Body, labels              |
| Muted text    | `--color-text-secondary`                  | Help, captions            |
| Border        | `--color-border`, `--color-border-strong` | Inputs, cards             |
| Sidebar       | `--color-sidebar`                         | Navigation chrome         |
| Danger copy   | `--color-danger`                          | Errors, destructive hints |


### 2.2 Utility-level tokens (registry & primary surfaces)

- **Backdrop:** `stone-50` / `bg-[var(--color-background)]`
- **Structural border:** `stone-200`
- **Soft divider:** `stone-100`
- **Primary action:** `teal-600` / `bg-teal-600` (match `--color-primary` family)
- **Danger action:** `red-600` / rose palette for alerts (see `Alert` variants)
- **Shadows:** `shadow-sm` default elevation; `shadow-lg shadow-teal-900/10` **only** on the **single** primary registry CTA per page row
- **Radius scale:** `rounded-2xl` — registry cards & `Table` outer shell · `rounded-xl` — buttons, inputs, small panels · `rounded-lg` — icon wells, inline chips

### 2.3 Logo & Branding

**Format:** SVG (Scalable Vector Graphics) is the authoritative format for all identity assets to ensure resolution independence and crisp rendering.

**Source Location:** `frontend/public/brand/`


| Asset              | File Path               | Usage Context                                                    |
| ------------------ | ----------------------- | ---------------------------------------------------------------- |
| **Inverted Logo**  | `/brand/logo-light.svg` | **Primary** for `Sidebar` (`bg-slate-900`) and dark backgrounds. |
| **Full/Dark Logo** | `/brand/logo-dark.svg`  | For `Auth` routes (white/stone backgrounds) and light surfaces.  |
| **Favicon**        | `/brand/favicon.svg`    | Browser tab icon / metadata.                                     |


**Implementation:** Use the Next.js `Image` component. For the `Sidebar` brand well: `width={24} height={24}` (square glyph) or as defined by the parent flex container.

---

## 3. Typography

**Loaded fonts** (`layout.js`): **Plus Jakarta Sans** (headings), **DM Sans** (UI/body via `--font-sans`), **DM Mono** (amounts, IDs, codes).


| Role                               | Font                                  | Classes / rule                                                                                                                                               |
| ---------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Page title** (`PageHeader` h1)   | Plus Jakarta                          | **`hs-page-title`** (`globals.css`) — `font-black`, **`tracking-tight`**, **not** `tracking-tighter`; includes **word-spacing** so multi-word titles do not look cramped |
| **Subtitle** (under H1)            | DM Sans                               | `text-sm font-medium leading-relaxed text-stone-500` + **`hs-page-subtitle`** (word-spacing)                                                                                                                                 |
| **Card / strip titles** (registry) | Plus Jakarta                          | **`hs-strip-title`** + **title case** copy (see **§3.1**)                                                                                                    |
| **Field labels**                   | DM Sans                               | `text-sm font-medium` (see `Field`)                                                                                                                          |
| **Table column headers**           | DM Sans                               | `text-[10px] font-bold uppercase tracking-widest text-stone-400`                                                                                             |
| **Compact strip labels** (filters) | DM Sans                               | Same 10px bold uppercase; optional `tracking-[0.2em]` **only** on narrow strips—do not mix a third tracking scale on the same tier                           |
| **Breadcrumb row**                 | DM Sans                               | `text-[10px] font-bold uppercase tracking-wide` + **`[word-spacing:0.12em]`** (implemented on `Breadcrumbs` nav)—looser than `tracking-widest`             |
| **Registry / mono IDs**            | DM Mono                               | `font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400` — prefixes: `#TENANT-{id}`, `#ROOM-{id}`, `#CONTRACT-{id}`, `#BS-{bed_space_id}` |
| **Money & numeric columns**        | DM Mono                               | `font-mono tabular-nums` — use utility `text-tabular` where helpful                                                                                          |
| **Search UI Pattern**              | DM Sans + Icons                       | `Input` with `icon={Search}` — automated **group-focus** teal coloration for primary search wells                                                         |
| **Empty State copy**               | DM Sans                               | `text-sm font-bold text-stone-900` (title) + `text-xs text-stone-500` (guidance)                                                                           |


### 3.1 Heading casing & optical spacing

- **Do not** set multi-word **page H1** or **card strip** titles in all-lowercase (e.g. avoid `basic information`). Use **title case** for **registry card / form section** headings—capitalize principal words: *Basic Information*, *Bed Layout*, *Contact Details*, *Registry Filters*, *Emergency Contact*, *Lease Agreements*.
- **Page H1** when it is a **short command or product line** (Section 21): follow the examples there (*Register tenant*, *Operations*, *Room Registry*). Mixed case is intentional; still apply **`hs-page-title`** so word spacing stays readable.
- **Letter-spacing:** `tracking-tighter` is **reserved** for mono IDs and similar—not for `PageHeader` H1. Strip titles use **`hs-strip-title`** (mild negative tracking + **positive `word-spacing`**).
- **Implementation:** `frontend/src/app/globals.css` — **`.hs-page-title`**, **`.hs-page-subtitle`**, **`.hs-strip-title`**; `PageHeader.js` composes the page title + subtitle utilities.

---

## 4. Layout & spacing

### 4.1 Page shell

- `**AppMain`** (`ui/AppShell.js`): `max-w-7xl` content column, vertical `gap-8`, responsive padding `px-4 py-8` → `sm:px-6 sm:py-10` → `lg:px-8 lg:py-12`.
- **Authenticated chrome:** `AppFrame` + `Sidebar` + `MobileNav`; max width cap `max-w-[1600px] mx-auto` on the shell wrapper.
- **Auth routes** (`/login`, `/signin`): full bleed content; still use brand colors + typography.

### 4.2 Page header (`PageHeader`)

Every authenticated **module page** opens with:

1. **Breadcrumbs** (optional) — hierarchy, last crumb = current area name.
2. **Title + subtitle** — one clear H1; subtitle explains *what this screen is for* in boarding-house terms (see **Section 21**).
3. **Actions** — `flex flex-wrap justify-end gap-3`: **at most one** primary teal CTA per header row; secondary actions; **UserRoleBadge** on registry-style pages.

**Back control:** Detail and new/edit flows must expose an `h-11 w-11` rounded-xl **back** control in the header `actions` slot (link to parent registry or record).

### 4.3 Content grids


| Pattern                | Use                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| **KPI row**            | 1 col mobile → 2–3 cols `md:`+ for occupancy, collections, pending                         |
| **Hub**                | 2–4 column responsive grid of short links / summary cards                                  |
| **Split hub (detail)** | ~`lg:grid-cols-12`: sidebar **4** cols (summary), main **8** cols (cards, embedded tables) |
| **Forms**              | **`mx-auto w-full max-w-4xl`** column includes **PageHeader** + cards + action bar (Section 12); sections as stacked **registry cards** (Section 5.1) |


### 4.4 Horizontal rhythm

- **Registry card header strip:** `px-8 py-5` (registry + detail).
- **Filter toolbar inside card:** `px-6` allowed so filters align visually with table `px-6` cells.
- **Do not** invent `px-5` / `px-7` for main structural rows—stick to **6 / 8** system.

---

## 5. UI components (spec + reuse rules)

**Rule:** New screens should compose these files. If a pattern repeats 3+ times, **extract** a small local component or extend the shared UI module—do not duplicate long Tailwind strings.

### 5.1 Registry card (primary surface pattern)

**Definition:** The primary white surface for filters, tables, and grouped detail on operational pages—not necessarily the default styling of the `Card` primitive. (This pattern is what older drafts called a “command card”; the name **registry card** matches SRS scope: tenant/room/contract **registries** and related modules.)

- **Shell:** `bg-white border border-stone-200 rounded-2xl shadow-sm`
- **Header strip:** `border-b border-stone-100 bg-stone-50/50 px-8 py-5` + optional icon in `h-7 w-7 rounded-lg` tinted well + **`hs-strip-title`** for the title (title case copy, **§3.1**)
- **Body:** `p-8` for prose/forms · `p-0` when a `**Table`** or custom grid fills the card

**Implementation:** Use `Card` with `**className` overrides**, e.g. `className="!p-0 border-stone-200 shadow-sm overflow-hidden"` + header strip div inside. The default `Card` (Section 5.2) uses `rounded-xl` and CSS vars—**override** for **registry-grade** surfaces (lists, filters, detail blocks).

### 5.2 `Card` primitive (`ui/Card.js`)

- Default: `rounded-xl`, `p-6`, border/focus via `var(--color-border)`.
- Use for: nested panels, small summaries, login panels.
- **Do not** rely on default radius for **registry** pages; apply registry card classes (**Section 5.1**).

### 5.3 `Section` primitive (`ui/Card.js`)

Tinted nested block: `rounded-xl border border-[var(--color-primary)]/10 bg-[var(--color-bg)] p-4`. Use sparingly for sub-grouping inside a registry card.

### 5.4 `PageHeader` (`ui/PageHeader.js`)

**Props:** `title` (string), `subtitle` (node), `breadcrumbs` (node), `actions` (node).

**Spacing:** Outer `flex flex-col gap-3 py-2` (slightly more air between breadcrumb row and title block); title stack `space-y-1.5`; actions wrap with `gap-3`. H1 uses **`hs-page-title`**; subtitle uses **`hs-page-subtitle`** + `leading-relaxed`.

### 5.5 Buttons (`ui/Button.js`)

**Variants:** `primary` | `secondary` | `danger` | `ghost` | `dangerGhost` · legacy `outline` → `secondary`.

**Sizes:** `sm` `h-8` · `md` `h-10` · `lg` `h-12`. For **registry-style primary CTAs** (tall, uppercase), pass `**className`** to reach `h-11 rounded-xl text-xs font-black uppercase tracking-widest` **or** use `**primaryLinkCtaClass`** for **link-styled** primary actions (`ui/primaryLinkClasses.js`).

**Destructive:** Always confirm modal; use `danger` / `dangerGhost`.

### 5.6 Primary & secondary link CTAs (`ui/primaryLinkClasses.js`)

- `**primaryLinkCtaClass`:** filled teal link button (`h-10` baseline)—use for “Register …”, “Record payment”, etc.
- `**secondaryOutlineLinkClass`:** bordered neutral—use for “Update details” when rendered as `<Link>`.

Keep **one** filled primary per major screen region (header vs sticky footer exception: footer wins for form submit).

### 5.7 Forms — `Field`, `Input`, `Select`, `Textarea` (`ui/Fields.js`)

- **Field label:** `text-sm font-medium` + required asterisk in red.
- **Control height:** default `h-10` (`Input`/`Select`); for **parity with registry filter rows** use `**className="!h-11"`** or `**!h-12**` where the screen already standardized on 48px fields.
- **Decorators:** `Input` supports **native `icon`** (Lucide node) and **`prefix`** (string) props. Icon Well focus animation (stone-400 → teal-600) is handled by the primitive.
- **Errors:** `text-xs` red below control; pass `hasError` to inputs.
- **Grid:** `grid gap-6 md:grid-cols-2` for wide forms.

**Sectioning:** For **> 4 fields**, use **multiple registry cards**, each with header strip + icon (forms use `**h-8 w-8`** icon well, `**size={16}**` glyphs—slightly larger than 5.1 strip icons).

**Action bar (clean bottom):** Primary + Cancel **outside** the last card, `pt-6`, `flex flex-col-reverse gap-3 sm:flex-row sm:justify-end` so mobile stacks with primary last (thumb-friendly).

### 5.8 `Table` (`ui/Table.js`)

- **Standalone registry table:** default shell `rounded-2xl border border-stone-200 bg-white shadow-sm overflow-x-auto`.
- **Embedded in a registry card** (`p-0` body): pass `**embedded`** — shell becomes `min-w-0 overflow-x-auto` only (no double border).
- **Thead:** `bg-stone-50/50 border-b border-stone-100`; **th:** matches Section 3 table header row.
- **Rows:** `border-t border-stone-100`; interactive rows `hover:bg-stone-50 cursor-pointer`.
- **Accessibility:** Always pass meaningful `**caption`** + `**ariaLabel**`.
- **Animation:** `framer-motion` stagger on tbody—respect `useReducedMotion`.

### 5.9 `Breadcrumbs` (`ui/Breadcrumbs.js`)

Discrete, small trail; final item = current page name; avoid redundant H1 text.

### 5.10 `FilterChips` (`ui/FilterChips.js`)

Active filter summary chips + “CLEAR ALL”; pair with **Registry filters** card title.

### 5.11 `Alert` (`ui/Alert.js`)

Variants: `info` | `success` | `warning` | `error`. Use for read-only role hints, API errors, export notices.

### 5.12 `Spinner` & skeletons (`ui/Spinner.js`, `ui/Skeleton.js`, `ui/DashboardSkeleton.js`)

Centered spinner for inline loading; `**SkeletonDetailPage`** / `**DashboardSkeleton**` for route-level suspense.

### 5.13 `UserRoleBadge` (`ui/UserRoleBadge.js`)

Shows signed-in identity in header actions on operational pages.

### 5.14 `StatusBadge` & status semantics

**File:** `frontend/src/components/ui/StatusBadge.js` (shared across app routes).

Map domain values to **predictable** colors (Tailwind utility pattern):


| Semantic           | Typical statuses                                     | Style direction      |
| ------------------ | ---------------------------------------------------- | -------------------- |
| Positive           | `active`, `paid`, `vacant`, `available`              | Emerald / green tint |
| Caution            | `unpaid`, `pending`, due soon                        | Amber tint           |
| Partial / info     | `partial`                                            | Sky / blue-gray tint |
| Negative           | `overdue`, `terminated` (when shown as risk), errors | Red / rose tint      |
| Neutral / complete | `completed`, `moved_out`, `archived`, `unavailable`  | Stone / gray tint    |


Use `**size`** props (`xs` | `sm`) for density; do not duplicate badge markup inline.

### 5.16 Empty state (`ui/EmptyState.js`)

**Pattern:** Card with centered stone icon (`Search` default) + title + guide copy + optional CTA.
- **Usage:** Replaces `Table` logic for filtered searches with zero hits or empty landing modules.
- **Visuals:** `border-dashed border-stone-200 bg-stone-50/30 py-16`.

### 5.15 Modals (`ui/KeyboardHelpModal.js`, local confirm dialogs)

Destructive confirmations: title + short consequence copy + secondary cancel + danger primary.

---

## 6. Interaction & feedback

- **Hover:** Table/list rows `bg-stone-50`; no layout shift.
- **Interactive lift:** Hub cards / navigation links (`HubItem`) use **`transition-all duration-300 hover:shadow-lg hover:-translate-y-1`** to signal clickability. Standard registry cards (5.1) remain static (border/shadow only).
- **Focus:** Visible `outline` / `ring` teal per globals `*:focus-visible`.
- **Empty states:** Icon `text-stone-300`, bold title, one sentence of guidance + optional CTA.
- **Motion:** `pageVariants` for route content; disable when `useReducedMotion`.

---

## 8. Terminology & nomenclature (BHMS)

Avoid generic SaaS jargon. Prefer **property / boarding house / tenant / lease / ledger** language.


| **Avoid**                    | **Prefer**                                                               |
| ---------------------------- | -------------------------------------------------------------------- |
| Customer, user (for boarder) | **Tenant**, **boarder** (code/API stays `tenant`)                    |
| SKU, product                 | **Room code**, **bed space**                                         |
| Order, checkout              | **Billing cycle**, **payment**, **invoice period**                   |
| Create (primary CTA)         | **Register** … (Register Tenant, Register Contract)                  |
| Edit (primary)               | **Update details**                                                   |
| Dashboards (jargon)          | **Operations** / **Overview** (subtitle can say “Today at a glance”) |


### 8.1 Registry naming

- **Tenant Registry**, **Room Registry**, **Contract Registry**, **Billing records**, **Payment log**, **User directory** (Admin), **Audit trail**.
- Filter card title: **Registry filters** or **Search & filters**.

### 8.2 Form section titles (title case)

Use **title case** on the card strip: **Basic Information**, **Contact Details**, **Emergency Contact**, **Room & Bed Assignment**, **Lease Terms**, **Billing & Utilities**, **Notes**, **Bed Layout**, **Description**, **Tenant Status**, **Registry Filters**.

### 8.3 Data labels (title case in UI)

**Monthly Rate**, **Lease Period**, **Room Code**, **Bed Label**, **Registry ID**, **Payment Reference**, **Amount Paid**, **Balance**, **Tenant Name**, **Contact Details**.

---

## 10. Data fidelity & schema mapping

UI labels must map to real columns / enums in `db/havenstay_schema.sql`. Friendly rename is OK; phantom fields are not.


| UI label (title case) | Table / field                                      | Notes                                                                              |
| --------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Room Code             | `rooms.room_code`                                  | Unique                                                                             |
| Room Category         | `rooms.room_type`                                  | `solo` / `shared`                                                                  |
| Room Status           | `rooms.status`                                     | `available` / `unavailable` / `maintenance` only — **never** `occupied` on `rooms` |
| Bed Label             | `bed_spaces.bed_label`                             |                                                                                    |
| Tenant Name           | `tenants.first_name`, `last_name`                  |                                                                                    |
| Phone Number          | `tenants.contact_number`                           |                                                                                    |
| Lease Period          | `contracts.move_in_date`, `expected_move_out_date` |                                                                                    |
| Contract Status       | `contracts.status`                                 | `active` / `completed` / `terminated`                                              |
| Billing Status        | `billing.status`                                   | `unpaid` / `partial` / `paid` / `overdue`                                          |
| Payment Method        | `payments.payment_method`                          |                                                                                    |


---

## 12. Form architecture

1. **Multi-card** for any form with **more than four** inputs (excluding paired small fields).
2. Each card: registry header strip + icon + **body** `p-8 space-y-6` (or `space-y-8` for dense sections).
3. **Width column (register vs update parity):** Use **one** outer wrapper for the whole screen:

   `mx-auto w-full max-w-4xl space-y-6` (or equivalent with `motion.div`)

   It must include **`PageHeader`**, any page-level **`Alert`**, **all** registry cards, and the **clean bottom** action bar.

   **Do not** render **`PageHeader`** full-width on `AppMain` while only the `<form>` (or cards) sit inside `max-w-4xl` — the title block will appear wider than the cards and **Register** / **Update** flows will look inconsistent.

4. **Validation:** Inline `Field` errors; top `Alert` for API / global failures.
5. **Role-gating:** Disable or hide write controls for Viewer; explain with `Alert variant="info"`.

---

## 13. Profile detail pattern (split hub)

**Sidebar (~33%):** Avatar/icon, name, **StatusBadge**, key metrics (deposit, current room, dates).

**Main (~67%):** Registry cards — contact blocks, **embedded** `Table` for lease/payment history, notes.

**Detail rows:** Prefer a small repeatable **label / value** row: label `text-xs font-bold uppercase tracking-wider text-stone-400`, value `text-sm text-stone-800`.

---

## 14. Data tables

- Prefer **`Table`** over hand-rolled `<table>` class soup.
- **Money & IDs:** DM Mono + tabular nums.
- **Actions column:** header label empty string; header cell `className: "text-right"` via column def.
- **Export (reports):** CSV columns must match on-screen table order and labels (product rule).

---

## 15. Implementation checklist

- `PageHeader` with BHMS-accurate title + subtitle (**Section 21**); **`hs-page-title`** / **`hs-strip-title`** from `globals.css` where applicable
- Breadcrumbs + back control on detail / forms
- `AppMain` wraps page content; max width respected
- **Form pages:** `PageHeader` + alerts + cards + footer inside **one** `mx-auto w-full max-w-4xl space-y-6` column (**Section 12**)
- Registry card shell for registry + detail sections (`rounded-2xl border-stone-200 shadow-sm`)
- `Table` with `caption` / `ariaLabel`; `embedded` inside `p-0` cards
- At most **one** primary teal CTA per header (or justified footer submit)
- `FilterChips` when multiple filters
- Terminology (**Section 8**) + schema enums (**Section 10**)
- Viewer read-only messaging where needed
- Responsive: stacked header actions; horizontal scroll for tables
- Reduced motion honored on animations

---

## 16. Registry parity matrix


| Page type     | Navigation                          | Surfaces                                         | Labels                   |
| ------------- | ----------------------------------- | ------------------------------------------------ | ------------------------ |
| Registry list | `PageHeader` + optional hub         | Filters registry card + **`Table`** or room grid | Registry filters         |
| Detail        | Back + **Update details** / actions | Split hub                                        | Profile / record context |
| New / Edit    | Back + save                         | Multi-card form                                  | Section 8.2              |


---

## 17. Document map (section numbers)

Sections **7**, **9**, and **11** remain **intentionally omitted** in this document to preserve stable references from earlier drafts. **New material** extends Sections **1–6**, **8**, **10**, **12–16**, or adds **18+**—do not renumber existing sections.

---

## 18. Universal module coverage

Sections **2–6**, **8**, **10**, **12–14**, and **19–21** apply to **every** product surface unless noted.

### 18.1 Module × pattern matrix


| Area                | Primary patterns         | Notes                                                             |
| ------------------- | ------------------------ | ----------------------------------------------------------------- |
| **Dashboard**       | KPI grid + hub links     | Subtitle: e.g. “Today at a glance—occupancy, billing, and tasks.” |
| **Tenants**         | List + filters + table   | Register / Update tenants                                       |
| **Rooms**           | Grid or table + filters  | Rooms & bed spaces                                                |
| **Contracts**       | List + filters + table   | Lease agreements anchored to bed spaces                           |
| **Billing**         | List + detail + generate | No stored `amount_due`; show computed copy                        |
| **Payments**        | List + detail            | Void = destructive confirm                                        |
| **Reports**         | Filters + table + export | Date range in filter card OK                                      |
| **Users** (Admin)   | List + edit              | Role names: Admin / Staff / Viewer                                |
| **Audit trail**     | Read-only list           | No create CTA                                                     |
| **Login / Sign-in** | Auth panel               | Same colors/type; no role badge                                   |


### 18.2 Non-negotiables

1. `**PageHeader`** on authenticated routes: title, subtitle, optional breadcrumbs, actions with `**UserRoleBadge**` where other modules do.
2. **Back** control on detail / new / edit (**Section 4.2**).
3. **One** primary filled CTA per logical header/footer region.
4. Registry lists: filter strip + `**FilterChips`** when multiple active filters.
5. `**Table**` captions + mono IDs (**Section 14**).
6. Large forms: multi-card + clean bottom bar (**Section 12**).

### 18.3 Allowed variations

- **Rooms** list: card grid instead of table—cards still use the **registry card** shell (**Section 5.1**).
- **Reports:** extra controls (date range, status) inside filter card.
- **Billing / payments:** emphasize mono for currency.

### 18.4 Scope of Section 16

Applies to **Tenants, Rooms, Contracts, Billing, Payments, Users** wherever list → detail → edit exists. **Reports**, **Dashboard**, **Audit** follow their rows in **18.1**.

---

## 19. Authoritative reusable components (file catalog)

Paths are relative to the **frontend** package root (`frontend/`).


| Name                                                  | File                                                            | Responsibility                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| `AppMain`                                             | `src/app/_components/ui/AppShell.js`                            | Main content column, padding, `max-w-7xl`                             |
| `PageHeader`                                          | `src/app/_components/ui/PageHeader.js`                          | Title, subtitle, breadcrumbs, actions                                 |
| `Card`                                                | `src/app/_components/ui/Card.js`                                | Default surface; override classes for **registry card** (Section 5.1) |
| `Section`                                             | `src/app/_components/ui/Card.js`                                | Tinted inner panel                                                    |
| `Button`                                              | `src/app/_components/ui/Button.js`                              | All `<button>` actions                                                |
| `primaryLinkCtaClass`, `secondaryOutlineLinkClass`    | `src/app/_components/ui/primaryLinkClasses.js`                  | `<Link>` CTAs                                                         |
| `Field`, `Input`, `Select`, `Textarea`                | `src/app/_components/ui/Fields.js`                              | Form controls                                                         |
| `Table`                                               | `src/app/_components/ui/Table.js`                               | Registry + embedded tables (`embedded` prop)                          |
| `Breadcrumbs`                                         | `src/app/_components/ui/Breadcrumbs.js`                         | Trail                                                                 |
| `FilterChips`                                         | `src/app/_components/ui/FilterChips.js`                         | Active filters                                                        |
| `Alert`                                               | `src/app/_components/ui/Alert.js`                               | Banners                                                               |
| `Spinner`                                             | `src/app/_components/ui/Spinner.js`                             | Inline loading                                                        |
| `Skeleton`, `SkeletonDetailPage`, `DashboardSkeleton` | `src/app/_components/ui/Skeleton.js`, `DashboardSkeleton.js`    | Layout loading                                                        |
| `UserRoleBadge`                                       | `src/app/_components/ui/UserRoleBadge.js`                       | Role capsule                                                          |
| `StatusBadge`                                         | `src/components/ui/StatusBadge.js`                              | Status / enum pill                                                    |
| `Icons`                                               | `src/app/_components/ui/Icons.js`                               | Shared SVG icons                                                      |
| `AppFrame`, `Sidebar`, `MobileNav`                    | `src/app/_components/AppFrame.js`, `Sidebar.js`, `MobileNav.js` | App chrome                                                            |
| `KeyboardHelpModal`                                   | `src/app/_components/ui/KeyboardHelpModal.js`                   | Shortcut help                                                         |
| `EmptyState`                                         | `src/app/_components/ui/EmptyState.js`                         | "No results" visual guidance                                          |


**When adding a new module:** import from this set first; only add a new shared UI file if the pattern is **reused** or **central** to the design system (then list it here).

---

## 20. Responsive behavior (standard)


| Breakpoint | Layout behavior                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| `< md`     | Sidebar hidden; `MobileNav` visible; stack `PageHeader` actions below title                                 |
| `md+`      | Sidebar fixed; main scrolls                                                                                 |
| Tables     | Always wrap in `Table` (handles `overflow-x-auto`); never shrink text below readable minimum—scroll instead |
| Forms      | `grid-cols-1` default; `md:grid-cols-2` for paired fields; max-width `max-w-4xl` for alignment                      |
| Hub cards  | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (adjust per content)                                            |
| Detail hub | Stack sidebar above main until `lg:` then split columns                                                     |
| Empty      | Use `EmptyState` illustration to prevent "broken" look on search mismatch                                   |


Touch targets: minimum **44px** height for primary controls on mobile (`h-11` satisfies).

---

## 21. Page titles, subtitles & microcopy (examples)

Use as defaults; adjust only if the screen has a narrower job.


| Route / area     | Title (H1)                       | Subtitle (guidance)                                                 |
| ---------------- | -------------------------------- | ------------------------------------------------------------------- |
| Dashboard        | Operations                       | Monitor daily activities, occupancy updates, and pending administrative tasks. |
| Tenant list     | Tenant Registry                  | Manage profile data, contact details, and historical lease statuses.           |
| Tenant detail    | *(Tenant name)*                  | Profile details — contact, lease, and billing context.                         |
| Tenant new/edit  | Register tenant / Update details | Enter accurate information for tenant records to ensure billing and contract accuracy. |
| Rooms list       | Room Registry                    | Review room inventory, capacity limits, and current rate configurations.       |
| Room detail      | *(Room code)*                    | Room profile — beds, status, and assignments.                                  |
| Contracts list   | Contract Registry                | Chronological ledger of active and historical lease agreements.                |
| Contract detail  | *(Registry ID or short title)*   | Lease terms, billing, and payment history.                                     |
| Billing list     | Billing                          | Monitor account balances and track monthly billing cycles across all contracts. |
| Billing detail   | Billing *(# id)*                 | Line items, payments, and status for this cycle.                               |
| Payments list    | Payments                         | Chronological ledger of payments, reference codes, and contract links.         |
| Reports hub      | Reports                          | Operational exports and summaries.                                             |
| Report sub-pages | *(Report name)*                  | Filter, review, and export—columns match the CSV.                              |
| Users            | User directory                   | Staff accounts and roles (Admin only).                                         |
| Audit logs       | Audit trail                      | Who changed what, and when.                                                    |
| Login            | Welcome back                     | Sign in to manage rooms, tenants, and billing.                                 |


**API errors (user-facing):** Short headline + one recovery sentence (“Try again” / “Check your connection”)—no stack traces.

---

## 22. Reducing long code & inconsistency

1. **Prefer imports:** `PageHeader`, `Card`, `Table`, `Field`/`Input`/`Select`, `Button`, `Alert`, `FilterChips`, `Breadcrumbs`, `UserRoleBadge`.
2. **Repeatable class recipes** (primary CTA, registry card shell) → keep in **one** `const` per file or extend `primaryLinkClasses.js` if link-based.
3. **Do not** fork `Table` header styles in page-level CSS—use the shared component.
4. **Registry ID format:** always full prefix pattern (**Section 3**) for scanability.
5. **Colors:** prefer `globals.css` variables inside primitives; use **stone/teal** utilities on **registry cards** and page chrome to match this spec visually.

---

## Document history


| Version | Summary                                                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| v4.3    | **§5.16** `EmptyState` primitive; **§5.7** `Input` icon/prefix decorators; **§6** Interactive lift hover transform; grid responsiveness for empty states |
| v4.2    | **§3.1** heading casing (title case strip titles); **`hs-page-title` / `hs-page-subtitle` / `hs-strip-title`** in `globals.css`; PageHeader + Breadcrumbs optical spacing; **§8.2** title-case examples |
| v4.1    | BHMS-first title; SRS/SDD traceability; **Registry card** naming; design-goals table; **Section 12** form column = PageHeader + cards + actions (`max-w-4xl` parity) |
| v4.0    | BHMS voice; full component catalog (19); responsive (20); copy table (21); CSS var bridge; `Table` embedded; parity with `globals.css` + layout fonts |
| v3.2    | Registry matrix, universal coverage, label tracking                                                                                                   |
| ≤ v3.0  | Early “command center” visual metaphor, forms, tables, parity matrix                                                                                  |


---

*Aligned to: **HavenStay BHMS** — `[docs/SRS.md](../../docs/SRS.md)`, `[docs/SDD.md](../../docs/SDD.md)`; implementation: `globals.css` (**`hs-page-title`**, **`hs-strip-title`**), `layout.js`, `frontend/src/app/_components/ui/`*, `frontend/src/components/ui/*`. The SRS remains authoritative for functional requirements; **UI copy, tone, and components** are specified in this MASTER (**Sections 3.1, 8, and 21**). There is no separate `docs/UIUX_DESIGN_SPEC.md` in the repository today—if one is added later, resolve overlaps in favor of SRS for requirements and this MASTER for visual implementation.*