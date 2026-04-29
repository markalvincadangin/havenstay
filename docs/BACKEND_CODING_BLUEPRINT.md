# HavenStay — Backend Architecture & Coding Standards Blueprint

**Version:** 6.1  
**Last Updated:** April 29, 2026  
**Status:** Authoritative Standard  
**Scope:** `backend/app` — Laravel 14 / PHP 8.3+  

---

## 1. Core Philosophy

Every line of backend code written for HavenStay must adhere to these non-negotiable pillars:
1. **Forensic Integrity:** Every write operation must be explicitly wrapped in a transaction, generating a `correlation_id` to link the HTTP request to the database triggers via the `AuditService`.
2. **5-Tier Purity:** The system utilizes an Extended MVC pattern: Middleware → Controller → Service → Model/Support → Database. Classes have singular responsibilities. Mixing these concerns is treated as a defect.
3. **Strict Normalization Compliance:** The backend application must never attempt to bypass database-level constraints or state machines (e.g., using "Magic Numbers" or hardcoded Utility rates). 
4. **Strict Typing & Documentation:** Native PHP 8.3 types are mandatory. All methods must be documented via standardized PHPDoc blocks referencing applicable Business Rules (BR).

---

## 2. Standardized Directory Structure

The `backend/` directory is structured to enforce the separation of concerns, adhering closely to Laravel 13+ conventions extended for HavenStay's domain:

```text
backend/
├── app/
│   ├── Enums/                     # Native PHP 8.3 backed string enums (e.g., RoomStatus)
│   ├── Http/
│   │   ├── Concerns/              # HTTP-layer traits (e.g., RespondsWithJson)
│   │   ├── Controllers/Api/       # Thin API Endpoints (Request translation only)
│   │   ├── Middleware/            # AuthCheck, SetAuditContext
│   │   ├── Requests/              # FormRequests grouped by singular domain (e.g., Meter/)
│   │   └── Resources/             # API output serializers (JSON formatting)
│   ├── Models/                    # Anemic Eloquent mappers (DB schema representation)
│   ├── Providers/                 # Laravel Service Providers
│   ├── Services/                  # The Application Brain (Business Logic)
│   │   ├── Analytics/             # Read-only reporting and PII masking
│   │   ├── Concerns/              # Shared workflow traits (e.g., ManagesWorkflows)
│   │   ├── Core/                  # Stateless Foundation (AuditService, AuthorizationService)
│   │   ├── Identity/              # User accounts and RBAC management
│   │   └── Operations/            # Domain Business Workflows (ContractService, etc.)
│   └── Support/                   # Pure utility and helper classes (Financials, Inventory)
├── database/
│   ├── factories/                 # Model factories for testing
│   ├── migrations/                # Schema migrations (migrate:fresh compatible)
│   ├── seeders/                   # DB seeders (DemoSeeder, RoleSeeder)
│   └── sql/                       # Runtime copy of havenstay_schema.sql (Triggers, Views)
├── routes/
│   └── api.php                    # RESTful routing definitions
└── tests/
    ├── Feature/                   # End-to-end endpoint and integration tests
    └── Unit/                      # Isolated logic tests (e.g., Services/, Support/)
```

---

## 3. PHP Commenting & Type Standard

### 3.1 Strict Typing
- All method signatures **MUST** use PHP 8.3 native types.
- Return types are mandatory (`JsonResponse`, `Contract`, `void`).
- Properties on DTOs/Value Objects should utilize `readonly`.

### 3.2 PHPDoc Standard
Every **public and protected method** must have a PHPDoc block detailing the `WHY`, the `WHAT`, and the `RULES`.

```php
/**
 * Short one-line summary of the action.
 *
 * Longer description explaining the business context, forensic tracing,
 * or edge case handling.
 * 
 * Ref: BR-CON-013, R.A. 9653
 *
 * @param User $actor The authenticated user performing the action.
 * @param array $data Validated input payload.
 * @return Contract The updated contract model.
 * @throws ValidationException If business constraints are violated.
 */
```

