# HavenStay Page-Specific Design Specifications

This directory contains page-specific design overrides that supplement the Master design system file (`../MASTER.md`).

## Purpose

Page-specific files document **only the deviations** from the Master design system. They provide:
- Unique component specifications not covered in the Master
- Page-specific layout patterns
- Custom data calculations and API integrations
- Specialized interaction behaviors
- Page-specific validation rules

## Usage Logic

```
When building a page:
1. First, check if a page-specific file exists in this directory
2. If it exists, apply its rules (they OVERRIDE the Master)
3. For everything not specified in the page file, follow the Master
4. The Master file is the fallback for all unspecified rules
```

## Available Page Specifications

Use these files when changing routes listed below:

| Module | File | Route coverage |
|------|------|-------------------|
| Dashboard | `dashboard.md` | `/dashboard` |
| Tenants | `tenants.md` | `/tenants`, `/tenants/[id]`, `/tenants/new`, `/tenants/[id]/edit` |
| Rooms | `rooms.md` | `/rooms`, `/rooms/[id]`, `/rooms/new`, `/rooms/[id]/edit` |
| Contracts | `contracts.md` | `/contracts`, `/contracts/[id]`, `/contracts/new`, `/contracts/[id]/edit` |
| Billing | `billing.md` | `/billing`, `/billing/[id]`, `/billing/new`, `/billing/generate` |
| Payments | `payments.md` | `/payments`, `/payments/[id]`, `/payments/new` |
| Reports | `reports.md` | `/reports`, `/reports/*` |
| Users | `users.md` | `/users`, `/users/new`, `/users/[id]/edit` |
| Audit Trail | `audit_logs.md` | `/audit-logs` |
| Transaction Logs | `transaction_logs.md` | `/transaction-logs` |
| Login | `login.md` | `/login` |
| Form Pages Playbook | `FORM_PAGES.md` | `/login`, `/tenants/*`, `/rooms/*`, `/contracts/*`, `/billing/new`, `/billing/generate`, `/payments/new`, `/users/new`, `/users/[id]/edit` |

---

## File Structure

Each page-specific file follows this structure:

```markdown
# [Page Name] Design Specification

> Metadata (project, date, routes)
> Override warning

## Page Purpose
Brief description of the page's role and goals

## Layout Structure
Visual representation of page sections

## Component Overrides
Detailed specifications for page-specific components

## Data Calculations
Formulas and logic for page-specific metrics

## API Integration
Endpoints, fallback logic, error handling

## Animation Specifications
Page-specific motion patterns

## Responsive Breakpoints
Mobile, tablet, desktop behaviors

## Accessibility Requirements
Page-specific a11y checklist

## Anti-Patterns
Page-specific things to avoid

## Z-Index Scale
Page-specific layering rules
```

---

## Design System Hierarchy

```
MASTER.md (Foundation)
    ↓
    Defines global rules:
    - Color system
    - Typography
    - Spacing
    - Component base styles
    - Interaction patterns
    - Accessibility standards
    
    ↓
    
pages/[page-name].md (Overrides)
    ↓
    Defines page-specific rules:
    - Unique component variants
    - Page-specific layouts
    - Custom calculations
    - Specialized behaviors
```

---

## When to Create a New Page File

Create a page-specific file when:

1. **Unique Component Variants** - The page needs component styling that differs from the Master
2. **Complex Data Logic** - The page has calculations or transformations not covered elsewhere
3. **Specialized Interactions** - The page has unique user flows or behaviors
4. **Custom Validation** - The page has form validation rules specific to its domain
5. **API Integration Patterns** - The page has unique API handling or fallback logic

**Do NOT create a page file if:**
- The page follows all Master specifications without deviation
- The only differences are content/copy changes
- The page is a simple variation of an existing pattern

---

## Maintenance Guidelines

### Updating Page Files

