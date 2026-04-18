# HavenStay Form Pages Playbook

Route-by-route form specifications for all write-enabled pages.

This playbook is authoritative for form behavior and field contracts, and must be used together with:
- `design-system/havenstay/MASTER.md` (visual system and component standards)
- `docs/SRS.md` (functional requirements and business rules)
- `docs/API_REFERENCE.md` (endpoint contracts and role access)
- `backend/database/sql/havenstay_schema.sql` (canonical field and enum source)

---

## 1) Shared Form Theme (All Form Routes)

### 1.1 Layout and Components
- Use one outer column wrapper: `mx-auto w-full max-w-4xl space-y-6`.
- Keep `PageHeader`, form cards, page-level `Alert`, and submit/cancel bar inside the same wrapper.
- Use registry card sections (`rounded-2xl border-stone-200 shadow-sm`) with clear strip titles.
- Use shared controls only: `Field`, `Input`, `Select`, `Textarea`, `Button`.

### 1.2 Field and Validation UX
- Show visible labels for every field; placeholders must not be the primary label.
- Mark required fields consistently and show inline errors under the field.
- Keep user input after validation failures; never reset the form on a 422 response.
- Use specific errors: identify the exact field and correction needed.

### 1.3 Accessibility Baseline
- Keep labels and instructions visible (WCAG 2.2 SC 3.3.2).
- Identify input errors in text, not color-only cues (WCAG SC 3.3.1).
- Provide corrective suggestions when known (for example expected format), unless it weakens security (WCAG SC 3.3.3).
- Ensure keyboard focus visibility and minimum tap targets for primary actions.
- On submit failures with multiple errors, move focus to an error summary or first invalid field and keep inline errors on fields.

### 1.4 Domain Guardrails
- Do not add fields that are not in schema or API contract.
- Do not expose immutable forensic records (audit/transaction logs) as editable forms.
- Respect role gates from SRS/API: viewers are read-only.

---

## 2) Route-by-Route Form Contracts

## 2.1 `/login`

### Purpose
Authenticate user and establish session.

### Fields
| UI label | Key | Required | Source |
| :--- | :--- | :--- | :--- |
| Username | `username` | Yes | API `/api/auth/login` |
| Password | `password` | Yes | API `/api/auth/login` |

### Behavior
- Submit to `POST /api/auth/login`.
- Show clear auth failure message for invalid credentials or deactivated account (FR-004).
- Never prefill or log password content.

---

## 2.2 `/tenants/new` and `/tenants/[id]/edit`

### Purpose
Create or update tenant profile information (FR-008, FR-009).

### Fields (`tenants` table)
| UI label | Schema key | Required on create | Required on edit |
| :--- | :--- | :---: | :---: |
| First Name | `first_name` | Yes | Yes |
| Last Name | `last_name` | Yes | Yes |
| Contact Number | `contact_number` | Yes | Yes |
| Email | `email` | Yes | Yes |
| Emergency Contact Name | `emergency_contact_name` | Yes | Yes |
| Emergency Contact Number | `emergency_contact_number` | Yes | Yes |
| Address | `address` | Yes | Yes |

### Exclusions
- Do not expose `status` as a free-edit form control while lifecycle rules apply (BR-016).
- Lifecycle actions (deactivate/reactivate/archive/restore) must remain explicit actions, not inline form fields.

### Behavior
- Viewer role must not see submit actions.
- Keep emergency/contact labels user-friendly and non-technical.

---

## 2.3 `/rooms/new` and `/rooms/[id]/edit`

### Purpose
Create and maintain room metadata and operational setup (FR-012 to FR-015a).

### Fields (`rooms` table)
| UI label | Schema key | Required | Notes |
| :--- | :--- | :---: | :--- |
| Room Code | `room_code` | Yes | Must be unique |
| Room Type | `room_type` | Yes | Enum: `solo`, `shared` |
| Capacity | `capacity` | Yes | Integer >= 1 |
| Monthly Rate | `monthly_rate` | Yes | Decimal >= 0 |
| Room Status | `status` | Yes | Enum: `vacant`, `partially_occupied`, `fully_occupied`, `maintenance` |
| Amenities | `amenities` | No | Free text |
| Description | `description` | No | Free text |

### Bed-space Rules
- Bed spaces are managed by dedicated room workflows (e.g. add bed-space action), not mixed into base room fields.
- Solo room constraints must be respected by backend rules (BR-018).

---

## 2.4 `/contracts/new`

### Purpose
Create a tenant contract/check-in record (FR-016, FR-017, FR-017a).