---

## 4. Layer-by-Layer Standards

### Tier 1: Models (`app/Models`)
**Responsibility:** Map database rows to PHP objects. Define relationships.
- **Mandatory:**
  - `@property` docblocks for all columns (e.g., `monthly_rate_override`, `is_cleared`).
  - Explicit `$table`, `$primaryKey`, and `$fillable` declarations.
  - Native Enum casting in `casts()` (e.g., `'status' => ContractStatus::class`).
  - Explicit foreign keys in relationship definitions (e.g., `belongsTo(Tenant::class, 'tenant_id', 'tenant_id')`).
- **Forbidden:** Business logic calculations (e.g., `calculateBalance()`), static query scopes for complex filtering.

### Tier 2: Controllers (`app/Http/Controllers/Api`)
**Responsibility:** HTTP translation (Input parsing, Output formatting).
- **Mandatory:**
  - Standard CRUD naming (`index`, `store`, `show`, `update`, `destroy`) + descriptive custom actions (`moveOut`, `activate`).
  - PHPDoc on every method.
  - Call `AuthorizationService::ensure*()` for RBAC before any action.
  - Use `RespondsWithJson` trait (`$this->success()`).
  - **API Resources:** Endpoints must return data formatted via classes in `app/Http/Resources/` (do not return raw `toArray()`).
  - **Idempotency Protection:** All write endpoints (`POST`, `PUT`, `PATCH`) for financial or contractual entities MUST enforce idempotency. Use the `Idempotency-Key` header and verify uniqueness via `AuditService::checkIdempotency()` or a shared `AtomicLock` within the service workflow to prevent duplicate record creation during network retries.
- **Forbidden:** Inline `$request->validate(...)` (use `FormRequest`), business logic, DB queries.

### Tier 3: Services (`app/Services`)
**Responsibility:** The "Brain". Enforces Business Rules, orchestrates workflows.
- **Mandatory:**
  - **Write Operations:** MUST use `self::runWriteWorkflow()` (from `ManagesWorkflows`) to ensure correlation ID injection and DB transaction safety.
  - **Read Operations:** Direct queries are fine.
  - **System Context:** Artisan commands/seeders MUST call `AuditService::setSystemContext()` before writes.
  - Throw `ValidationException` for Business Rule violations.
- **Forbidden:** Raw SQL arrays, swallowing `Throwable`.

### Tier 4: Support / Helpers (`app/Support`)
**Responsibility:** Pure, stateless computation and formatting utilities (e.g., `Financials`, `Inventory`).
- **Mandatory:** Only `public static` methods. Pure logic or read-only DB queries.
- **Forbidden:** Database writes (INSERT/UPDATE/DELETE).

### FormRequests (`app/Http/Requests/{Domain}/`)
- **Mandatory:** Grouped by singular domain name (e.g., `Requests/Meter/`, not `Meters`).
- **Mandatory:** `authorize()` must utilize `AuthorizationService`.

### Enums (`app/Enums/`)
- **Mandatory:** Backed string enums with `UPPER_SNAKE_CASE` cases. 
- **Enum Coverage:** Bed, Room, Billing, BillingLineItem, Contract, Meter, Tenant.

---

## 5. Authorization & Security Standard

1. **Centralized Authority:** The `AuthorizationService` is the **only** authorized location for RBAC checks.
2. **Forensic Trapping:** Controllers and Services must use `AuthorizationService::ensureCan(...)`. This method throws an exception caught globally to log a forensic "Unauthorized Access Attempt".
3. **No Direct Role Checks:** Writing `if ($user->role === 'Admin')` inside a Controller is a critical PR failure.

---

## 6. Domain-Specific Conventions

