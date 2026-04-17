# HavenStay Backend Coding Blueprint

Version: 1.0  
Status: Proposed standard for consistent Controller-Service-Model implementation  
Scope: `backend/` Laravel API

## 1) Purpose

This blueprint defines the coding conventions, patterns, and guardrails for HavenStay backend modules. It operationalizes `docs/SRS.md` (what) and `docs/SDD.md` (how) into a repeatable implementation style that prioritizes maintainability, readability, and consistency.

This document is normative for backend changes unless a module-specific exception is approved and documented.

## 2) Architectural Baseline (Non-Negotiable)

- Keep the three-tier architecture intact: UI -> API -> DB.
- Keep strict separation of concerns:
  - Controllers: transport boundary (authorize, validate, delegate, map response).
  - Services: business rules, workflow orchestration, transactions, domain invariants.
  - Models: schema mapping, relationships, casts, minimal computed accessors.
- Use `AuthorizationService` as the only RBAC authority.
- Keep canonical schema authority in `db/havenstay_schema.sql`.
- Preserve CCR constraints, especially transaction logging and trigger-based auditing.

## 3) Layer Responsibilities

### 3.1 Controllers (`app/Http/Controllers/Api`)

Controllers must only do the following:

1. Resolve actor from request.
2. Call the relevant `AuthorizationService::can*()` check.
3. Validate request payload shape.
4. Call one service method.
5. Return a standardized JSON response.

Controllers must not:

- Implement domain workflows (check-in, move-out, billing recomputation, etc.).
- Perform direct Eloquent writes (`create`, `update`, `delete`, `restore`).
- Build complex query logic that belongs to services.
- Read/write auth state globally inside services through controller side effects.

### 3.2 Services (`app/Services`)

Services are the domain core. They must:

- Enforce business rules from `SRS` and `SDD`.
- Own transaction boundaries for multi-table writes.
- Manage audit and correlation context for write workflows.
- Raise domain errors with `ValidationException::withMessages()` when invariants fail.
- Return model instances or structured arrays that controllers can map.

Services must not:

- Depend on `Auth::id()` / `Auth::user()` for write actor context.
- Return HTTP responses or status codes.
- Duplicate authorization policy logic already owned by `AuthorizationService`.

### 3.3 Models (`app/Models`)

Models should be thin data contracts:

- Explicit `$table`, `$primaryKey`, `$fillable`, casts.
- Relationships and narrowly scoped computed attributes.
- Domain constants for status/type strings to avoid magic values.

Models must not:

- Contain workflow orchestration.
- Embed cross-entity business policies better suited to services.

## 4) Standard Method Signatures

Write operations in services must include actor as first parameter:

```php
public static function create(User $actor, array $data): Contract
public static function update(User $actor, Contract $contract, array $data): Contract
public static function archive(User $actor, Room $room): void
```

Read/query operations may omit actor unless access-sensitive filtering is required:

```php
public static function list(array $filters = []): LengthAwarePaginator
public static function show(int $id): ?Tenant
```

## 5) Mandatory Write Workflow Pattern

Every critical write workflow (contracts, occupancy, billing, payments, archive/restore) must follow this sequence:

1. `TransactionService::logStarted(...)`
2. `AuditService::setAuditUserContext($actor->user_id)`
3. `AuditService::setCorrelationContext($tx['correlation_id'])`
4. `DB::transaction(function () { ... })`
5. `TransactionService::logCommitted(...)` on success
6. `TransactionService::logRolledBack(...)` on exception
7. `AuditService::clearCorrelationContext()` in `finally`

Reference implementation skeleton:

```php
public static function execute(User $actor, array $data): ModelType
{
    $tx = TransactionService::logStarted(
        'operation_name',
        $data['reference'] ?? null,
        $actor->user_id,
        ['input' => $data]
    );

    AuditService::setAuditUserContext($actor->user_id);
    AuditService::setCorrelationContext($tx['correlation_id']);

    try {
        $result = DB::transaction(function () use ($actor, $data) {
            // Domain validation + writes
            return $entity;
        });

        TransactionService::logCommitted($tx['tx_log_id'], [
            'result_id' => $result->getKey(),
        ]);

        return $result;
    } catch (\Throwable $e) {
        TransactionService::logRolledBack($tx['tx_log_id'], $e->getMessage());
        throw $e;
    } finally {
        AuditService::clearCorrelationContext();
    }
}
```

## 6) Validation and Domain Rules

- Keep field-shape validation in controllers via `$request->validate(...)`.
- Keep cross-entity/domain validation in services (overlaps, lifecycle, financial rules).
- Use field-level validation messages for client-correctable errors.
- Enforce deterministic status logic in one authority method per domain:
  - Room/bed occupancy sync authority.
  - Billing status recalculation authority.
