# ADR-004: Disposal of Broken `POST /api/tenants/{tenant}/reactivate` Route

> **Status**: `AWAITING HUMAN APPROVAL`  
> **Date**: September 25, 2026  
> **Deciders**: Systems Architect, Backend Lead  
> **Technical Scope**: API Routing, Tenant Controller, Architectural Convention Tests  

---

## Context

The backend API exposes RESTful endpoints for managing user accounts, rooms, tenants, contracts, and payments. For soft-deleted entities, archive and restore routes exist across resource types. In addition, user accounts (Admin, Staff, Viewer) support activation and deactivation via `UserService::deactivate` and `UserService::reactivate`.

---

## Problem

The route `POST /api/tenants/{tenant}/reactivate` is registered in `routes/api.php` line 58. However, neither `TenantController` nor `TenantService` defines a `reactivate()` method. Calling this route throws a `BadMethodCallException` resulting in an HTTP 500 server error. 

Furthermore, `TenantArchitectureConventionTest.php` line 32 asserts that `TenantService::reactivate()` exists, causing the unit convention test suite to fail out-of-the-box.

---

## Evidence

1. **Broken Route**: [routes/api.php L58](file:///home/markc/projects/active/havenstay/backend/routes/api.php#L58):
   ```php
   Route::post('{tenant}/reactivate', [TenantController::class, 'reactivate'])->withTrashed();
   ```
2. **Missing Controller Action**: [TenantController.php](file:///home/markc/projects/active/havenstay/backend/app/Http/Controllers/Api/TenantController.php) defines `store`, `show`, `update`, `archive`, and `restore`. It contains no `reactivate` method.
3. **Missing Service Method**: [TenantService.php](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/TenantService.php) contains no `reactivate()` method.
4. **Auto-Derived Status**: In HavenStay, tenant residency status (`onboarded`, `active`, `moved_out`, `archived`) is **automatically synchronized** based on contract history via `TenantService::syncStatus()`. Tenants are never manually "reactivated".
5. **Frontend Reality**: Frontend code ([tenants/[id]/page.js L102](file:///home/markc/projects/active/havenstay/frontend/src/app/(dashboard)/tenants/[id]/page.js#L102), [tenants/new/page.js L85](file:///home/markc/projects/active/havenstay/frontend/src/app/(dashboard)/tenants/new/page.js#L85)) exclusively calls `POST /api/tenants/{id}/restore`. Zero frontend code references `/reactivate`.
6. **Failing Test**: [TenantArchitectureConventionTest.php L32](file:///home/markc/projects/active/havenstay/backend/tests/Unit/TenantArchitectureConventionTest.php#L32) asserts:
   ```php
   $this->assertMatchesRegularExpression('/public static function reactivate\(User \$actor, Tenant \$tenant\): Tenant/', $content);
   ```

---

## Options Considered

### Option A: Remove the Dead Route & Align Convention Test (Recommended)
Delete `Route::post('{tenant}/reactivate')` from `routes/api.php`. Update `TenantArchitectureConventionTest.php` to assert the verified tenant lifecycle methods (`create`, `update`, `archive`, `restore`). Document that unarchiving a tenant is performed via `POST /api/tenants/{id}/restore`.
- *Consequences*: Eliminates broken 500 endpoint. Fixes unit test failure. Zero frontend impact.

### Option B: Implement `TenantController::reactivate` as an Alias to `restore()`
Add a `reactivate()` method to `TenantController` that forwards to `TenantService::restore()`.
- *Consequences*: Maintains the URL route at the cost of duplicate REST endpoints performing identical logic.

---

## Decision

**Proposed Decision**: Adopt **Option A**. Cleanly remove the dead route from `routes/api.php` and align `TenantArchitectureConventionTest.php`.

*(Subject to explicit human stakeholder approval).*

---

## Rationale

1. **Eliminate Dead Code**: The route was added erroneously when copying routes from `UserController` (where `reactivate` is valid for staff user accounts).
2. **Respect Domain Architecture**: Tenant status is not a manual boolean switch; it is auto-computed by `syncStatus()`. Soft-delete unarchiving belongs on `restore()`.
3. **Zero Consumer Breakage**: No frontend code, documentation example, or external client relies on `{tenant}/reactivate`.

---

## Consequences

### Positive
- Eliminates an unhandled 500 error route.
- Restores clean execution of `TenantArchitectureConventionTest`.
- Clarifies that `restore()` is the single authoritative action for unarchiving tenants.

### Negative / Trade-offs
- None.

---

## Rejected Alternatives

- **Option B (Alias to `restore`)**: Rejected because creating duplicate endpoints for identical operations violates REST principles and confuses API consumers.

---

## Acceptance Criteria

1. Calling `POST /api/tenants/1/reactivate` returns HTTP 404.
2. Calling `POST /api/tenants/1/restore` restores an archived tenant and triggers `TenantService::syncStatus()`.
3. `php artisan test --filter=TenantArchitectureConventionTest` passes with 0 failures.

---

## Related Requirements

- `REQ-022`: Tenant lifecycle and archival management
- `FR-014`: Tenant record archival and restoration

---

## Related Backlog Items

- `HS-BL-03`: Broken tenant reactivate route cleanup (Readiness Card approved for Phase 1, Slice 2).