* **Utility Handling:** Never hardcode `'electric'` or `'water'`. Always relate via `utility_id`.
* **Temporal Pricing:** Never update an existing `UtilityRate`. Insert a new record with a future `effective_from` date. Lookups must use the `billing_period_from` date — **not** `now()` (BR-MET-006).
* **Billing Rate Resolution:** Line items must resolve base rent using the override if present:
  ```php
  $rate = $contract->monthly_rate_override ?? $contract->monthly_rate;
  ```
  **Warning:** The `??` operator passes `0.00` if the override is `0`. Guard against non-positive overrides.
* **Contract Navigation:** Room context is derived through the bed space: `$contract->bedSpace->room_id`.
* **Dual-Path Forensic Resolution (Payments):** Because payments have an XOR target (`billing_id` XOR `contract_id`), all logic resolving tenant or room details MUST check both paths. 
  - **Rent:** `payment->billing->contract->tenant`
  - **Deposits:** `payment->contract->tenant`
  Failure to implement this dual-path resolution results in "orphan" records in the UI.
* **Resilient Batch Workflows:** Room-level batch operations (e.g. utility billing) MUST be non-blocking. Individual contract failures (overlaps, validation) should be trapped within the loop via `try-catch`, logged to the response context, and allowed to "fail open" so other eligible tenants in the room are processed. 

> [!NOTE]
> Legacy `transaction_logs` have been decommissioned. Forensic integrity is handled exclusively by the 45 unified trigger-based `audit_logs` and the `AuditService` context. The `ManagesWorkflows` trait no longer writes to `transaction_logs`.

---

## 7. PR Review Gate (Anti-Patterns)

Code containing these anti-patterns will be automatically rejected:

| Anti-Pattern (Reject) | Why It's Wrong | Correct Implementation |
| :--- | :--- | :--- |
| `DB::table('audit_logs')->insert(...)` | Infinite Loop / Rule Violation | Let the **45 DB Triggers** handle auditing. |
| `$request->validate(...)` in Controller | Leaks validation into routing | Use `public function store(CreateRoomRequest $request)` |
| `return response()->json(...)` | Inconsistent envelope | `return $this->success($data);` |
| Updating an invoice total manually | Violates BR-ANL-001 (Derived) | Compute balance dynamically via Views/Support. |
| Hardcoding `['role' => 'admin']` | Bypasses central auth | Use `RoleEnum::ADMIN` and `AuthorizationService`. |
| `->where('effective_from', '<=', now())` | Applies today's rate to history | Use billing period's `billing_period_from` date. |
| `Contract::where('room_id', $id)` | Column doesn't exist | `Contract::whereHas('bedSpace', fn($q) => $q->where('room_id', $id))` |
| `BillingLineItem::create(['item_type' => 'utility'])` without `utility_id` | Triggers DB constraint violation | Always pass `utility_id` and `reading_id` for utilities. |
| Single-Tenant Batch Failure | Stalls entire room billing | Implement non-blocking `try-catch` inside the batch loop. |
| `payment->billing->tenant` | Fails for Security Deposits | Resolve via dual-path (Billing XOR Contract) per BR-PAY-011. |

---

## 8. Revision History

| Version | Date | Changes |
| :--- | :--- | :--- |
| v4.0 | Apr 19, 2026 | Initial blueprint. Service-layer transactions, audit context. |
| v4.1 | Apr 20, 2026 | Domain-specific conventions for utilities and state machines. |
| v4.2 | Apr 21, 2026 | Corrected trigger count (45). Added billing rate resolution rule. |
| v5.0 | Apr 22, 2026 | Major Architecture Update. Formalized 5-Tier Extended MVC (added Support tier). Mandated strict PHPDoc and native typing. Mandated API Resources for all output. Fixed `transaction_logs` references. Corrected `Requests/Meter/` singular naming convention. |
| v6.0 | Apr 29, 2026 | Major Stabilization: Mandated Idempotency-Key protection for financial writes. Standardized Dual-Path Forensic Resolution for XOR relationships (Payments). Codified Resilient Batch Workflow patterns (Non-blocking loops). |
| **v6.1** | **Apr 29, 2026** | **Clean State Release: Synchronized all references to match the new continuous Business Rule numbering (v2.2).** |
