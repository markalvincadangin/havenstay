# HavenStay Frontend Coding Blueprint

Version: 1.0  
Status: Proposed standard for consistent App Router frontend implementation  
Scope: `frontend/` Next.js application

## 1) Purpose

This blueprint defines coding conventions, architectural patterns, and quality guardrails for HavenStay frontend modules. It operationalizes `docs/SRS.md` (what), `docs/SDD.md` (how), and the design-system specification (`design-system/havenstay/MASTER.md`) into a repeatable implementation style focused on maintainability, readability, consistency, and delivery speed.

This document is normative for frontend changes unless a module-specific exception is approved and documented.

## 2) Architectural Baseline (Non-Negotiable)

- Keep strict separation of concerns:
  - App Router pages: route composition and module orchestration.
  - Shared UI components: reusable, presentation-focused building blocks.
  - Hooks: stateful behavior and interaction orchestration.
  - Lib modules: API client, constants, formatting, auth/session helpers.
- Route all backend communication through `src/lib/api.js` (`apiRequest()`).
- Keep enum labels and UI state mappings aligned to `src/lib/constants.js`.
- Preserve role-aware UX behavior (Admin/Staff/Viewer) defined by SRS/UI rules.
- Keep auth guard behavior consistent with middleware + client auth utilities.

## 3) Layer Responsibilities

### 3.1 Pages (`src/app/**/page.js`)

Pages must:

1. Validate route/search params as needed.
2. Compose module sections (filters, table, form, summary).
3. Delegate all data access to `apiRequest()` or thin domain helpers.
4. Keep display state and user interactions clear and predictable.
5. Return standardized loading/empty/error UX patterns.

Pages must not:

- Reimplement low-level fetch/auth/error handling logic.
- Duplicate label/status mapping that already exists in constants/utilities.
- Contain deeply coupled business transformation logic better suited to lib modules.

### 3.2 Shared Components (`src/app/_components/**`)

Components must:

- Prefer explicit props and predictable render behavior.
- Keep formatting delegated to shared formatters/utilities.
- Use accessible controls/labels and role-appropriate affordances.

Components must not:

- Perform hidden writes or cross-module side effects.
- Duplicate API calls already owned by parent page/hook logic.
- Hardcode domain labels that belong in `constants.js`.

### 3.3 Hooks (`src/hooks/**`)

Hooks are the behavior layer. They should:

- Encapsulate reusable page logic (guards, shortcuts, transient UI state).
- Be deterministic and free of hidden global mutation.
- Use clear cleanup for listeners/subscriptions.

Hooks must not:

- Embed route-specific rendering concerns.
- Duplicate auth/session primitives from `src/lib/auth.js` and `src/lib/api.js`.

### 3.4 Lib Modules (`src/lib/**`)

Lib modules are source-of-truth utilities:

- `api.js`: request transport, token handling, error normalization.
- `constants.js`: domain labels/options and semantic maps.
- `formatters.js`: currency/date/id render helpers.
- `auth.js`, `config.js`: session/env boundaries.

Lib modules must not:

- Import page/component-level concerns.
- Drift from backend schema/status semantics.

## 4) Data Access and API Contract Rules

- Use `apiRequest(path, options)` for all backend calls.
- Handle errors via `ApiError` semantics; do not branch ad hoc per page.
- Keep request/response handling compatible with backend JSON envelope:
  - success: `message`, `data` (and optional `meta`).
  - failure: `message`, optional `errors`.
- Keep unauthorized handling centralized (`UNAUTHORIZED_EVENT`) and avoid manual duplicate redirects in feature code.

## 5) Authentication and Authorization UX

- Token key remains `havenstay_token` in `localStorage`.
- Keep middleware and client guard behavior aligned:
  - unauthenticated access to protected routes redirects to `/login`.
  - authenticated users are redirected away from auth-only pages.
- Enforce viewer read-only behavior in UI affordances:
  - hide/disable create/update/destructive actions.
  - show clear, non-blocking guidance.

## 6) State and Interaction Conventions

- Prefer local state for page-local interactions.
- Extract reusable logic into hooks when used in 2+ places.
- Guard against race conditions in concurrent requests (loading flags, stale updates).
- Keep optimistic updates conservative for financial/forensic-sensitive modules (billing/payments/audit/transaction logs).

## 7) Validation and Form Rules

- Keep form-level validation close to form components.
- Keep API/domain validation feedback mapped from backend `errors` payloads.
- Use consistent error copy and field messaging patterns.
- Do not suppress server validation details that users can correct.

## 8) Formatting and Domain Display Rules

- Monetary values must use shared currency formatting helpers.
- Timestamps should use consistent locale strategy (`en-PH`) where applicable.
- IDs in UI tables should use prefixed formats (e.g., `#TENANT-`, `#TX-`) where the module pattern requires it.
- Domain labels (status/action/payment method) must come from centralized constants, not inline literals.

## 9) Accessibility and UX Quality Baseline

- All actionable controls must be keyboard reachable.
- Inputs must have labels or equivalent accessible name.
- Error/status messaging should be announced appropriately (`aria-live` strategy where used).
- Preserve focus behavior for auth and form flows (autofocus only where intentional).
- Keep print/export views legible and consistent with report use-cases.

## 10) Routing and Navigation Conventions