### Fields (`contracts` table)
| UI label | Schema key | Required | Notes |
| :--- | :--- | :---: | :--- |
| Tenant | `tenant_id` | Yes | Must point to existing tenant |
| Bed Space | `bed_space_id` | Yes | Must be assignable/vacant under business rules |
| Move-in Date | `move_in_date` | Yes | Date |
| Expected Move-out Date | `expected_move_out_date` | No | Date |
| Security Deposit | `deposit_amount` | No | Decimal >= 0 |
| Monthly Rate Override | `monthly_rate_override` | No | Decimal >= 0 |
| Notes | `notes` | No | Free text |

### Exclusions
- Do not expose `created_by`; it is system-managed from authenticated actor.
- Do not expose `status` as user input on create; default lifecycle starts as active.

---

## 2.5 `/contracts/[id]/edit`

### Purpose
Update allowed contract metadata while preserving lifecycle constraints (FR-019c).

### Editable Fields
| UI label | Schema key | Editable |
| :--- | :--- | :---: |
| Expected Move-out Date | `expected_move_out_date` | Yes |
| Security Deposit | `deposit_amount` | Yes |
| Monthly Rate Override | `monthly_rate_override` | Yes |
| Notes | `notes` | Yes |

### Non-Editable in edit form
- `tenant_id`, `bed_space_id`, `move_in_date` should remain locked unless explicitly supported by backend policy.
- Move-out must use dedicated move-out action (`/contracts/{id}/move-out`) to preserve BR-005 and BR-005a integrity.

---

## 2.6 `/billing/new` and `/billing/generate`

### Purpose
Create manual billing cycles with itemized charges (FR-020, FR-021, BR-001, BR-003).

### Header Fields (`billing` table)
| UI label | Schema key | Required | Notes |
| :--- | :--- | :---: | :--- |
| Contract | `contract_id` | Yes | Active contract workflow |
| Billing Period Start | `billing_period_from` | Yes | Date |
| Billing Period End | `billing_period_to` | Yes | Date |
| Due Date | `due_date` | Yes | Date |

### Line Item Fields (`billing_line_items` table)
| UI label | Schema key | Required | Notes |
| :--- | :--- | :---: | :--- |
| Charge Type | `item_type` | Yes | Enum: `base_rent`, `utility`, `add_on`, `penalty`, `adjustment` |
| Description | `item_description` | Yes | Non-empty |
| Amount | `amount` | Yes | Non-zero |

### Rules
- Prevent duplicate billing cycle by contract and period (FR-022).
- Allow negative adjustment line items if backend supports them, but total billing result must not violate non-negative cycle total rule (FR-021b).

---

## 2.7 `/payments/new`

### Purpose
Record a payment against a billing record (FR-024 to FR-027a).

### Fields (`payments` table)
| UI label | Schema key | Required | Notes |
| :--- | :--- | :---: | :--- |
| Billing Record | `billing_id` | Yes | Existing billing cycle |
| Amount Paid | `amount_paid` | Yes | Decimal > 0 |
| Payment Date | `payment_date` | Yes | Date |
| Payment Method | `payment_method` | Yes | Enum: `cash`, `gcash`, `bank_transfer`, `other` |
| Reference Number | `reference_number` | No | Recommended for non-cash |
| Notes | `remarks` | No | Free text |

### Exclusions
- `processed_by`, `voided_at`, `voided_by`, and `void_reason` are system/workflow managed.
- Void is a separate destructive action, not an edit form (FR-026).

---

## 2.8 `/users/new`

### Purpose
Provision a new system account (Admin-only, FR-005 to FR-007).

### Fields (`users` table + auth contract)
| UI label | Schema key | Required | Notes |
| :--- | :--- | :---: | :--- |
| First Name | `first_name` | Yes | Text |
| Last Name | `last_name` | Yes | Text |
| Username | `username` | Yes | Unique |
| Email | `email` | Yes | Valid email |
| System Role | `role_id` | Yes | Admin/Staff/Viewer |
| Password | `password` | Yes | Required on create |

### Rules
- Page must be inaccessible to non-admin users.
- Keep role labels user-facing while preserving role IDs in payload.

---

## 2.9 `/users/[id]/edit`

### Purpose
Update account profile and role assignment for existing user (Admin-only).

### Editable Fields
| UI label | Schema key | Editable |
| :--- | :--- | :---: |
| First Name | `first_name` | Yes |
| Last Name | `last_name` | Yes |
| Username | `username` | Yes |
| Email | `email` | Yes |
| System Role | `role_id` | Yes |
| New Password | `password` | Optional |
| Account Active | `is_active` | Optional per policy |

### Notes
- If password is blank, preserve current password.
- Deactivate/archive workflows can remain explicit lifecycle actions depending on page implementation.

