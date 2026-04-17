# Module Scorecard — Tenants (HavenStay BHMS)

**Review ID:** HS-MOD-TENANTS-2026-04-17  
**Date:** 2026-04-17  
**Scope:** Tenants module — data return, filters, CRUD integrity, RBAC, NFR-015  
**Baseline docs:** `docs/SRS.md`, `docs/SDD.md`, `docs/API_REFERENCE.md`, `docs/TEST_PLAN.md`

---

## Executive verdict

| Metric | Value |
| :--- | :--- |
| **Audit verdict** | **PASS** |
| **Module score** | **4.8 / 5.0** |
| **Risk level** | Low (residual notes below) |

The Tenants module is **highly compliant** with functional expectations and follows established backend patterns (service-layer writes, controller-level authorization, response shaping). **NFR-015** masking is applied consistently for the **Viewer** role on list and detail paths via `PiiMaskingService` and `TenantController`.

---

## Technical audit highlights

### 1. PII masking (NFR-015)

- **`PiiMaskingService`** redacts sensitive attributes (e.g. physical address, emergency contacts) and applies partial masking for phone and email for **Viewer**.
- Enforcement is at the **API boundary**: `TenantController` applies masking on **`index`**, **`search`**, and **`show`** after data retrieval, so list and search payloads match detail semantics.

**Evidence:** `backend/app/Services/PiiMaskingService.php`, `backend/app/Http/Controllers/Api/TenantController.php`, `backend/tests/Feature/TenantManagementTest.php` (TC-PII-001).

### 2. Optimized filtering and “rich” directory rows

- **`TenantService::searchRichBuilder`** augments tenant queries with:
  - **`vw_active_contracts`** (current room / bed context),
  - **`vw_billing_summary`** (aggregated outstanding balance via `COALESCE(SUM(...))`),
  - plus a subquery for **pending move-outs** in the summary path.

This keeps the tenant directory aligned with **FR-011** (occupancy context and balance) without pushing heavy ad-hoc joins into controllers.

**Evidence:** `backend/app/Services/TenantService.php` (see `searchRichBuilder`).

### 3. CRUD safety — archive vs active contract

- **Archive** is refused when an **active contract** exists (`TenantService::hasActiveContract` / `TenantController::archive`), preventing historical/financial inconsistency before a proper move-out.
- This aligns with **FR-009** (tenant lifecycle and audit integrity).  
  *(SRS **BR-020** in the current baseline refers to **manual penalty/late fees** in Release 1, not tenant archive; the archive guard is best traced to **FR-009** + operational policy.)*

**Evidence:** `backend/app/Http/Controllers/Api/TenantController.php`, `backend/app/Services/TenantService.php`.

### 4. RBAC

- **Writes** (create, update, deactivate, archive, restore) require **Admin** or **Staff** via `AuthorizationService` + `AuditService::logAccessDenied` on denial.
- **Reads** use **`canViewTenants`** for directory and summary access; **Viewer** receives masked PII as above.
- Frontend should continue to mirror capabilities with `canManageTenants` / `canViewTenants` helpers to avoid confusing empty states.

**Evidence:** `backend/app/Http/Controllers/Api/TenantController.php`, `frontend/src/lib/auth.js`.

---

## Implementation update (post-review alignment)

The following corrective changes were applied after this review to close identified drift risks:

- `TenantService::deactivate` now blocks status transitions when active contracts exist (BR-005b / BR-016 guard consistency).
- `TenantService::searchRichBuilder` now applies deterministic default ordering for stable paginated results.
- Tenant directory now renders outstanding balance in the table UI and resets pagination on filter-chip clear actions.
- Tenant detail now uses shared lifecycle UI controls for deactivate/reactivate/archive/restore with consistent guard messaging.
- Coverage expanded in `TenantManagementTest` for deactivate guard, list/search rich field shape, and viewer masking on list/search.

---

## Residual notes (non-blocking)

| Topic | Note |
| :--- | :--- |
| **Search PII in LIKE** | Viewer search still hits DB on raw columns; masking applies **after** fetch — acceptable for Release 1; stricter designs can restrict Viewer search fields in a later hardening pass. |
| **Terminology** | Keep internal reviews aligned with SRS IDs: archive blocking → **FR-009**; penalty automation scope → **BR-020**. |

---

## Traceability (quick map)

| Topic | SRS / NFR | Primary implementation |
| :--- | :--- | :--- |
| Tenant CRUD + archive | FR-008–011, FR-009 | `TenantController`, `TenantService` |
| Rich search / balance | FR-011 | `TenantService::searchRichBuilder`, views |
| Viewer PII | NFR-015 | `PiiMaskingService`, `TenantController` |
| Tests | TC-PII-001, TC-TENANT-* | `TenantManagementTest.php` |

---

## Sign-off (optional)

| Role | Name | Date |
| :--- | :--- | :--- |
| Review lead | | |
| Engineering | | |

**Final notes:** Score reflects strong alignment with requirements and patterns; remaining gap is mainly documentation ID precision (BR-020 vs FR-009) for defense Q&A.