1. **Document the reason** - Always explain WHY an override exists
2. **Reference the Master** - Link to Master sections being overridden
3. **Keep it minimal** - Only document deviations, not repetitions
4. **Update timestamps** - Change "Last Updated" date when modifying
5. **Test thoroughly** - Verify overrides don't break Master patterns

### Reviewing Page Files

Before approving a page file update:
- [ ] Overrides are justified and necessary
- [ ] Master file is referenced for context
- [ ] Code examples are accurate and tested
- [ ] Accessibility requirements are maintained
- [ ] Responsive behaviors are specified
- [ ] Anti-patterns are documented

---

## Completeness Checks

Before signing off changes to `design-system/havenstay`:

- [ ] Each active frontend route has a matching page spec or explicit note that Master-only rules apply.
- [ ] Page titles and subtitles match `MASTER.md` §21 exactly.
- [ ] Labels use plain language and avoid internal/technical jargon.
- [ ] API endpoint examples align with `docs/API_REFERENCE.md`.
- [ ] Role behavior and permissions align with `docs/SRS.md`.
- [ ] Accessibility guidance aligns with WCAG 2.2 expectations in `MASTER.md`.
- [ ] Form pages follow `FORM_PAGES.md` shared theme and page-specific field contracts.

---

## Entity Form and Detail Coverage Matrix

Source of truth used for this matrix:
- `backend/database/sql/havenstay_schema.sql` (entities and fields)
- `docs/SRS.md` (required capabilities per module)
- `frontend/src/app/**/page.js` (actual implemented routes)

| Entity (schema table) | List view | Detail view | Create form | Edit form | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Users (`users`) | `/users` | No standalone detail route | `/users/new` | `/users/[id]/edit` | Admin-only management pattern; edit page acts as profile detail context. |
| Tenants (`tenants`) | `/tenants` | `/tenants/[id]` | `/tenants/new` | `/tenants/[id]/edit` | Full list/detail/create/edit coverage documented in `tenants.md`. |
| Rooms (`rooms`, `bed_spaces`) | `/rooms` | `/rooms/[id]` | `/rooms/new` | `/rooms/[id]/edit` | Full list/detail/create/edit coverage documented in `rooms.md`. |
| Contracts (`contracts`) | `/contracts` | `/contracts/[id]` | `/contracts/new` | `/contracts/[id]/edit` | Full list/detail/create/edit coverage documented in `contracts.md`. |
| Billing (`billing`, `billing_line_items`) | `/billing` | `/billing/[id]` | `/billing/new` and `/billing/generate` | No edit route (status update flow only) | Create + detail pattern; updates handled by status/actions, not a full edit form. |
| Payments (`payments`) | `/payments` | `/payments/[id]` | `/payments/new` | No edit route (void workflow) | Create + detail pattern; correction handled through void/re-post workflow. |
| Audit logs (`audit_logs`) | `/audit-logs` | In-page detail modal | Not applicable | Not applicable | Immutable forensic records by design. |
| Transaction logs (`transaction_logs`) | `/transaction-logs` | In-page run-detail modal | Not applicable | Not applicable | Immutable workflow records by design. |

### Coverage Rules

- If a module intentionally has no edit page, the page spec must explicitly state the alternative workflow (for example: status action, void/re-post, or immutable records).
- Form and detail field labels should map to schema-backed concepts from `havenstay_schema.sql`, but use user-friendly wording in UI copy.

---

## Schema-to-UI Field Mapping (Forms and Details)

Use this as the canonical mapping reference for add/edit/detail screens.  
Schema names must follow `backend/database/sql/havenstay_schema.sql`; labels must remain user-friendly.