---

## 2.10 `/compliance/registry` (Appliance Master List)

### Purpose
Manage the master catalog of allowable additional items (FR-023b).

### Fields (`add_on_registry` table)
| UI label | Schema key | Required | Notes |
| :--- | :--- | :---: | :--- |
| Item Name | `item_name` | Yes | Unique title. |
| Default Monthly Rate | `default_monthly_rate` | Yes | Base rate in PHP. |
| Status | `is_active` | Yes | Boolean toggle. |

### Behavior
- Form usually in modal or inline registry card.
- Prevent deletion if item is ever linked to a contract (use archiving instead).

---

## 2.11 `/contracts/[id]/add-ons` (Association)

### Purpose
Attach specialized appliances to a specific lease with negotiated rates (FR-023c).

### Fields (`contract_add_ons` table)
| UI label | Schema key | Required | Notes |
| :--- | :--- | :---: | :--- |
| Appliance | `add_on_id` | Yes | Selected from registry. |
| Monthly Charge | `actual_rate` | Yes | Defaults to registry rate; editable. |

### Behavior
- Must show "Impact Preview": `Current Total -> New Total`.
- Once saved, the `actual_rate` is static for that contract even if the master registry changes.

---

## 2.12 `/rooms/[id]/meters` (Utility Reading)

### Purpose
Record periodic sub-meter values for electricity or water (FR-023a).

### Fields (`room_meter_readings` table)
| UI label | Schema key | Required | Notes |
| :--- | :--- | :---: | :--- |
| Utility Type | `utility_type` | Yes | `electric` or `water`. |
| Reading Date | `reading_date` | Yes | Defaults to today; no future dates. |
| Meter Value | `reading_value` | Yes | Precision Decimal(12,4). |

### Forensic Rules
- UI must highlight the "Previous Reading": [Value] on [Date].
- Validation: Value must be ≥ Previous Reading (Non-Regressive Rule).
- High Consumption Alert: Show warning if delta > historical avg.

---

## 2.13 `/billing/wizard` (Itemized Generation)

### Purpose
The authoritative workflow for generating monthly ledger entries with compliance association.

### Logic & Association
This is a composite form that pulls from multiple sources:
1. **Base Rent**: Injected from contract profile.
2. **Appliances**: Multiselect list of active add-ons for the period.
3. **Utilities**: Selection of unbilled meter readings (`reading_ids` array).

### Payload Data
| Component | Payload Logic |
| :--- | :--- |
| **Header** | Standard `billing` header (period & due date). |
| **Meter Readings** | `reading_ids` array (associations). |
| **Line Items** | Manual overrides or calculated deltas. |

---

## 3) Form Consistency QA Checklist

- [ ] Route has one clear page purpose and form title.
- [ ] Field labels are plain-language and match schema-backed meaning.
- [ ] No phantom fields outside schema/API contract.
- [ ] Required/optional states match business rules.
- [ ] Role restrictions match SRS access matrix.
- [ ] Inline field errors and top-level API errors are both present.
- [ ] Cancel/back behavior preserves user orientation.

---

## 4) API Payload and Error-Key Traceability

Use this table to keep frontend form bindings consistent with API 422 responses.
Rule: the `errors` object key should match the payload key sent for that field.