- Route definitions and labels align with `src/lib/navItems.js`.
- Keyboard navigation mappings align with `src/lib/keyboardNav.js` and related helpers.
- Avoid keybinding conflicts with browser defaults (`Ctrl+P`, `Ctrl+R` reserved).
- Keep route aliases intentional and documented (e.g., `/signin` alias behavior).

## 11) Naming, Formatting, and Commenting

### Naming

- Use domain-explicit names aligned with SRS language.
- Prefer intent-focused names over technical shorthand.

### Formatting

- Follow existing project lint/formatter conventions.
- Keep components and pages cohesive; split large modules by concern.
- Prefer guard clauses over nested conditionals.

### Commenting

Use comments for intent and constraints, not obvious narration.

- Good: explain role-specific behavior or invariant rationale.
- Avoid: restating JSX/JS that is already clear.

## 12) Module Blueprint (Frontend)

For each module (`tenants`, `rooms`, `contracts`, `billing`, `payments`, `reports`, etc.):

- `page.js` (route composition)
- optional feature-local components
- shared UI usage from `_components/ui`
- API calls via `apiRequest`
- constants/formatters reused from `src/lib`
- tests for critical logic and schema/constant alignment where applicable

## 13) PR Review Gate (Frontend)

A frontend PR is merge-ready only if all are true:

- Data access uses centralized API client (no ad hoc transport duplicates).
- Role behavior is consistent (Admin/Staff/Viewer) for touched flows.
- Labels/status mappings use centralized constants.
- Error/empty/loading states are explicit and user-readable.
- Accessibility is preserved for touched controls and forms.
- Route/nav behavior remains consistent with module map.
- Tests pass for touched frontend scope (plus any affected shared tests).
- No new lint/style issues are introduced.

## 14) Anti-Patterns to Reject

- Inline duplicated fetch/auth/error logic in pages/components.
- Hardcoded status labels or payment/action mappings.
- Components mixing heavy data orchestration and presentational complexity.
- Silent failure handling that hides backend validation context.
- Viewer role UI exposing write controls that should be blocked/hidden.
- Divergent naming that conflicts with SRS/SDD terminology.

## 15) Adoption Plan

Apply this blueprint in three phases:

1. New frontend code follows this standard immediately.
2. Touched files are opportunistically aligned during feature work.
3. Legacy pages/components are gradually refactored toward shared patterns and utilities.

## 16) Definition of Done (Frontend Change)

A frontend change is complete only when:

- Implementation follows this blueprint.
- Touched flows are role-safe and API-contract consistent.
- Tests/lint pass for affected scope.
- Documentation is updated if route/interaction contracts changed.

## 17) Validation Error Binding Contract (422)

To keep form behavior consistent across modules, frontend code must normalize backend 422 error keys into a deterministic field-error map.

### 17.1 Expected Input

- Backend validation payload shape:
  - `message`: string
  - `errors`: record of keys to array-of-messages
- Common key forms:
  - flat key: `email`, `room_code`
  - nested/indexed key: `line_items.0.amount`
  - wildcard contract key (docs-level): `line_items.*.amount`

### 17.2 Required Normalization Rules

1. Preserve exact keys for flat fields.
2. Support indexed nested keys by mapping to form field paths (for example `line_items.0.amount`).
3. Support wildcard-aware matching for dynamic arrays where form libraries track array indices.
4. Keep first error message per field for inline display; optionally keep full arrays for summaries.
5. Keep top-level `message` available for page-level `Alert`.
6. When suggestions are known (for example valid format/range), include corrective hints in field or summary copy.
7. For multi-error submit states, move focus to an error summary or first invalid field while preserving inline messages.

### 17.3 Recommended Helper Signature

Use a shared helper in `src/lib` (or shared form utility) rather than per-page custom parsing.

```javascript
// Suggested contract (implementation may vary)
export function normalizeValidationErrors(apiErrorPayload) {
  // returns:
  // {
  //   formMessage: string | null,
  //   fieldErrors: Record<string, string>,
  //   fieldErrorLists: Record<string, string[]>
  // }
}
```

### 17.4 Behavioral Guarantees

- Forms must never discard server-provided field-level details.
- Dynamic list fields (billing line items) must bind indexed keys predictably.
- Page-specific code may transform labels for display, but must not mutate payload keys.
- ## 18) High-Density Operational Standards (Command Center)

To maintain the "Command Center" aesthetic for HavenStay's operational modules, follow these specific density and typography rules:

### 18.1 Typography Tokens
- **Metadata Labels**: Use `text-[10px] font-black uppercase tracking-widest text-stone-400`.
- **Table Headers**: Use `text-[10px] font-black uppercase tracking-widest text-stone-400`.
- **KPI Labels**: Use `text-[11px] font-black uppercase tracking-widest`.

### 18.2 Mandatory Components
- **Navigation**: Use `PageHeaderActions` for all authenticated module pages. It handles back-navigation, role-badges, and primary CTAs in a unified layout.
- **Metrics**: Use `KpiCard` for index-level summaries and `MetricItem` (or standardized `DetailRow`) for profile metadata.
- **Transactional Transparency**: Always use `ResourceIdCell` for record identifiers (e.g., `#TENANT-123`) to ensure mono-spaced scannability.

### 18.3 Action Buttons
- **Primary CTAs**: Use `primaryLinkCtaClass`.
- **Secondary Actions**: Use `secondaryOutlineLinkClass`.
- **Spacing**: Form footers should use `flex-col-reverse sm:flex-row gap-3` with a padding of `pt-8` to separate from form sections.
