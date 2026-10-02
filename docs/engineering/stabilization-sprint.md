# HavenStay — Stabilization Sprint Plan (Phase 1)

> **Document Type**: Engineering Sprint Plan  
> **Status**: Official Stabilization Plan  
> **Date**: September 25, 2026  
> **Sprint Goal**: *Restore verified architectural, database, testing, CI, and documentation consistency without introducing new product behavior.*  
> **Operating Mode**: Isolated Vertical Slices, Test-Driven Verification, Strict Scope Enclosure  

---

## 1. Stabilization Scope Boundaries

### In Scope (Verified Defects & Consistency Alignments)
The stabilization sprint is strictly bounded to the 7 verified engineering backlog items organized into 5 sequential vertical slices:

* **Slice 1: Database & Model Parity**
  * `HS-BL-01`: Payment remarks schema, `$fillable`, and resource synchronization.
  * `HS-BL-02`: Canonical schema byte-for-byte synchronization (`avatar_url TEXT NULL` with LF endings).
* **Slice 2: Architectural Alignment & Route Cleanup**
  * `HS-BL-03`: Broken `{tenant}/reactivate` route disposal & convention test update.
  * `HS-BL-04`: Refactoring 4 stale controller authorization convention tests to verify FormRequests.
* **Slice 3: Automated Verification**
  * `HS-BL-05`: Authoring comprehensive automated Pest feature tests for `HandleIdempotency`.
* **Slice 4: CI/CD Parity**
  * `HS-BL-06`: Adding `mysql:8.4` service container to GitHub Actions workflow.
* **Slice 5: Documentation Synchronization**
  * `HS-BL-07`: Synchronizing `CLAUDE.md` and `README.md` with verified code signatures and states.

---

### Out of Scope (Explicitly Excluded from Stabilization)

The following areas are strictly **OUT OF SCOPE** for this sprint to prevent scope creep, regression risks, and unverified assumptions:

* ❌ **No New Product Features**: No new dashboards, wizards, or export buttons.
* ❌ **No Bulk Billing Workflows**: SRS explicitly defers bulk monthly billing generation.
* ❌ **No New Bed Space States**: Do NOT add `reserved` or `archived` to bed spaces enum; maintain existing `vacant`, `occupied`, `maintenance`.
* ❌ **No Meter Dial Schema Redesign**: Do NOT add `dial_capacity` to meters table; keep research spike `RES-02` open for facility hardware inspection.
* ❌ **No Legal Cap Implementation**: Do NOT hardcode a 7% renewal rent-increase cap; keep research spike `RES-01` open for DHSUD legal clarification.
* ❌ **No Monetary Architecture Rewrite**: Do NOT rewrite currency calculations to `BCMath` or integer cents; maintain verified `- 0.01` float tolerances.
* ❌ **No Token Expiration Redesign**: Do NOT implement sliding-window session token renewal; maintain 120-minute Sanctum baseline.
* ❌ **No Unrelated Refactoring**: Do NOT rename existing variables, reformat unaffected files, or reorganize directory hierarchies.

---

## 2. Slice Breakdown & Execution Sequence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   STABILIZATION SPRINT DEPENDENCY GRAPH                     │
│                                                                             │
│   [Slice 1: DB & Model Parity]                                              │
│   HS-BL-01 (Remarks) + HS-BL-02 (Avatar DDL)                                │
│          │                                                                  │
│          ▼                                                                  │
│   [Slice 2: Architectural Alignment]                                        │
│   HS-BL-03 (Route Clean) + HS-BL-04 (Convention Tests)                     │
│          │                                                                  │
│          ▼                                                                  │
│   [Slice 3: Automated Verification]                                         │
│   HS-BL-05 (Idempotency Tests)                                              │
│          │                                                                  │
│          ▼                                                                  │
│   [Slice 4: CI/CD Parity]                                                   │
│   HS-BL-06 (MySQL 8.4 Container in GitHub Actions)                          │
│          │                                                                  │
│          ▼                                                                  │
│   [Slice 5: Documentation Synchronization]                                  │
│   HS-BL-07 (CLAUDE.md & README.md Update)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Slice 1: Database & Model Parity

