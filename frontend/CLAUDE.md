# Frontend Development Guide

> **See the root-level documentation for complete guidance:**
>
> - `../CLAUDE.md` — Project rules, tech stack, architecture, and standards
>
> This frontend workspace inherits all rules from the root documentation.

## Quick Links

- **Design System (primary UI spec):** `../design-system/havenstay/MASTER.md`
- **Requirements:** `../docs/SRS.md`
- **Architecture:** `../docs/SDD.md`

## Frontend-Specific Reminders

### Tech Stack

- Next.js 16.2.1 (App Router only)
- React 19.2.4
- Tailwind CSS v4
- React Hook Form 7.x

### Key Patterns

- Always use `apiRequest()` from `@/lib/api` for API calls
- Always use `fetchCurrentUser()` and permission helpers from `@/lib/auth`
- Always use design system components from `src/app/_components/ui/`
- Always handle errors with `flattenApiErrors()` from `@/lib/errors`

### Design System Rules

Follow **`../design-system/havenstay/MASTER.md` (v8.0)** — BHMS-first naming, **registry cards**, SRS/SDD-aligned goals. Root **`../CLAUDE.md`** remains the full-project authority.

- Maximum one primary button per page (per MASTER + root rules)
- Destructive actions require confirmation modals
- Status communicated by color + text (never color alone)
- Monetary amounts and registry IDs use **`font-mono`** — fonts are **DM Mono** (`layout.js` / `--font-mono` in `globals.css`), not JetBrains
- Shared UI: `src/app/_components/ui/*` plus **`src/components/ui/StatusBadge.js`** where applicable
- **Tables:** use `Table` from `_components/ui/Table.js`; pass **`embedded`** when the table sits inside a registry card body (`p-0`)
- **Loading:** prefer **skeleton** loaders for route-level layouts (`SkeletonDetailPage`, `DashboardSkeleton`); **Spinner** for inline or inside buttons

### Before Committing

```bash
npm run lint    # Must pass
npm run build   # Must succeed
```

---

_For complete documentation, see `../CLAUDE.md`_