- Never duplicate status priority logic across modules.

## 7) Authorization Convention

- Perform authorization checks in controllers before service calls.
- On deny, always write access-denied audit events consistently.
- Use the shared controller helper trait `app/Http/Concerns/HandlesAuthorization.php`:
  - Use `forbidden(...)` for JSON endpoints.
  - Use `forbiddenExport(...)` for export/stream endpoints.
- Avoid direct `AuditService::logAccessDenied(...)` calls in controllers that already use the trait.
- Use one unauthorized response shape and phrasing across all modules.
- Avoid policy drift:
  - Do not mix alternative permission helpers as primary checks.
  - Keep all role capability semantics in `AuthorizationService`.

## 8) API Response and Error Convention

Use consistent JSON envelopes:

Success:

```json
{
  "message": "Contract created successfully.",
  "data": { "...": "..." }
}
```

List:

```json
{
  "message": "Contracts retrieved successfully.",
  "data": [/* ... */],
  "meta": { "page": 1, "per_page": 15, "total": 120 }
}
```

Validation error (422):

```json
{
  "message": "Validation failed.",
  "errors": {
    "field_name": ["Reason message"]
  }
}
```

Authorization error:

- `401` for unauthenticated.
- `403` for authenticated but not allowed.
- Keep error copy concise and role-aware.

## 9) Query and Reporting Conventions

- Keep reporting consistency via canonical `vw_*` views when defined.
- Keep list/query composition in services (filters, sorting, pagination).
- Apply required SQL semantics (`AND`/`OR`/`BETWEEN`/`LIKE`) through query builders.
- Respect soft-void and archival semantics in financial and historical computations.
- Use read/write connection strategy aligned with primary-replica design.

## 10) Naming, Formatting, and Commenting

### Naming

- Use domain-explicit names that match SRS/SDD terminology.
- Prefer intent names over technical names:
  - `moveOutTenant()` over `updateContractStatus()`.
- Keep constants centralized for statuses and state labels.

### Formatting

- Follow Laravel/PHP-CS-Fixer style and PSR-12 spacing.
- Keep methods short and cohesive.
- Prefer guard clauses over deep nesting.

### Commenting

Use comments only for intent, invariants, and non-obvious constraints:

- Good: explain why a rule exists or why ordering matters.
- Avoid: narrating obvious line-by-line code behavior.

Recommended comment categories:

- Invariant comments: "Contract must remain unique per active bed space."
- Forensic comments: explain why transaction log is outside DB transaction.
- Compatibility comments: explain SQLite/MySQL behavioral differences when required.

## 11) Module File Blueprint

For each domain module, align to this structure:

- `Controller`: endpoint transport and mapping.
- `Service`: workflows and domain logic (authoritative).
- `Model`: schema contract and relationships.
- `Feature tests`: happy path + role + boundary + rollback.
- `Unit tests`: pure domain helpers / enum alignment / invariant logic.

## 12) PR Review Gate (Backend)

A backend PR is merge-ready only if all are true:

- Controller contains no direct domain writes.
- Service write methods accept `User $actor` first.
- No `Auth::*` calls inside service write workflows.
- Multi-table writes use explicit transaction + tx log + audit context pattern.
- Authorization checks are centralized and consistent.
- Response and error shapes match API conventions.
- Schema semantics align with `db/havenstay_schema.sql`.
- Tests cover success, authorization deny, validation fail, and rollback path.
- Architecture convention tests pass for touched modules (or are updated when conventions evolve):
  - `TenantArchitectureConventionTest`
  - `RoomArchitectureConventionTest`
  - `ContractArchitectureConventionTest`
  - `BillingPaymentArchitectureConventionTest`
  - `ReportingSecurityConventionTest`
  - `ControllerAuthorizationConsistencyTest`

## 13) Anti-Patterns to Reject

- Fat controllers with query + business logic.
- Service methods with hidden auth dependencies (`Auth::id()`).
- Duplicated status logic in multiple files.
- Direct mutation of forensic logs (`audit_logs`, `transaction_logs`).
- Inconsistent unauthorized/error messaging between modules.
- Domain terms that conflict with SRS/SDD language.

## 14) Adoption Plan

Apply this blueprint in three phases:

1. New code immediately follows this standard.
2. Touched files are opportunistically aligned during feature work.
3. Legacy hotspots (controller-heavy modules) are refactored into service-owned workflows with regression tests.

## 15) Definition of Done (Backend Change)

A backend change is complete only when:

- Implementation follows this blueprint.
- Tests pass for touched backend modules.
- Documentation is updated when behavior/contracts changed.
- No new lint/style issues are introduced.