| Module | Schema field(s) | Suggested form/detail UI label |
| :--- | :--- | :--- |
| Users | `first_name`, `last_name` | First Name, Last Name |
| Users | `username` | Username |
| Users | `email` | Email |
| Users | `role_id` | System Role |
| Users | `is_active` | Account Status / Account is active |
| Tenants | `first_name`, `last_name` | First Name, Last Name |
| Tenants | `contact_number` | Contact Number |
| Tenants | `email` | Email |
| Tenants | `emergency_contact_name`, `emergency_contact_number` | Emergency Contact Name, Emergency Contact Number |
| Tenants | `address` | Address |
| Tenants | `status` | Status |
| Rooms | `room_code` | Room Code |
| Rooms | `room_type` | Room Type |
| Rooms | `capacity` | Capacity |
| Rooms | `monthly_rate` | Monthly Rate |
| Rooms | `status` | Room Status |
| Rooms | `amenities`, `description` | Amenities, Description |
| Bed Spaces | `bed_label`, `status` | Bed Label, Bed Status |
| Contracts | `tenant_id`, `bed_space_id` | Resident, Bed Space |
| Contracts | `move_in_date`, `expected_move_out_date`, `actual_move_out_date` | Move-in Date, Expected Move-out Date, Actual Move-out Date |
| Contracts | `deposit_amount`, `monthly_rate_override` | Security Deposit, Monthly Rate Override |
| Contracts | `status`, `notes` | Contract Status, Notes |
| Billing | `contract_id` | Contract |
| Billing | `billing_period_from`, `billing_period_to` | Billing Period (From), Billing Period (To) |
| Billing | `due_date`, `status` | Due Date, Billing Status |
| Billing Line Items | `item_type`, `item_description`, `amount` | Charge Type, Description, Amount |
| Payments | `billing_id` | Billing Record |
| Payments | `amount_paid`, `payment_date` | Amount Paid, Payment Date |
| Payments | `payment_method`, `reference_number` | Payment Method, Reference Number |
| Payments | `remarks`, `void_reason`, `voided_at` | Notes, Void Reason, Voided At |

### Mapping Notes

- When the UI uses clearer wording (for example, **Resident** instead of `tenant_id`), preserve the schema key in API payloads and docs.
- For contracts, use `expected_move_out_date` as the canonical schema field name in documentation, even if UI text says **Expected Move-out**.
- Billing and payments are correction-sensitive domains; detail views should always expose status and date fields clearly.

---

## Route Parity Snapshot

Snapshot basis: `frontend/src/app/**/page.js` (49 route files discovered).

| Frontend route pattern | Design-system coverage | Source |
| :--- | :--- | :--- |
| `/dashboard` | Covered | `dashboard.md` |
| `/login` | Covered | `login.md` |
| `/tenants`, `/tenants/[id]`, `/tenants/new`, `/tenants/[id]/edit` | Covered | `tenants.md` |
| `/rooms`, `/rooms/[id]`, `/rooms/new`, `/rooms/[id]/edit` | Covered | `rooms.md` |
| `/contracts`, `/contracts/[id]`, `/contracts/new`, `/contracts/[id]/edit` | Covered | `contracts.md` |
| `/billing`, `/billing/[id]`, `/billing/new`, `/billing/generate` | Covered | `billing.md` |
| `/payments`, `/payments/[id]`, `/payments/new` | Covered | `payments.md` |
| `/reports` and report children (`/reports/*`) | Covered | `reports.md` |
| `/users`, `/users/new`, `/users/[id]/edit` | Covered | `users.md` |
| `/audit-logs` | Covered | `audit_logs.md` |
| `/transaction-logs` | Covered | `transaction_logs.md` |
| `/` (app root page) | Master-only / Not explicitly documented in pages | `../MASTER.md` |

### Notes

- `reports.md` intentionally covers sub-routes via `/reports/*` (including `occupancy`, `occupancy-status`, `active-contracts`, `tenant-history`, `tenant-ledger`, and others).
- Duplicate path entries can appear in glob output because of mixed slash styles on Windows; parity decisions above use normalized route paths.

---

## Contributing

When adding a new page specification:

1. Copy the template structure from an existing page file
2. Fill in all required sections
3. Document only the deviations from the Master
4. Include code examples for complex overrides
5. Add the page to the Quick Reference table above
6. Update this README with the new page entry

---

*For global design system rules, always refer to `../MASTER.md` first.*
