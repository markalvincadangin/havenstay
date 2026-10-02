# HavenStay — Antigravity Readiness & Governance Specification

> **Document Type**: AI Governance & Agent Operating Specification  
> **Status**: Proposed Configuration Baseline (Prepared for Adoption)  
> **Date**: September 25, 2026  
> **Governing Principle**: *Evidence-Driven Engineering with Non-Bypassable Architectural Constraints*  

---

## 1. Permanent AI Behavioral Rules (Antigravity Rules)

The following 6 rules represent immutable architectural and domain constraints extracted from repository archaeology. Once authorized, they will be installed as permanent Antigravity Rules to govern all code generation.

---

### Rule 1: `thin-controllers`

* **Invariant**: API Controllers must act strictly as HTTP orchestrators. They must never contain raw database queries (`Model::where`), direct model mutations (`Model::create`, `$model->save()`), or complex business logic. They must delegate directly to Service classes and serialize responses using API Resources.
* **Evidence**: Established in [BACKEND_CODING_BLUEPRINT.md L21](file:///home/markc/projects/active/havenstay/docs/BACKEND_CODING_BLUEPRINT.md#L21) and verified across all controllers in `backend/app/Http/Controllers/Api/`.
* **Scope**: All files in `backend/app/Http/Controllers/Api/*Controller.php`.
* **Examples of Violation**:
  ```php
  // VIOLATION: Direct Eloquent query and mutation in controller
  public function store(Request $request) {
      $room = Room::create($request->all());
      return response()->json($room);
  }
  ```
* **Correct Pattern**:
  ```php
  // COMPLIANT: Delegation to Service and serialization via Resource
  public function store(StoreRoomRequest $request): JsonResponse {
      $room = RoomService::create($request->user(), $request->validated());
      return $this->created('Room created.', new RoomResource($room));
  }
  ```
* **Verification Method**: Automated unit convention test inspecting controller AST for direct model access.

---

### Rule 2: `form-request-auth`

* **Invariant**: Mutating endpoint authorization must be evaluated inside dedicated FormRequest `authorize()` methods delegating to `AuthorizationService::ensureCan*()`. Controllers must never execute ad-hoc manual role checks (e.g. `if ($user->role !== 'admin') abort(403);`).
* **Evidence**: Established across 18 FormRequest classes in `backend/app/Http/Requests/`.
* **Scope**: All files in `backend/app/Http/Requests/**/*.php`.
* **Examples of Violation**:
  ```php
  // VIOLATION: Permissive FormRequest with manual check in Controller
  class StorePaymentRequest extends FormRequest {
      public function authorize(): bool { return true; }
  }
  ```
* **Correct Pattern**:
  ```php
  // COMPLIANT: Centralized authorization delegation
  class StorePaymentRequest extends FormRequest {
      public function authorize(): bool {
          AuthorizationService::ensureCanManagePayments($this->user());
          return true;
      }
  }
  ```
* **Verification Method**: Automated unit convention test asserting that all FormRequests invoke `AuthorizationService`.

---

### Rule 3: `workflow-signatures`

* **Invariant**: All mutating business operations in Service classes must execute within `ManagesWorkflows::runWriteWorkflow()` using the verified 5-argument signature: `(int $actorId, string $action, array $payload, callable $operation, ?callable $resultDetails = null)`.
* **Evidence**: Verified in [ManagesWorkflows.php L34](file:///home/markc/projects/active/havenstay/backend/app/Services/Concerns/ManagesWorkflows.php#L34).
* **Scope**: All files in `backend/app/Services/Operations/`.
* **Examples of Violation**:
  ```php
  // VIOLATION: Using stale 3-argument signature from outdated CLAUDE.md
  self::runWriteWorkflow($actor, 'ACTION', function() { ... });
  ```
* **Correct Pattern**:
  ```php
  // COMPLIANT: Verified 5-argument signature with integer actorId
  self::runWriteWorkflow(
      actorId: $actor->user_id,
      action: 'RECORD_PAYMENT',
      payload: ['amount' => $amount],
      operation: function() use ($actor, $data) { ... }
  );
  ```
* **Verification Method**: Static analysis / PHPStan / PHPUnit signature assertions.

---

### Rule 4: `schema-mirror-sync`

* **Invariant**: Any modification to database structure, column definitions, constraints, or triggers must be applied identically and byte-for-byte across BOTH canonical schema files (`db/havenstay_schema.sql` and `backend/database/sql/havenstay_schema.sql`) using standard Unix LF line endings.
* **Evidence**: Architecture invariant verified in [master-plan-validation.md C-06](file:///home/markc/projects/active/havenstay/docs/engineering/master-plan-validation.md#1-validation-of-major-conclusions).
* **Scope**: `db/havenstay_schema.sql` and `backend/database/sql/havenstay_schema.sql`.
* **Examples of Violation**: Updating `db/havenstay_schema.sql` while leaving `backend/database/sql/havenstay_schema.sql` unchanged, or saving with Windows CRLF endings.
* **Verification Method**: `diff -u db/havenstay_schema.sql backend/database/sql/havenstay_schema.sql` must return exit code 0.

---

### Rule 5: `payment-target-xor`

* **Invariant**: Every payment record must target either `billing_id` OR `contract_id`, never both, and never neither.
* **Evidence**: Database CHECK constraint `chk_pay_target` ([havenstay_schema.sql L281](file:///home/markc/projects/active/havenstay/db/havenstay_schema.sql#L281)) and `BR-PAY-001`.
* **Scope**: `payments` table, `PaymentService.php`, `Payment.php`.
* **Examples of Violation**:
  ```php
  // VIOLATION: Setting both billing_id and contract_id
  Payment::create(['billing_id' => 10, 'contract_id' => 5, ...]); // MySQL triggers CHECK failure
  ```
* **Verification Method**: Unit/feature test asserting that attempting to set both or neither throws a database integrity exception.

---

### Rule 6: `frontend-api-client`

* **Invariant**: Frontend components must never use raw browser `fetch()` or `axios`. All HTTP communication must route through the centralized `apiRequest()` helper in `@/lib/api`.
* **Evidence**: [FRONTEND_CODING_BLUEPRINT.md L42](file:///home/markc/projects/active/havenstay/docs/FRONTEND_CODING_BLUEPRINT.md#L42).
* **Scope**: All files in `frontend/src/**/*.js`.
* **Examples of Violation**:
  ```javascript
  // VIOLATION: Direct fetch call bypassing token injection and 401 handling
  const res = await fetch('/api/rooms');
  ```
* **Correct Pattern**:
  ```javascript
  // COMPLIANT: Centralized API client with automatic token and error management
  const data = await apiRequest('/api/rooms');
  ```
* **Verification Method**: ESLint rule or grep search prohibiting `fetch(` or `axios` in `frontend/src/`.

---

## 2. Procedural Skills Specification (Antigravity Skills)

The following 3 core skills will be created in `.agents/skills/` to provide structured procedures for complex operations:

### 1. `havenstay-schema-change`
* **Trigger**: Whenever a task requires adding, modifying, or dropping columns, tables, or triggers.
* **Procedure**:
  1. Draft the SQL DDL modification.
  2. Apply edit to `db/havenstay_schema.sql`.
  3. Copy identical edit to `backend/database/sql/havenstay_schema.sql`.
  4. Ensure Unix LF line endings.
  5. Run `diff -u` to verify byte-for-byte parity.
  6. Update corresponding Eloquent model `$fillable` array, `$casts`, and docstrings.
  7. Update corresponding API Resource transformer.
  8. If on MySQL, execute `composer test:mysql` to verify trigger execution.

### 2. `havenstay-service-mutation`
* **Trigger**: Whenever implementing or altering a mutating business operation.
* **Procedure**:
  1. Identify the actor (`User $actor`) and business action name (`ACTION_NAME`).
  2. Implement authorization in FormRequest `authorize()` via `AuthorizationService`.
  3. Wrap service logic in `self::runWriteWorkflow(actorId: $actor->user_id, action: ..., payload: ..., operation: ...)`.
  4. Verify observer cascades (e.g. `BedSpaceObserver` -> `RoomService::syncRoomOccupancy`).
  5. Author feature test verifying database mutation, audit trigger log entry, and idempotency lock.

### 3. `havenstay-ci-verification`
* **Trigger**: Pre-commit and pre-merge quality gate.
* **Procedure**:
  1. Run unit convention test suite (`php artisan test --testsuite=Unit`).
  2. Run feature test suite on SQLite (`php artisan test --testsuite=Feature`).
  3. Run MySQL trigger verification (`composer test:mysql`).
  4. Run frontend tests (`npm test` in `frontend/`).
  5. Check `git status` to guarantee no unintended files or schema drifts exist.

### Additional Skills to Consider (Post-Stabilization)
- `havenstay-investigation`: Guided archaeology and AST tracing for complex features.
- `havenstay-browser-qa`: Visual regression and end-to-end test execution using the browser subagent.
- `havenstay-security-audit`: Automated PII masking checks across all API Resources.

---

## 3. Tooling & MCP Integration Strategy

To provide maximum verification capability, the following external MCP tools are planned:

| Tool / Server | Functionality Provided | Safety / Permissions |
| :--- | :--- | :--- |
| **MySQL MCP Server** | Query live MySQL 8.4 Docker container, inspect trigger definitions, run EXPLAIN query plans. | Read-Only inspection on development container. |
| **GitHub Actions MCP** | Read workflow run logs, inspect failure artifacts directly within IDE. | Read-Only GitHub API access. |
| **Browser Subagent** | Navigate frontend wizards (`PaymentWizard`, `ContractWizard`) to verify DOM state and error toasts visually. | Local development environment only. |

---

## 4. Multi-Agent Engineering Workflow

To ensure that autonomous agents never invent requirements or make unilateral business assumptions, the following workflow is established:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GOVERNED AGENT WORKFLOW PIPELINE                         │
│                                                                             │
│   Human User Request                                                        │
│          │                                                                  │
│          ▼                                                                  │
│   [1] Investigation Agent (Read-Only)                                       │
│       • Gathers repository evidence across UI, API, DB, and tests           │
│       • Traces domain invariants and data flows                             │
│          │                                                                  │
│          ▼                                                                  │
│   [2] Implementation Plan & Decision Card                                   │
│       • Details exact files, schema changes, and acceptance criteria         │
│          │                                                                  │
│          ▼                                                                  │
│   ──► HUMAN APPROVAL GATE ◄── (Mandatory Stakeholder Sign-Off)              │
│          │                                                                  │
│          ▼                                                                  │
│   [3] Implementation Agent (Active Code Mode)                               │
│       • Executes strictly within approved slice scope                       │
│       • Enforces all 6 Antigravity Rules                                    │
│          │                                                                  │
│          ▼                                                                  │
│   [4] Automated Verification Agent                                          │
│       • Executes Unit, Feature, and MySQL Trigger tests                     │
│          │                                                                  │
│          ▼                                                                  │
│   [5] Architecture Reviewer Agent                                           │
│       • Validates git diff against Definition of Done                       │
│          │                                                                  │
│          ▼                                                                  │
│   ──► FINAL HUMAN REVIEW & MERGE ◄──                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

> **CORE GOVERNANCE PRINCIPLE**:  
> *No implementation agent may invent business rules, change legal policies, or alter financial algorithms when the requirement or domain behavior is ambiguous. All ambiguities must stop at the Human Approval Gate.*

---

## 5. Human Authorization Checklist

*The project remains in strict READ-ONLY mode until the human maintainer confirms the items below:*

```text
[ ] DEC-01: Approved standardizing on 'remarks' (Option A)
[ ] DEC-02: Approved deposit forfeiture policy (Model selected: _____)
[ ] DEC-03: Confirmed commercial inventory lock baseline for pending_payment (Option A)
[ ] DEC-04: Approved removing broken {tenant}/reactivate route (Option A)
[ ] DEC-05: Approved MySQL 8.4 service container in GitHub Actions CI (Option A)

[ ] Stabilization Sprint Scope Approved (Slices 1 to 5)
[ ] ADRs (ADR-001 through ADR-005) Reviewed
[ ] Antigravity Rules (Rules 1 to 6) Reviewed
[ ] Antigravity Skills Plan Reviewed
[ ] MCP Tooling Plan Reviewed

[ ] ACTIVE IMPLEMENTATION MODE AUTHORIZED
```