| Route | UI label | Payload key | Expected 422 error key |
| :--- | :--- | :--- | :--- |
| `/login` | Username | `username` | `username` |
| `/login` | Password | `password` | `password` |
| `/tenants/new`, `/tenants/[id]/edit` | First Name | `first_name` | `first_name` |
| `/tenants/new`, `/tenants/[id]/edit` | Last Name | `last_name` | `last_name` |
| `/tenants/new`, `/tenants/[id]/edit` | Contact Number | `contact_number` | `contact_number` |
| `/tenants/new`, `/tenants/[id]/edit` | Email | `email` | `email` |
| `/tenants/new`, `/tenants/[id]/edit` | Emergency Contact Name | `emergency_contact_name` | `emergency_contact_name` |
| `/tenants/new`, `/tenants/[id]/edit` | Emergency Contact Number | `emergency_contact_number` | `emergency_contact_number` |
| `/tenants/new`, `/tenants/[id]/edit` | Address | `address` | `address` |
| `/rooms/new`, `/rooms/[id]/edit` | Room Code | `room_code` | `room_code` |
| `/rooms/new`, `/rooms/[id]/edit` | Room Type | `room_type` | `room_type` |
| `/rooms/new`, `/rooms/[id]/edit` | Capacity | `capacity` | `capacity` |
| `/rooms/new`, `/rooms/[id]/edit` | Monthly Rate | `monthly_rate` | `monthly_rate` |
| `/rooms/new`, `/rooms/[id]/edit` | Room Status | `status` | `status` |
| `/rooms/new`, `/rooms/[id]/edit` | Amenities | `amenities` | `amenities` |
| `/rooms/new`, `/rooms/[id]/edit` | Description | `description` | `description` |
| `/contracts/new` | Tenant | `tenant_id` | `tenant_id` |
| `/contracts/new` | Bed Space | `bed_space_id` | `bed_space_id` |
| `/contracts/new` | Move-in Date | `move_in_date` | `move_in_date` |
| `/contracts/new` | Expected Move-out Date | `expected_move_out_date` | `expected_move_out_date` |
| `/contracts/new` | Security Deposit | `deposit_amount` | `deposit_amount` |
| `/contracts/new` | Monthly Rate Override | `monthly_rate_override` | `monthly_rate_override` |
| `/contracts/new` | Notes | `notes` | `notes` |
| `/contracts/[id]/edit` | Expected Move-out Date | `expected_move_out_date` | `expected_move_out_date` |
| `/contracts/[id]/edit` | Security Deposit | `deposit_amount` | `deposit_amount` |
| `/contracts/[id]/edit` | Monthly Rate Override | `monthly_rate_override` | `monthly_rate_override` |
| `/contracts/[id]/edit` | Notes | `notes` | `notes` |
| `/billing/new`, `/billing/generate` | Contract | `contract_id` | `contract_id` |
| `/billing/new`, `/billing/generate` | Billing Period Start | `billing_period_from` | `billing_period_from` |
| `/billing/new`, `/billing/generate` | Billing Period End | `billing_period_to` | `billing_period_to` |
| `/billing/new`, `/billing/generate` | Due Date | `due_date` | `due_date` |
| `/billing/new`, `/billing/generate` | Charge Type | `line_items.*.item_type` | `line_items.0.item_type` (indexed) |
| `/billing/new`, `/billing/generate` | Description | `line_items.*.item_description` | `line_items.0.item_description` (indexed) |
| `/billing/new`, `/billing/generate` | Amount | `line_items.*.amount` | `line_items.0.amount` (indexed) |
| `/payments/new` | Billing Record | `billing_id` | `billing_id` |
| `/payments/new` | Amount Paid | `amount_paid` | `amount_paid` |
| `/payments/new` | Payment Date | `payment_date` | `payment_date` |
| `/payments/new` | Payment Method | `payment_method` | `payment_method` |
| `/payments/new` | Reference Number | `reference_number` | `reference_number` |
| `/payments/new` | Notes | `remarks` | `remarks` |
| `/users/new` | First Name | `first_name` | `first_name` |
| `/users/new` | Last Name | `last_name` | `last_name` |
| `/users/new` | Username | `username` | `username` |
| `/users/new` | Email | `email` | `email` |
| `/users/new` | System Role | `role_id` | `role_id` |
| `/users/new` | Password | `password` | `password` |
| `/users/[id]/edit` | First Name | `first_name` | `first_name` |
| `/users/[id]/edit` | Last Name | `last_name` | `last_name` |
| `/users/[id]/edit` | Username | `username` | `username` |
| `/users/[id]/edit` | Email | `email` | `email` |
| `/users/[id]/edit` | System Role | `role_id` | `role_id` |
| `/users/[id]/edit` | New Password | `password` | `password` |
| `/users/[id]/edit` | Account Active | `is_active` | `is_active` |
| `/compliance/registry` | Item Name | `item_name` | `item_name` |
| `/compliance/registry` | Default Rate | `default_monthly_rate` | `default_monthly_rate` |
| `/rooms/[id]/meters` | Utility Type | `utility_type` | `utility_type` |
| `/rooms/[id]/meters` | Meter Value | `reading_value` | `reading_value` |
| `/billing/wizard` | Readings | `reading_ids` | `reading_ids` |

### Binding Notes
- For nested arrays like billing line items, backend validation keys are index-based (for example `line_items.0.amount`), so frontend field mapping should support wildcard-to-index resolution.
- Keep payload keys schema/API-accurate even when visible labels are friendlier.
- Global/top-level errors (for example `message`) must still render in page-level `Alert`.

---

## 5) External Verification Notes

This playbook aligns to commonly accepted form UX and accessibility standards:
- Nielsen Norman Group guidance on single-column forms, clear labels, and specific inline error handling.
- WCAG guidance for visible labels/instructions (SC 3.3.2) and text-based error identification (SC 3.3.1).

Implementation details remain governed by HavenStay architecture and business rules in SRS/API/schema.
