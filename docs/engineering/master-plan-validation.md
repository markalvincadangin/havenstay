# HavenStay — Master Plan Validation & Decision Audit

> **Document Type**: Technical Validation Audit & Decision Framework  
> **Status**: Authoritative Analytical Audit  
> **Date**: September 25, 2026  
> **Operating Principle**: `FACT → EVIDENCE → REQUIREMENT → BUSINESS RULE → GAP → DECISION → BACKLOG ITEM`  
> **Target Scope**: Critical Review of the HavenStay Master Work Plan against Current Implementation, Schema, and Authoritative Documentation.

---

## 1. Validation of Major Conclusions

Every major conclusion presented in the draft Master Work Plan was cross-examined against direct codebase evidence, database schema definitions, and automated test behaviors.

| # | Major Conclusion | Evidence Source | Classification | Verification Detail |
| :- | :--- | :--- | :--- | :--- |
| **C-01** | `HandleIdempotency` correctly guards mutating requests and bypasses safe methods. | [HandleIdempotency.php L26](file:///home/markc/projects/active/havenstay/backend/app/Http/Middleware/HandleIdempotency.php#L26) | **VERIFIED FACT** | In PHP, `!` precedes `===`. For safe methods (`GET`/`HEAD`), `! true === false` evaluates to `true`, triggering the bypass early return. For mutating methods (`POST`/`PUT`/`PATCH`/`DELETE`), `! false === false` evaluates to `false`, allowing requests with an `Idempotency-Key` to enter the atomic lock and replay logic. |
| **C-02** | Zero automated tests exist for `HandleIdempotency` in the backend test suite. | `backend/tests/` grep search | **VERIFIED FACT** | Zero occurrences of `Idempotency` or `HandleIdempotency` found across unit or feature tests. |
| **C-03** | `ManagesWorkflows::runWriteWorkflow()` takes 5 arguments (`int $actorId`), not 3 (`User $actor`). | [ManagesWorkflows.php L34](file:///home/markc/projects/active/havenstay/backend/app/Services/Concerns/ManagesWorkflows.php#L34) | **VERIFIED FACT** | Signature: `(int $actorId, string $action, array $payload, callable $operation, ?callable $resultDetails = null)`. All operations services conform to this signature. `CLAUDE.md` is stale. |
| **C-04** | Bed spaces support only 3 states (`vacant`, `occupied`, `maintenance`). | [BedSpaceStatus.php](file:///home/markc/projects/active/havenstay/backend/app/Enums/BedSpaceStatus.php); Schema L92 | **VERIFIED FACT** | Schema enum and PHP enum define exactly 3 states. `README.md` claim of `Reserved` and `Archived` is a documentation remnant. |
| **C-05** | `PaymentService` silently drops `remarks`. | [PaymentService.php L96](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/PaymentService.php#L96); [Payment.php L38](file:///home/markc/projects/active/havenstay/backend/app/Models/Payment.php#L38) | **VERIFIED FACT** | The `payments` table schema lacks `remarks` or `notes`. `Payment::$fillable` omits `remarks`. Eloquent silently discards it on `Payment::create()`. |
| **C-06** | Canonical schema files have drifted on `avatar_url` and line endings. | Schema diff: `db/` vs `backend/` | **VERIFIED FACT** | `db/havenstay_schema.sql` defines `avatar_url VARCHAR(255) NULL` with CRLF; `backend/database/sql/havenstay_schema.sql` defines `avatar_url TEXT NULL` with LF. |
| **C-07** | 4 Architectural Convention Tests fail out-of-the-box. | `php artisan test` output | **VERIFIED FACT** | Tests assert controller body regexes for `AuthorizationService::ensureCan*`. When authorization was refactored into FormRequest classes, tests were not updated. |
| **C-08** | Route `POST /api/tenants/{tenant}/reactivate` throws a 500 runtime error. | [routes/api.php L58](file:///home/markc/projects/active/havenstay/backend/routes/api.php#L58); [TenantController.php](file:///home/markc/projects/active/havenstay/backend/app/Http/Controllers/Api/TenantController.php) | **VERIFIED FACT** | Neither `TenantController` nor `TenantService` defines `reactivate()`. Calling this route throws `BadMethodCallException`. |
| **C-09** | CI runs exclusively on SQLite, skipping all 45 MySQL triggers. | [.github/workflows/tests.yml](file:///home/markc/projects/active/havenstay/.github/workflows/tests.yml); [TestCase.php L89](file:///home/markc/projects/active/havenstay/backend/tests/TestCase.php#L89) | **VERIFIED FACT** | CI workflow configures SQLite with `coverage: none`. `TestCase::assertTriggerAuditLog` is a stub `$this->assertTrue(true)` when not on MySQL. |
| **C-10** | Viewer role PII is exposed on `GET /api/tenants`. | [TenantResource.php L38](file:///home/markc/projects/active/havenstay/backend/app/Http/Resources/TenantResource.php#L38); [PiiMaskingService.php](file:///home/markc/projects/active/havenstay/backend/app/Services/Analytics/PiiMaskingService.php) | **CONFLICT (FALSE CLAIM)** | The draft plan claimed Viewer PII was unmasked on `GET /api/tenants`. Inspection reveals `TenantResource` explicitly checks `PiiMaskingService::shouldMaskTenantPii($request->user())` and masks contact numbers, emails, and emergency contacts. |
| **C-11** | Sanctum tokens must be refactored to sliding-window expiration. | [sanctum.php L53](file:///home/markc/projects/active/havenstay/backend/config/sanctum.php#L53); [SRS.md](file:///home/markc/projects/active/havenstay/docs/SRS.md) | **PROPOSED DECISION** | Tokens currently expire strictly after 120 minutes. No user complaint or SRS requirement exists demanding sliding-window expiration. |
| **C-12** | Meter dial capacity should be configurable per meter. | [Financials.php L62](file:///home/markc/projects/active/havenstay/backend/app/Support/Financials.php#L62); [BR-MET-005](file:///home/markc/projects/active/havenstay/docs/BUSINESS_RULES.md#L372) | **PROPOSED DECISION** | Dial capacity is currently hardcoded at 10,000.0. Whether the facility actually uses non-4-digit meters requires human/operational confirmation before changing schema. |

---

## 2. Requirements Audit (`REQ-*`)

| ID | Requirement Statement | Evidence | Classification | Actual Requirement? | Decision Needed |
| :- | :--- | :--- | :--- | :--- | :--- |
| **REQ-001** | User authentication via username/email and password with session token issuance. | [AuthService.php L35](file:///home/markc/projects/active/havenstay/backend/app/Services/Identity/AuthService.php#L35); [SRS.md](file:///home/markc/projects/active/havenstay/docs/SRS.md) FR-001 | **DOCUMENTED REQUIREMENT** | Yes. Core business requirement. | Keep as-is. |
| **REQ-002** | External Google OAuth 2.0 authentication. | [OAuthController.php L26](file:///home/markc/projects/active/havenstay/backend/app/Http/Controllers/Api/OAuthController.php#L26); [SRS.md](file:///home/markc/projects/active/havenstay/docs/SRS.md) FR-003 | **DOCUMENTED REQUIREMENT** | Yes. Documented in SRS §4.1. | Standardize `avatar_url TEXT` in schema. |
| **REQ-003** | Prohibition of OAuth self-registration / auto-provisioning. | [AuthService.php L90](file:///home/markc/projects/active/havenstay/backend/app/Services/Identity/AuthService.php#L90); [BR-GEN-007](file:///home/markc/projects/active/havenstay/docs/BUSINESS_RULES.md#L56) | **DOCUMENTED REQUIREMENT** | Yes. Explicit forensic policy in `BUSINESS_RULES.md`. | Keep strict rejection; improve UI error message. |
| **REQ-004** | Role-Based Access Control enforcing Admin, Staff, and Viewer permission boundaries. | [AuthorizationService.php L45](file:///home/markc/projects/active/havenstay/backend/app/Services/Core/AuthorizationService.php#L45); [RoleEnum.php](file:///home/markc/projects/active/havenstay/backend/app/Enums/RoleEnum.php) | **DOCUMENTED REQUIREMENT** | Yes. Authoritative RBAC architecture. | Refactor convention tests to match FormRequests. |
| **REQ-005** | Viewer role Personally Identifiable Information (PII) masking. | [TenantResource.php L38](file:///home/markc/projects/active/havenstay/backend/app/Http/Resources/TenantResource.php#L38); [PiiMaskingService.php](file:///home/markc/projects/active/havenstay/backend/app/Services/Analytics/PiiMaskingService.php) | **VERIFIED FACT** | Yes. Already implemented across reports and tenant resources. | Verify if room/contract occupant lists also require PII masking for Viewers. |
| **REQ-006** | Bed space status lifecycle tracking (`vacant`, `occupied`, `maintenance`). | [BedSpaceStatus.php](file:///home/markc/projects/active/havenstay/backend/app/Enums/BedSpaceStatus.php); Schema L92 | **DOCUMENTED REQUIREMENT** | Yes. Defined in `BUSINESS_RULES.md` BR-ROM-004. | Update stale `README.md` text. |
| **REQ-007** | Automated room status and capacity derivation. | [BedSpaceObserver.php L19](file:///home/markc/projects/active/havenstay/backend/app/Observers/BedSpaceObserver.php#L19); [RoomService.php L370](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/RoomService.php#L370) | **DOCUMENTED REQUIREMENT** | Yes. Documented in BR-ROM-003. | Ensure manual room offline maintenance hold is never overridden by bed saves. |
| **REQ-008** | Contract bed reservation lock upon creation. | [ContractService.php L161](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/ContractService.php#L161); [BR-CON-002](file:///home/markc/projects/active/havenstay/docs/BUSINESS_RULES.md#L148) | **DOCUMENTED REQUIREMENT** | Yes. Bed is marked `occupied` immediately upon contract draft. | **DECISION REQUIRED**: Clarify operational definition of "occupied" during `pending_payment`. |
| **REQ-009** | Statutory Security Deposit limit (≤ 2× monthly rent). | [OperationalHardening.php L21](file:///home/markc/projects/active/havenstay/backend/app/Support/OperationalHardening.php#L21); [BR-CON-006](file:///home/markc/projects/active/havenstay/docs/BUSINESS_RULES.md#L173) | **DOCUMENTED REQUIREMENT** | Yes. Documented in BR-CON-006 and cited to R.A. 9653. | Requires legal applicability verification. |
| **REQ-010** | Statutory Rent Increase legal cap (≤ 7% on residential renewal). | [OperationalHardening.php L38](file:///home/markc/projects/active/havenstay/backend/app/Support/OperationalHardening.php#L38); [BR-CON-011](file:///home/markc/projects/active/havenstay/docs/BUSINESS_RULES.md#L201) | **INFERRED / CODE ONLY** | Ambiguous. Hardcoded at 7%; under law, rent caps vary by government resolution and rent bracket. | **DECISION REQUIRED**: Verify legal coverage for commercial/dormitory lodging. |
| **REQ-011** | Tenant move-out clearance and balance settlement check. | [ContractService.php L390](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/ContractService.php#L390); [BR-CON-007](file:///home/markc/projects/active/havenstay/docs/BUSINESS_RULES.md#L177) | **DOCUMENTED REQUIREMENT** | Yes. Gate pass rule: balance must be ≤ ₱0.01. | Document deposit deduction/forfeiture workflow. |
| **REQ-012** | Deposit refund and rollover clearance tracking (`is_cleared`). | [PaymentService.php L109](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/PaymentService.php#L109); [BR-PAY-010](file:///home/markc/projects/active/havenstay/docs/BUSINESS_RULES.md#L340) | **DOCUMENTED REQUIREMENT** | Yes. Triggers upon `refund` or `rollover` payment category. | Define handling of retained/forfeited deposits. |
| **REQ-013** | Payment target XOR constraint (Billing OR Contract). | [havenstay_schema.sql L281](file:///home/markc/projects/active/havenstay/db/havenstay_schema.sql#L281); [BR-PAY-001](file:///home/markc/projects/active/havenstay/docs/BUSINESS_RULES.md#L291) | **DOCUMENTED REQUIREMENT** | Yes. Architectural foundation of dual-path payments. | Keep as-is. |
| **REQ-014** | Payment soft-voiding and non-deletion. | [PaymentService.php L184](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/PaymentService.php#L184); [BR-PAY-004](file:///home/markc/projects/active/havenstay/docs/BUSINESS_RULES.md#L310) | **DOCUMENTED REQUIREMENT** | Yes. Payments are immutable historical records. | Keep as-is. |
| **REQ-015** | Dynamic billing cycle status calculation. | [Financials.php L88](file:///home/markc/projects/active/havenstay/backend/app/Support/Financials.php#L88); [BR-BIL-006](file:///home/markc/projects/active/havenstay/docs/BUSINESS_RULES.md#L256) | **DOCUMENTED REQUIREMENT** | Yes. Evaluates paid vs due amount and due date. | Investigate ₱0.01 tolerance vs BCMath precision. |
| **REQ-016** | Utility meter single active room assignment constraint. | [havenstay_schema.sql L521](file:///home/markc/projects/active/havenstay/db/havenstay_schema.sql#L521); [BR-MET-003](file:///home/markc/projects/active/havenstay/docs/BUSINESS_RULES.md#L363) | **DOCUMENTED REQUIREMENT** | Yes. Enforced by trigger `trg_meter_assignments_bi`. | Keep as-is. |
| **REQ-017** | Meter reading rollover dial wrap calculation. | [Financials.php L61](file:///home/markc/projects/active/havenstay/backend/app/Support/Financials.php#L61); [BR-MET-005](file:///home/markc/projects/active/havenstay/docs/BUSINESS_RULES.md#L372) | **DOCUMENTED REQUIREMENT** | Yes. Handles dial reset when current < previous reading. | **DECISION REQUIRED**: Keep default 10,000 threshold or add meter column. |
| **REQ-018** | Time-weighted utility proration across shared room occupants. | [UtilityApportionmentService.php L96](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/UtilityApportionmentService.php#L96); [BR-MET-010](file:///home/markc/projects/active/havenstay/docs/BUSINESS_RULES.md#L404) | **DOCUMENTED REQUIREMENT** | Yes. Proration based on man-days in billing cycle. | Keep as-is. |
| **REQ-019** | Orphan cent rounding differential allocation (BR-MET-011). | [Financials.php L176](file:///home/markc/projects/active/havenstay/backend/app/Support/Financials.php#L176); [BR-MET-010](file:///home/markc/projects/active/havenstay/docs/BUSINESS_RULES.md#L404) | **DOCUMENTED REQUIREMENT** | Yes. Rounding differentials assigned to earliest contract. | Keep as-is. |
| **REQ-020** | Immutable forensic audit logging via database triggers. | [havenstay_schema.sql L368](file:///home/markc/projects/active/havenstay/db/havenstay_schema.sql#L368); [BR-AUD-001](file:///home/markc/projects/active/havenstay/docs/BUSINESS_RULES.md#L410) | **DOCUMENTED REQUIREMENT** | Yes. 45 triggers log DML into immutable `audit_logs`. | Add MySQL service container to CI. |
| **REQ-021** | Mutating request idempotency protection. | [HandleIdempotency.php L26](file:///home/markc/projects/active/havenstay/backend/app/Http/Middleware/HandleIdempotency.php#L26); Blueprint L104 | **DOCUMENTED REQUIREMENT** | Yes. Mandated in Backend Coding Blueprint §4. | Author comprehensive automated test suite. |
| **REQ-022** | Tenant profile reactivation route. | [routes/api.php L58](file:///home/markc/projects/active/havenstay/backend/routes/api.php#L58); [TenantArchitectureConventionTest.php L32](file:///home/markc/projects/active/havenstay/backend/tests/Unit/TenantArchitectureConventionTest.php#L32) | **CONFLICT / DEFECT** | No. Broken leftover route pointing to non-existent method. | **DECISION REQUIRED**: Route to `restore()` or delete route. |
| **REQ-023** | Payment remarks persistence. | [PaymentWizard.js L827](file:///home/markc/projects/active/havenstay/frontend/src/features/payments/components/PaymentWizard.js#L827); [StorePaymentRequest.php L60](file:///home/markc/projects/active/havenstay/backend/app/Http/Requests/Payment/StorePaymentRequest.php#L60) | **CONFLICT / DEFECT** | Yes. End-to-end intent proven in UI, FormRequest, and Service. | **DECISION REQUIRED**: Add column to schema or deprecate in UI. |

---

## 3. Business Rules Register Audit

The business rules catalog in `docs/BUSINESS_RULES.md` was cross-referenced against codebase enforcement and categorized by origin.

### Category Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BUSINESS RULES ORIGIN AUDIT                           │
│                                                                             │
│  [A] Explicit Business Rules     [B] Rules Inferred From Code               │
│  • BR-GEN-004 (Tripartite roles) • BR-CON-011 (Hardcoded 7% rent cap)      │
│  • BR-GEN-007 (OAuth reject)     • BR-MET-005 (Fixed 10,000 dial wrap)      │
│  • BR-TEN-003 (One active lease)                                            │
│  • BR-CON-002 (Bed lock)         [C] Technical / Data Integrity Invariants  │
│  • BR-CON-006 (Deposit cap ≤2x)  • BR-BIL-004 (CHECK: bli amount/polarity)  │
│  • BR-PAY-001 (Payment XOR)      • BR-PAY-001 (CHECK: chk_pay_target)       │
│  • BR-PAY-004 (Payment voiding)  • BR-MET-003 (TRIGGER: trg_meter_assign_bi)│
│  • BR-MET-010 (Orphan cents)     • BR-AUD-003 (TRIGGER: audit immutability) │
│                                                                             │
│  [D] Statutory / Legal Rules     [E] Rules Requiring Stakeholder Decision   │
│  • BR-CON-006 (R.A. 9653 deposit)• Unsettled deposit forfeiture policy      │
│  • BR-CON-011 (R.A. 9653 rent)   • Bed space DB status during pending stage │
│                                  • Tenant reactivation route retention      │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Rule ID | Current Documented Rule | Implementation Evidence | Business Source | Classification | Confidence | Needs Validation? |
| :- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BR-GEN-001** | Unique username & email among active users. | Schema L72 (`active_username`, `active_email`) | `BUSINESS_RULES.md` | **[C] Technical Integrity** | High | No. |
| **BR-GEN-004** | Strict tripartite role model: Admin, Staff, Viewer. | [RoleEnum.php](file:///home/markc/projects/active/havenstay/backend/app/Enums/RoleEnum.php); [AuthorizationService.php](file:///home/markc/projects/active/havenstay/backend/app/Services/Core/AuthorizationService.php) | `BUSINESS_RULES.md` | **[A] Explicit Business Rule** | High | No. |
| **BR-GEN-007** | Prohibition of OAuth auto-provisioning. | [AuthService.php L90](file:///home/markc/projects/active/havenstay/backend/app/Services/Identity/AuthService.php#L90) | `BUSINESS_RULES.md` | **[A] Explicit Business Rule** | High | No. |
| **BR-GEN-009** | Users cannot deactivate or modify their own account role. | [UserController.php L50](file:///home/markc/projects/active/havenstay/backend/app/Http/Controllers/Api/UserController.php#L50) | `BUSINESS_RULES.md` | **[A] Explicit Business Rule** | High | No. |
| **BR-TEN-003** | Tenant may hold at most one active contract. | [ContractService.php L583](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/ContractService.php#L583) | `BUSINESS_RULES.md` | **[A] Explicit Business Rule** | High | No. |
| **BR-TEN-004** | Tenant status is auto-derived from contract history. | [ContractObserver.php L21](file:///home/markc/projects/active/havenstay/backend/app/Observers/ContractObserver.php#L21); [TenantService.php L287](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/TenantService.php#L287) | `BUSINESS_RULES.md` | **[A] Explicit Business Rule** | High | No. |
| **BR-ROM-003** | Room status auto-derived from bed occupancy. | [BedSpaceObserver.php L19](file:///home/markc/projects/active/havenstay/backend/app/Observers/BedSpaceObserver.php#L19); [RoomService.php L370](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/RoomService.php#L370) | `BUSINESS_RULES.md` | **[A] Explicit Business Rule** | High | No. |
| **BR-CON-002** | Contract creation locks target bed space. | [ContractService.php L161](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/ContractService.php#L161) | `BUSINESS_RULES.md` | **[A] Explicit Business Rule** | High | **Yes (Bed DB state)** |
| **BR-CON-006** | Security deposit cannot exceed 2 months' rent. | [OperationalHardening.php L21](file:///home/markc/projects/active/havenstay/backend/app/Support/OperationalHardening.php#L21) | `BUSINESS_RULES.md` / R.A. 9653 | **[D] Legal / Regulatory** | High | **Yes (Legal scope)** |
| **BR-CON-011** | Annual rent increase on renewal cannot exceed 7%. | [OperationalHardening.php L38](file:///home/markc/projects/active/havenstay/backend/app/Support/OperationalHardening.php#L38) | Code only (cited to R.A. 9653) | **[B] Inferred / [D] Legal** | Medium | **Yes (Legal scope)** |
| **BR-CON-012** | Contract voiding requires zero active payments and zero settled billings. | [ContractService.php L476](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/ContractService.php#L476) | `BUSINESS_RULES.md` | **[A] Explicit Business Rule** | High | No. |
| **BR-BIL-004** | Line item constraints: amount <> 0; polarity; utility linkage. | Schema L252 (`chk_bli_amount`, `chk_bli_polarity`, `chk_bli_utility_link`) | Schema CHECK constraints | **[C] Technical Integrity** | High | No. |
| **BR-BIL-006** | Dynamic billing status calculation (`paid`, `partial`, `overdue`, `unpaid`). | [Financials.php L88](file:///home/markc/projects/active/havenstay/backend/app/Support/Financials.php#L88) | `BUSINESS_RULES.md` | **[A] Explicit Business Rule** | High | No. |
| **BR-PAY-001** | Payment target XOR rule (Billing OR Contract). | Schema L281 (`chk_pay_target`); [PaymentService.php L62](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/PaymentService.php#L62) | `BUSINESS_RULES.md` & Schema | **[C] Technical / [A] Business** | High | No. |
| **BR-PAY-004** | Payment soft-voiding with audit reason; non-deletion. | [PaymentService.php L184](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/PaymentService.php#L184) | `BUSINESS_RULES.md` | **[A] Explicit Business Rule** | High | No. |
| **BR-PAY-010** | Contract `is_cleared = true` on deposit refund/rollover. | [PaymentService.php L111](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/PaymentService.php#L111) | `BUSINESS_RULES.md` | **[A] Explicit Business Rule** | High | **Yes (Forfeiture rule)** |
| **BR-MET-003** | Single active room assignment per meter (`valid_to IS NULL`). | Schema L521 (`trg_meter_assignments_bi`) | Schema Trigger | **[C] Technical Integrity** | High | No. |
| **BR-MET-005** | Meter rollover dial wrap calculation when reading < previous. | [Financials.php L61](file:///home/markc/projects/active/havenstay/backend/app/Support/Financials.php#L61) | Code only (cited to BR-MET-005) | **[B] Inferred from Code** | Medium | **Yes (Dial capacity)** |
| **BR-MET-010** | Time-weighted utility proration; orphan cents to earliest contract. | [UtilityApportionmentService.php L96](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/UtilityApportionmentService.php#L96); [Financials.php L176](file:///home/markc/projects/active/havenstay/backend/app/Support/Financials.php#L176) | `BUSINESS_RULES.md` | **[A] Explicit Business Rule** | High | No. |
| **BR-AUD-003** | Audit log immutability enforced by engine triggers. | Schema L598 (`trg_audit_logs_protect_bu/bd`) | Schema Trigger | **[C] Technical Integrity** | High | No. |

---

## 4. Special Audit — Legal / Regulatory Claims

The codebase explicitly cites Philippine Republic Act No. 9653 (Rent Control Act of 2009) in [OperationalHardening.php](file:///home/markc/projects/active/havenstay/backend/app/Support/OperationalHardening.php#L16-L48) and `BUSINESS_RULES.md`.

| Legal Claim | Current Code Implementation | Statutory Authority Cited | Legal Reality / Verification Needed | Audit Status |
| :--- | :--- | :--- | :--- | :--- |
| **Security Deposit Limit** | `deposit_amount <= monthly_rate * 2`. Enforced in [ContractService.php L632](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/ContractService.php#L632). | R.A. 9653 Section 7 | **Partially Verified Statutory Rule**. R.A. 9653 §7 limits security deposits to a maximum of two (2) months and advance rent to one (1) month. However, it applies strictly to *residential units* within statutory rent ceilings. Boarding house bed spaces may be categorized under commercial/dormitory lodging under local city ordinances. | **REQUIRES LEGAL VERIFICATION** |
| **Rent Increase Cap** | `new_rate <= old_rate * 1.07` (7% annual cap). Enforced in [ContractService.php L352](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/ContractService.php#L352). | R.A. 9653 Section 4 | **Unconfirmed Historical Rate**. R.A. 9653 did not set a permanent 7% cap in perpetuity. It empowered HUDCC / DHSUD to set annual caps by resolution (which have historically varied from 0% to 7% depending on inflation and COVID moratoriums), and only covers rents up to ₱10,000/mo in NCR and ₱5,000/mo elsewhere. Hardcoding 7% is an assumption. | **REQUIRES LEGAL VERIFICATION** |
| **Advance Rent Limit** | `BillingService::initializeContractBilling` issues 1 month advance rent line item. | R.A. 9653 Section 7 | **Verified Practice**. R.A. 9653 permits up to 1 month advance rent. HavenStay's onboarding wizard collects exactly 1 month advance rent + deposit. | **CODE IMPLEMENTATION ONLY** |

*Conclusion*: The 7% rent increase limit must be classified as a **configurable business policy** rather than an immutable statutory constraint.

---

## 5. Special Audit — Financial Rules

| Financial Mechanism | Current Code Implementation | Explicit Business Requirement | Accounting / Financial Assumption | Data Integrity Constraint | Open Business Decision |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **₱0.01 Precision Tolerance** | `if ($amountPaid >= ($amountDue - 0.01))` in `Financials.php L93` and `ContractService.php L438`. | Undocumented in `BUSINESS_RULES.md`. | **Engineering Workaround**: Added because PHP casts database values to IEEE 754 `(float)`, causing `5000.00` to evaluate as `4999.999999999`. | None in schema. | **DECISION REQUIRED**: Migrate financial math to `BCMath` / integer cent arithmetic, or formalize 1-cent debt waiver. |
| **Payment Target XOR** | Database CHECK constraint `chk_pay_target`; validation in `PaymentService.php L62`. | Documented in BR-PAY-001 and BR-PAY-011. | Payments settle either monthly rent/utility invoices OR contract-level bonds/refunds. | Enforced by engine-level CHECK constraint. | Validated business architecture. Keep. |
| **Deposit Clearance (`is_cleared`)** | Contract `is_cleared` updated to `true` upon `refund` or `rollover` payment. | Documented in BR-PAY-010. | Assumes all deposits are either fully returned or transferred to a new lease. | None in schema. | **DECISION REQUIRED**: How is `is_cleared` resolved if deposit is forfeited for damages or unpaid rent? |
| **Payment Soft-Voiding** | Updates `voided_at`, `voided_by`, `void_reason`. Never deleted. Excluded from sums. | Documented in BR-PAY-004 to BR-PAY-007. | Voided payments represent accounting corrections, not refunds. | Primary key retained; view filters `WHERE voided_at IS NULL`. | Validated. Keep. |
| **Orphan-Cent Allocation** | Rounding differentials resulting from division are applied to earliest contract (`contractIds[0]`). | Documented in BR-MET-010. | Earliest tenant absorbs rounding gap (±₱0.01) to ensure room sum matches meter cost. | Line item amount cannot be zero (`chk_bli_amount`). | Validated. Keep. |
| **Utility Apportionment** | Man-days active in period / total man-days = consumption share. | Documented in BR-MET-010. | Fair share proration based on actual days occupied during meter cycle. | Reading FK must be non-null (`chk_bli_utility_link`). | Validated. Keep. |
| **Dynamic Billing Status** | Recomputed on every payment save/void via observer. Stored in `billing.status`. | Documented in BR-BIL-006 and BR-BIL-007. | Overdue status takes precedence over partial payment if `due_date < today`. | ENUM: `unpaid`, `partial`, `paid`, `overdue`. | Validated. Keep. |

---

## 6. Special Audit — Occupancy / Contract Logic

### The "Vacant Bed vs. Pending Payment" Contradiction
The Master Work Plan and `BUSINESS_RULES.md` contain an apparent contradiction:
- `BR-CON-002`: "A contract may only be created when the target bed space has status `vacant`."
- `BR-ROM-004`: "A bed space may only be `occupied` when it is assigned to a contract in an `active` or `pending_payment` state."
- `ContractService::create()`: Creates contract in `pending_payment`, but immediately calls `RoomService::occupyBedSpace()` and marks the bed space `occupied` in the database!

### Code-Level Entity Status During `pending_payment`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 ENTITY LIFECYCLE DURING PENDING_PAYMENT                     │
│                                                                             │
│   [Contract]        ──► status = 'pending_payment'                          │
│   [BedSpace]        ──► status = 'occupied' (in database table)             │
│   [Room]            ──► capacity recalculated (becomes 'unavailable' if     │
│                         all beds are now occupied)                          │
│   [Tenant]          ──► status = 'active' (TenantService::syncStatus treats │
│                         pending_payment as ACTIVE residency!)               │
│   [Billing]         ──► Auto-initialized invoice with status = 'unpaid'     │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Lifecycle Stage | Contract Status | Bed Space Status | Room Status | Tenant Status | First Billing Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Draft / Created** | `pending_payment` | `occupied` | Derived (`available` or `unavailable`) | `active` | `unpaid` |
| **2. Payment Settled** | `active` | `occupied` | Unchanged | `active` | `paid` (or `partial`) |
| **3. Cancelled / Voided** | `voided` | `vacant` | Recalculated (`available`) | `onboarded` (if no other leases) | Deleted (if unpaid) |
| **4. Move-Out** | `completed` | `vacant` | Recalculated (`available`) | `moved_out` | Retained as historical |

### Operational Ambiguity & Decision Needed
- **Ambiguity**: Calling `TenantService::syncStatus` during `pending_payment` marks the tenant `active` before they have paid advance rent or physically moved in! If the tenant walks away without paying, operational occupancy metrics falsely report them as an active resident until staff manually voids the lease.
- **DECISION REQUIRED**: Should a tenant with an un-settled `pending_payment` lease remain in `onboarded` status until contract activation? Should the bed space DB status remain `vacant` (with an reservation lock) or `occupied`?

---

## 7. Special Audit — Payment Remarks

Investigation into whether `'remarks'` is dead code or an intended feature:

1. **Exposed in UI?** **YES**. [PaymentWizard.js L827-832](file:///home/markc/projects/active/havenstay/frontend/src/features/payments/components/PaymentWizard.js#L827-L832) renders an input labeled `"Notes"` with `placeholder="Optional remarks..."` bound to `remarks`. The payment detail page ([page.js L361](file:///home/markc/projects/active/havenstay/frontend/src/app/(dashboard)/payments/[id]/page.js#L361)) attempts to render `payment?.remarks`.
2. **Accepted by FormRequest?** **YES**. [StorePaymentRequest.php L60](file:///home/markc/projects/active/havenstay/backend/app/Http/Requests/Payment/StorePaymentRequest.php#L60) and [StoreCompositePaymentRequest.php L39](file:///home/markc/projects/active/havenstay/backend/app/Http/Requests/Payment/StoreCompositePaymentRequest.php#L39) explicitly validate `'remarks' => ['nullable', 'string']`.
3. **Written by Service?** **YES**. [PaymentService.php L96, L154, L165](file:///home/markc/projects/active/havenstay/backend/app/Services/Operations/PaymentService.php#L96) explicitly injects `'remarks'` into `Payment::create()`.
4. **Returned by API Resource?** **NO / BROKEN**. [PaymentResource.php L32](file:///home/markc/projects/active/havenstay/backend/app/Http/Resources/PaymentResource.php#L32) maps `'notes' => $this->notes` instead of `remarks`.
5. **Database Table Support?** **NO / MISSING**. Neither `remarks` nor `notes` exists on the `payments` table in schema DDL or `Payment::$fillable`.
6. **Verdict**: **INTENDED BUSINESS REQUIREMENT (CORRECTION REQUIRED)**.  
   This is not dead code. The developer built the entire pipeline (UI → FormRequest → Service) but forgot to add the column to the database schema DDL and `$fillable`, and used `notes` in `PaymentResource`.
7. **Action**: Add `remarks VARCHAR(255) NULL` to `payments` schema DDL, add to `Payment::$fillable`, and align `PaymentResource` to export `remarks`.

---

## 8. Special Audit — Meter Rollover

Investigation into dial wrap and configurable thresholds:

- **Current Implementation**: [Financials.php L61-65](file:///home/markc/projects/active/havenstay/backend/app/Support/Financials.php#L61-L65) hardcodes:
  ```php
  if ($consumption < 0) {
      $dialCapacity = 10000.0;
      $consumption = ($dialCapacity - $prevValue) + $currentReading;
  }
  ```
- **Documented Rule**: `BR-MET-005` states: "If no maximum display capacity is specified for the meter type, the system shall default to 9,999.9999 units as the rollover threshold."
- **Schema Reality**: Neither `meters` nor `utilities` table has a `dial_capacity` or `max_display_capacity` column.
- **Problem**: 
  1. Mechanical electricity/water meters typically roll over at 9,999 or 99,999. Electronic sub-meters can roll over at 999,999.
  2. If an electronic meter with previous reading 12,500 rolls over to 50, `$consumption < 0` triggers `(10000.0 - 12500) + 50 = -2450`, resulting in erroneous negative consumption!
- **Options**:
  - *Option A (Keep Default)*: Retain 10,000 threshold as default; add `is_rollover` validation warning only.
  - *Option B (Configurable per Meter)*: Add `dial_capacity DECIMAL(10,2) DEFAULT 10000.00` to `meters` table.
- **HUMAN DECISION REQUIRED**: Confirm the physical sub-meter models installed in the HavenStay facility before modifying database schema.

---

## 9. Special Audit — Session Token Expiration

Investigation into 120-minute expiration:

- **Current Implementation**: [config/sanctum.php L53](file:///home/markc/projects/active/havenstay/backend/config/sanctum.php#L53) sets `'expiration' => env('SESSION_LIFETIME', 120)` (2 hours).
- **Frontend Behavior**: Frontend stores token in `localStorage`. If an API call returns 401, `apiRequest` dispatches `UNAUTHORIZED_EVENT`, clearing state and redirecting to `/login`.
- **Is 120 Minutes Causing a Problem?** **NO EVIDENCE OF DEFECT**.
  - No user complaints, GitHub issues, or test failures exist regarding token expiration.
  - 120 minutes is a standard security baseline for web applications managing financial and personal data.
- **Classification**: **DEFERRED ENHANCEMENT / NOT A DEFECT**.
  - Sliding-window expiration or refresh token rotation is an architectural enhancement, not a bug fix.
  - Proposing to change this in Phase 1 is premature. Keep 120-minute expiration as-is.

---

## 10. Special Audit — Viewer PII Access

Verification of Viewer role data exposure:

- **Audit Finding**: The previous draft Master Work Plan claimed Viewer PII was unmasked on `GET /api/tenants`. **This claim was incorrect.**
- **Code Reality**:
  - [TenantResource.php L38](file:///home/markc/projects/active/havenstay/backend/app/Http/Resources/TenantResource.php#L38) directly invokes `PiiMaskingService::shouldMaskTenantPii($request->user())`.
  - When caller is `Viewer`, `PiiMaskingService::maskTenantArray()` masks `contact_number` (e.g. `+63•••••••1234`), `email` (e.g. `j•••••e@example.com`), sets `emergency_contact_name = 'Access Restricted'`, `emergency_contact_number = '••••••••'`, and `address = 'Access Restricted'`.
  - Because `TenantController::index()` and `TenantController::show()` serialize through `TenantResource`, **Viewer PII masking is fully operational on tenant endpoints.**
- **Actual Remaining Gap**: Verify whether `RoomResource` (which loads `bedSpaces.activeContract.tenant`) applies PII masking when serializing nested tenant objects for Viewers.

---

## 11. Special Audit — CI / Testing Architecture

Evaluation of SQLite vs. MySQL in CI:

- **Current State**:
  - GitHub Actions (`tests.yml`) spins up `ubuntu-latest`, installs PHP 8.4/8.5 with `sqlite, pdo_sqlite`, and runs `php artisan test`.
  - [TestCase.php L89-93](file:///home/markc/projects/active/havenstay/backend/tests/TestCase.php#L89-L93) explicitly stubs out `assertTriggerAuditLog` on SQLite: `$this->assertTrue(true)`.
  - Runtime is ~45 seconds.
- **Risk**: 
  - None of the 45 triggers (including table audit capture and immutability guards) are tested during pull requests or master pushes.
  - Any SQL trigger syntax error or trigger regression will pass CI and deploy directly to production.
- **Options**:
  - *Option A*: Add a MySQL 8.4 service container to `.github/workflows/tests.yml` and execute `composer test:mysql`. (Adds ~35s to CI run).
  - *Option B*: Keep SQLite for quick PR checks; add a separate `mysql-triggers.yml` workflow that runs only on merge to `master` and scheduled daily cron.
- **HUMAN DECISION REQUIRED**: Choose between Option A (maximum protection on all PRs) vs. Option B (fast PR feedback, master verification).

---

## 12. Backlog Audit & Correction

Every item in the draft backlog was evaluated to eliminate premature enhancements and preserve only verified defects and approved requirements.

| Backlog ID | Draft Title | Previous Class | Validated Classification | Evidence & Corrective Decision |
| :- | :--- | :--- | :--- | :--- |
| **HS-EP01-01** | Update `CLAUDE.md` and Documentation | Task | **REQUIRED CORRECTION** | `CLAUDE.md` documents a stale 3-arg write signature; `README.md` documents non-existent bed states. |
| **HS-EP02-01** | Rent Control Cap on Renewal | Business Rule | **RESEARCH / SPIKE** | R.A. 9653 7% cap requires legal scope verification before hardcoding in new contract creation. |
| **HS-EP02-02** | Configurable Meter Dial Capacity | Enhancement | **BUSINESS DECISION** | Dial capacity is 10,000. Requires operational confirmation of actual hardware in use. |
| **HS-EP03-01** | Fix Tenant Reactivate Route Collision | Defect | **REQUIRED CORRECTION** | Route points to missing method; throws 500. Route to `restore()` or delete route. |
| **HS-EP03-02** | Refactor Architectural Convention Tests | Test Defect | **REQUIRED CORRECTION** | 4 Unit convention tests fail because they assert outdated controller patterns instead of FormRequests. |
| **HS-EP04-01** | Restore Payment Remarks Persistence | Defect | **REQUIRED CORRECTION** | Verified data loss: UI and Service send `remarks`, but column is missing from schema and `$fillable`. |
| **HS-EP04-02** | Byte-for-Byte Schema Synchronization | Defect | **REQUIRED CORRECTION** | `db/` has `VARCHAR(255)`; `backend/` has `TEXT`. Standardize to `TEXT` across both files. |
| **HS-EP05-01** | Viewer PII Masking on Tenant Endpoints | Security Gap | **INVALID / UNSUPPORTED** | **DEBUNKED**: `TenantResource` already masks PII for Viewers. Check nested room occupants instead. |
| **HS-EP05-02** | Sliding-Window Token Expiration | Enhancement | **DEFERRED ENHANCEMENT** | 120-minute expiration is working as designed. Not a defect. |
| **HS-EP06-01** | Unsettled Deposit Alert Queue | Feature | **BUSINESS DECISION** | Business must first establish deposit forfeiture/settlement policy. |
| **HS-EP07-01** | Bulk Monthly Room Billing Wizard | Feature | **DEFERRED ENHANCEMENT** | SRS explicitly states automated/bulk billing is out of scope for current release. |
| **HS-EP08-01** | Rollover Confirmation Modal in UI | UX Improvement | **ENHANCEMENT** | Meter reading form already supports `is_rollover` checkbox. Adding a modal is an enhancement. |
| **HS-EP09-01** | Unify CSV Export Audits in Service | Refactoring | **TECHNICAL DEBT** | Export audits work, but bypass `AuditService` helper. Low risk cleanup. |
| **HS-EP10-01** | Overdue Aging Analysis (30/60/90 Days)| Reporting Feature | **DEFERRED ENHANCEMENT** | Product enhancement for future reporting cycle. |
| **HS-EP11-01** | Replayed Idempotency Badge in UI | UX Improvement | **ENHANCEMENT** | Informative badge; not blocking core functionality. |
| **HS-EP12-01** | Feature Test Suite for `HandleIdempotency` | Test Gap | **REQUIRED CORRECTION** | Critical financial guard has zero tests. Must be verified with automated test suite. |
| **HS-EP12-02** | Add MySQL Container to GitHub Actions CI | DevOps Defect | **REQUIRED CORRECTION** | 45 triggers are completely unverified in pull request pipelines. |

---

## 13. Audit Prioritization

Work items are classified across concrete risk and dependency dimensions:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CORRECTED PRIORITY HIERARCHY                          │
│                                                                             │
│   BLOCKING DEFECTS (Execute First)                                          │
│   • HS-EP04-01: Fix payment `remarks` data loss in schema & model           │
│   • HS-EP04-02: Byte-for-byte synchronize canonical schema files            │
│   • HS-EP03-01: Fix broken `POST /api/tenants/{tenant}/reactivate` route     │
│   • HS-EP03-02: Update failing architectural convention tests               │
│   • HS-EP12-01: Build comprehensive test suite for `HandleIdempotency`      │
│                                                                             │
│   HIGH RISK / CI VERIFICATION                                               │
│   • HS-EP12-02: Add MySQL 8.4 service container to CI for trigger testing   │
│   • HS-EP01-01: Synchronize `CLAUDE.md` and `README.md` with verified code  │
│                                                                             │
│   REQUIRES STAKEHOLDER DECISION                                             │
│   • DEC-01: Payment remarks schema column naming (`remarks` vs `notes`)     │
│   • DEC-02: Deposit forfeiture accounting policy upon move-out              │
│   • DEC-03: Bed space and tenant status during `pending_payment` stage      │
│   • DEC-04: Meter rollover dial wrap configuration model                    │
│                                                                             │
│   REQUIRES RESEARCH / SPIKE                                                 │
│   • RES-01: Legal scope of R.A. 9653 rent control on boarding house beds    │
│   • RES-02: Nested occupant PII masking in `RoomResource`                   │
│                                                                             │
│   DEFERRED ENHANCEMENTS (Post-Stabilization)                                │
│   • Sliding-window session token extension                                  │
│   • Bulk room billing wizard                                                │
│   • Overdue aging reporting (30/60/90 days)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 14. Missing Requirements Inventory

Areas not addressed in existing documentation that emerged from code analysis:

1. **Deposit Forfeiture / Damage Deduction Workflow**:
   - The system tracks deposit payments, refunds, and rollovers, but lacks a mechanism to record partial or full deposit deductions for property damages, cleaning fees, or unpaid utility balances.
2. **Offline Room Bed Protection Invariant**:
   - When a room is placed in `maintenance` or `decommissioned`, individual bed spaces remain marked `vacant` in the database. While UI hints exist, an API request to `POST /api/contracts` specifying a bed in an offline room is currently prevented only by service-level checks, not database invariants.
3. **Floating-Point Currency Drift vs. BCMath**:
   - The system uses PHP `float` casting for monetary balances, relying on `- 0.01` tolerances in validation guards. There is no documented requirement defining whether HavenStay permits a 1-cent write-off or if integer-cent / BCMath precision is required.
4. **Disaster Recovery & Replication Lag Alerting**:
   - The primary/replica split relies on `sticky => true` within a single request, but cross-request replication lag (e.g. read immediately following a redirect) has no health check or lag alerting.

---

## 15. Decision Register

| Decision ID | Topic | Current Evidence | Options | Consequence | Required Decision From Human | Status |
| :- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DEC-01** | Payment Remarks Column Naming | FormRequest sends `remarks`; UI renders `remarks`; Service writes `remarks`; `PaymentResource` maps `notes`. | **Option A**: Add `remarks VARCHAR(255) NULL` to schema and align `PaymentResource`.<br>**Option B**: Change all layers to `notes`. | Option A matches form request and UI inputs; requires single DDL addition. | Approve adding `remarks VARCHAR(255) NULL` to `payments` table schema. | **PENDING HUMAN DECISION** |
| **DEC-02** | Deposit Forfeiture Handling | Contracts completed with unpaid balance leave `is_cleared = false`. | **Option A**: Add `'forfeiture'` category to `payments.payment_category` enum.<br>**Option B**: Handle via `adjustment` billing line item and manual clearance. | Option A maintains explicit forensic ledger of retained deposits. | Approve adding `forfeiture` payment category or formalize operational manual process. | **PENDING HUMAN DECISION** |
| **DEC-03** | `pending_payment` Entity States | Creating a lease marks bed `occupied` and tenant `active` before initial payment. | **Option A**: Keep current behavior (immediate reservation lock).<br>**Option B**: Keep bed `vacant` in DB with reservation timestamp; keep tenant `onboarded`. | Option A prevents double-booking but temporarily skews occupancy metrics if tenant fails to pay. | Confirm if immediate occupancy lock during pending payment is acceptable. | **PENDING HUMAN DECISION** |
| **DEC-04** | Deprecated Tenant Reactivate Route | `POST /api/tenants/{tenant}/reactivate` throws 500 error. | **Option A**: Point route to `TenantController::restore`.<br>**Option B**: Delete route completely from `routes/api.php`. | Option A preserves frontend backward compatibility if used by legacy links. | Decide whether to redirect route to `restore()` or delete route. | **PENDING HUMAN DECISION** |
| **DEC-05** | CI MySQL Verification Strategy | Triggers untested in CI; SQLite stubs out audit log checks. | **Option A**: Add MySQL 8.4 service container to `tests.yml`.<br>**Option B**: Create separate scheduled/master-only `mysql-triggers.yml`. | Option A adds ~35s to PRs; Option B keeps fast PRs but delays trigger feedback to master. | Select Option A (full coverage on PRs) or Option B (master-only). | **PENDING HUMAN DECISION** |

---

## 16. Research Register

| Research ID | Question | Type | Why Needed | Source Needed | Decision Informed | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RES-01** | Does Philippine R.A. 9653 rent control apply to individual boarding house bed leases? | Legal | R.A. 9653 governs residential units; boarding houses often operate under commercial lodging ordinances. Hardcoding 7% annual rent cap may be legally incorrect. | DHSUD Regulations / Legal Counsel | Enforcing 7% renewal rent increase limit in `ContractService`. | **OPEN** |
| **RES-02** | What physical sub-meter models are installed in the HavenStay boarding house? | Domain / Hardware | `Financials.php` hardcodes 10,000.0 dial wrap. If 5- or 6-digit electronic meters are installed, rollover math will compute erroneous negative consumption. | Facility Hardware Inspection | Adding `dial_capacity` column to `meters` table schema. | **OPEN** |
| **RES-03** | Does `RoomResource` leak unredacted tenant PII to Viewers? | Security | `TenantResource` masks PII, but room occupancy endpoints load nested tenant relations (`bedSpaces.activeContract.tenant`). | Code Inspection & Test | Updating `RoomResource` to apply PII masking to nested tenant records. | **OPEN** |
| **RES-04** | What is the failure mode if an unhandled floating-point precision error occurs during billing sync? | Accounting / Financial | Code uses `(float)` casting and `- 0.01` tolerances. | Code Simulation | Migrating to `BCMath` / integer cent storage. | **OPEN** |

---

## 17. Corrected Project Documentation Structure

```text
docs/
├── product/
│   ├── vision.md               # [AUTHORITATIVE] Product vision, personas, scope
│   ├── requirements.md         # [AUTHORITATIVE] Functional (FR) & Non-functional (NFR) specs
│   └── backlog.md              # [WORKING] Validated, prioritized engineering backlog
│
├── domain/
│   ├── business-rules.md       # [AUTHORITATIVE] Formal BR-* register
│   ├── domain-model.md         # [AUTHORITATIVE] Entity definitions and relationships
│   └── state-machines.md       # [AUTHORITATIVE] State transitions (Bed, Contract, Billing, etc.)
│
├── architecture/
│   ├── architecture.md         # [AUTHORITATIVE] System topology and read/write split
│   ├── audit-forensics.md      # [AUTHORITATIVE] 45-trigger architecture and session context
│   ├── idempotency.md          # [AUTHORITATIVE] Mutating request locking and replay design
│   └── data-architecture.md    # [AUTHORITATIVE] Schema DDL, triggers, and migrations
│
├── engineering/
│   ├── master-plan-validation.md # [EVIDENCE] This authoritative validation audit
│   ├── invariant-audit.md      # [EVIDENCE] Verified architectural invariants
│   └── technical-debt.md       # [WORKING] Tracked code smells and convention test issues
│
└── decisions/
    ├── ADR-001-static-services-architecture.md
    ├── ADR-002-trigger-based-forensics.md
    ├── ADR-003-dual-path-payment-resolution.md
    └── ADR-004-idempotency-operator-precedence.md
```

---

## 18. Final Output & Synthesis

### 1. What We Know (Verified Facts)
- `HandleIdempotency` correctly guards mutating requests (`POST`/`PUT`/`PATCH`/`DELETE`) and bypasses safe requests (`GET`/`HEAD`).
- Zero automated tests exist for idempotency.
- `ManagesWorkflows::runWriteWorkflow()` takes 5 arguments (`int $actorId`), not 3 (`User $actor`).
- Bed spaces support exactly 3 states (`vacant`, `occupied`, `maintenance`).
- `PaymentService` silently drops `remarks` because it is missing from schema and `$fillable`.
- `db/havenstay_schema.sql` and `backend/database/sql/havenstay_schema.sql` have drifted on line 70 (`VARCHAR(255)` vs `TEXT`).
- 4 Architectural convention tests fail against FormRequest authorization.
- `POST /api/tenants/{tenant}/reactivate` routes to a non-existent method, causing HTTP 500 errors.
- CI runs SQLite only; the 45 MySQL triggers and CHECK constraints are unverified in CI.
- `TenantResource` already masks tenant PII for Viewers.

### 2. What We Believe (Strongly Supported Interpretations)
- Payment `remarks` was intended to be saved, as evidenced by UI inputs, FormRequest validation rules, and service write payloads.
- The 10,000 dial wrap rollover threshold in `Financials.php` was written assuming standard 4-digit mechanical sub-meters.
- The 7% rent increase limit in `OperationalHardening.php` was based on a historical R.A. 9653 HUDCC annual cap.

### 3. What We Don't Know (Unknowns Requiring Investigation)
- Whether the boarding house facility uses mechanical or electronic digital sub-meters (RES-02).
- Whether local municipal regulations classify the facility as a residential rental under R.A. 9653 or as commercial lodging (RES-01).
- Whether nested tenant data inside `RoomResource` is properly masked for Viewers (RES-03).
- What production replication topology Aiven currently runs.

### 4. What Is Wrong (Verified Defects)
- Silent data loss of `remarks` in `PaymentService::record`.
- Schema mirror drift between `db/` and `backend/` schema files.
- Broken route `POST /api/tenants/{tenant}/reactivate` throwing `BadMethodCallException`.
- Stale regex assertions in 4 unit convention tests.
- Complete omission of idempotency tests.
- Complete omission of MySQL trigger execution in CI.

### 5. What Requires Business Decisions
- **DEC-01**: Column name for payment remarks (`remarks` vs `notes`).
- **DEC-02**: Policy for deposit forfeiture when damages occur upon move-out.
- **DEC-03**: Entity status lifecycle during `pending_payment` contract stage.
- **DEC-04**: Tenant reactivation route disposal (`restore` vs deletion).
- **DEC-05**: CI MySQL testing strategy (every PR vs master-only).

### 6. What Requires Research
- **RES-01**: Legal applicability of R.A. 9653 rent control caps.
- **RES-02**: Facility hardware sub-meter specifications.
- **RES-03**: Audit of nested relation PII exposure across resources.

### 7. What Should Become Backlog Items (Corrected Backlog)
1. **HS-BL-01 (Data Integrity)**: Add `remarks VARCHAR(255) NULL` to schema, add to `Payment::$fillable`, and align `PaymentResource`.
2. **HS-BL-02 (Data Integrity)**: Synchronize `havenstay_schema.sql` files byte-for-byte to `TEXT NULL` with LF line endings.
3. **HS-BL-03 (Architecture)**: Resolve broken `{tenant}/reactivate` route and update `TenantArchitectureConventionTest`.
4. **HS-BL-04 (Architecture)**: Refactor failing convention tests to verify FormRequest authorization.
5. **HS-BL-05 (Testing)**: Build comprehensive Pest feature test suite for `HandleIdempotency`.
6. **HS-BL-06 (Testing/DevOps)**: Add MySQL 8.4 service container to GitHub Actions CI to test triggers.
7. **HS-BL-07 (Documentation)**: Update `CLAUDE.md` and `README.md` to match verified signatures and states.

### 8. What Should NOT Be Implemented Yet (Premature / Blocked Changes)
- **DO NOT** implement sliding-window token expiration (no verified problem or requirement).
- **DO NOT** implement bulk billing wizards (out of scope for current release).
- **DO NOT** enforce 7% rent caps on new renewal contracts until legal verification is completed.
- **DO NOT** modify meter rollover math until physical meter hardware is inspected.
- **DO NOT** refactor `HandleIdempotency.php` logic (it is mathematically correct).

### 9. Recommended Next Phase
**Execute Phase 1 Decision Gates**: Submit Decisions `DEC-01`, `DEC-04`, and `DEC-05` for human approval. Upon approval, implement the 6 verified defect corrections (`HS-BL-01` through `HS-BL-06`) as isolated vertical slices.