* **Objective**: Ensure canonical schema files and Eloquent models perfectly mirror each other, eliminating silent data loss.
* **Dependencies**: Stakeholder approval of [DEC-01](file:///home/markc/projects/active/havenstay/docs/decisions/decision-register.md#dec-01-payment-remarks-field-naming--persistence).
* **Work Items**:
  1. `HS-BL-01`:
     - Add `remarks VARCHAR(255) NULL` before `idempotency_key` in `db/havenstay_schema.sql`.
     - Add `remarks VARCHAR(255) NULL` before `idempotency_key` in `backend/database/sql/havenstay_schema.sql`.
     - Add `'remarks'` to `$fillable` array in `backend/app/Models/Payment.php`.
     - Update `PaymentResource.php` line 32 to export `'remarks' => $this->remarks, 'notes' => $this->remarks`.
     - Author feature test `PaymentRemarksPersistenceTest.php`.
  2. `HS-BL-02`:
     - Standardize line 70 in `db/havenstay_schema.sql` to `avatar_url TEXT NULL`.
     - Normalize line endings of `db/havenstay_schema.sql` to standard Unix LF.
     - Verify `diff -u db/havenstay_schema.sql backend/database/sql/havenstay_schema.sql` returns 0.
* **Verification Gate**:
  - `git diff db/ havenstay_schema.sql` shows identical files.
  - New test `PaymentRemarksPersistenceTest` passes.

---

### Slice 2: Architectural Alignment & Route Cleanup

* **Objective**: Eliminate dead 500 routes and align unit convention tests with modern FormRequest authorization architecture.
* **Dependencies**: Stakeholder approval of [DEC-04](file:///home/markc/projects/active/havenstay/docs/decisions/decision-register.md#dec-04-disposal-of-broken-post-apitenantstenantreactivate-route).
* **Work Items**:
  1. `HS-BL-03`:
     - Remove `Route::post('{tenant}/reactivate', [TenantController::class, 'reactivate'])->withTrashed();` from `backend/routes/api.php`.
     - Remove `reactivate` regex assertion from `backend/tests/Unit/TenantArchitectureConventionTest.php`.
  2. `HS-BL-04`:
     - Refactor `BillingPaymentArchitectureConventionTest.php` to assert authorization in FormRequests (`StorePaymentRequest`, etc.).
     - Refactor `RoomArchitectureConventionTest.php` to assert authorization in FormRequests (`StoreRoomRequest`, etc.).
     - Refactor `ReportingSecurityConventionTest.php` to assert authorization in FormRequests (`ViewReportsRequest`, etc.).
     - Refactor `UserAuthArchitectureConventionTest.php` to assert `UserService::deactivate` instead of stale `archive`.
* **Verification Gate**:
  - `php artisan test --testsuite=Unit` passes 100% (9 of 9 tests green).
  - Calling `POST /api/tenants/1/reactivate` returns 404 instead of 500.

---

### Slice 3: Automated Verification

* **Objective**: Establish bulletproof automated test coverage for financial request idempotency.
* **Dependencies**: None.
* **Work Items**:
  1. `HS-BL-05`:
     - Author `backend/tests/Feature/Middleware/HandleIdempotencyTest.php` covering:
       - Safe requests (`GET`/`HEAD`) bypass cache locks.
       - Mutating requests (`POST`/`PUT`/`PATCH`/`DELETE`) acquire lock and replay identical responses.
       - Replay includes exact cached headers, status code, and JSON payload.
       - In-flight duplicate requests return HTTP 409 Conflict.
* **Verification Gate**:
  - `php artisan test --filter=HandleIdempotencyTest` passes with all edge cases green.

---

### Slice 4: CI/CD Parity

* **Objective**: Guarantee that all 45 MySQL triggers and CHECK constraints are continuously validated in GitHub Actions.
* **Dependencies**: Stakeholder approval of [DEC-05](file:///home/markc/projects/active/havenstay/docs/decisions/decision-register.md#dec-05-mysql-trigger-verification-strategy-in-github-actions-ci); Slices 1 and 2 completed.
* **Work Items**:
  1. `HS-BL-06`:
     - Update `.github/workflows/tests.yml` to provision a `mysql:8.4` service container.
     - Add environment variables (`DB_CONNECTION=mysql`, `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_DATABASE=havenstay_testing`).
     - Configure step to load `backend/database/sql/havenstay_schema.sql` into MySQL.
     - Execute `composer test:mysql`.
* **Verification Gate**:
  - Push to branch triggers GitHub Actions workflow; full test suite passes against real MySQL 8.4 engine.

---

### Slice 5: Documentation Synchronization

* **Objective**: Eliminate documentation drift in root reference documents.
* **Dependencies**: Slices 1 to 4 completed.
* **Work Items**:
  1. `HS-BL-07`:
     - Update `CLAUDE.md`: Replace stale 3-arg `runWriteWorkflow` signature with verified 5-arg signature (`int $actorId, string $action, array $payload, callable $operation, ?callable $resultDetails`).
     - Update `README.md`: Correct bed space states to `vacant`, `occupied`, `maintenance`.
     - Update `README.md`: Clarify that authorization is enforced via FormRequest classes delegating to `AuthorizationService`.
* **Verification Gate**:
  - Code review confirms zero discrepancies between docs and code.

---

## 3. Sprint Risk Management

| Risk | Likelihood | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **MySQL trigger syntax error in CI** | Low | Medium | Schema is already verified in Docker; running `composer test:mysql` locally will catch syntax errors before committing CI changes. |
| **Unintended side-effect on PaymentWizard** | Negligible | High | Frontend wizard already sends `remarks`; making the backend accept it requires zero frontend changes. |
| **Convention test over-specification** | Low | Low | Rewrite tests to inspect FormRequest inheritance and `authorize()` methods rather than brittle AST string patterns. |
