# CLAUDE.md — HavenStay BHMS

Engineering reference for contributors. Read before making changes.

---

## 1. Project Overview

HavenStay is a web-based Boarding House Management System for small-scale
property operations. It is also an academic deliverable with strict database
requirements that govern schema design. Both concerns are treated as hard
constraints — neither overrides the other.

**Repository layout**

    havenstay/
    ├── backend/        Laravel 13 API
    ├── frontend/       Next.js 16 App Router SPA
    ├── db/             Canonical schema SQL (v5.0 — Forensic Hardened)
    ├── design-system/  UI/UX specification
    └── docs/           SRS, SDD, project docs

---

## 2. Tech Stack

| Layer        | Technology          | Version   |
|--------------|---------------------|-----------|
| Backend      | Laravel (PHP)       | 13 / 8.3+ |
| Auth         | Laravel Sanctum     | 4.x       |
| Frontend     | Next.js, React      | 16 / 19   |
| Styling      | Tailwind CSS v4 + HS-Utilities | — |
| Database     | MySQL InnoDB        | 8.4+      |
| Infrastructure | Docker Compose    | 3.8+      |

Stack is locked. Do not introduce new frameworks or ORMs.

---

## 3. Database Requirements

These requirements come from the course specification and are treated as
architectural constraints. They must not be removed or worked around.

| ID      | Requirement                        | Where implemented                          |
|---------|------------------------------------|--------------------------------------------|
| CCR-001 | ≥ 6 relational entities            | 15 tables in `db/havenstay_schema.sql`     |
| CCR-002 | Distributed DB (primary-replica)   | `docker-compose.yml`                       |
| CCR-003 | Full CRUD operations               | All service classes                        |
| CCR-004 | SQL operators: AND, OR, BETWEEN, LIKE | Filter methods in service classes       |
| CCR-005 | Multi-table JOINs                  | 6 reporting views (`vw_*`)                 |
| CCR-006 | Explicit transactions              | `DB::transaction()` in write services      |
| CCR-007 | DB triggers for change logging     | 45 triggers in schema, fire into `audit_logs` |

### 3.1 Forensic Trigger Architecture (CCR-007)

The system enforces 100% forensic attribution via **45 database triggers** on the MySQL primary. The math is non-standard due to specific integrity guards:

| Component | Math | Total |
| :--- | :--- | :--- |
| **Standard Tables (13)** | 13 tables × 3 AFTER triggers (I/U/D) | 39 |
| **Meter Assignments (1)** | 3 AFTER triggers (I/U/D) + 1 BEFORE INSERT guard | 4 |
| **Audit Logs (1)** | 2 BEFORE triggers (U/D) for immutability | 2 |
| **Total Forensic Engine** | **(13 × 3) + (1 × 4) + 2 = 45** | **45** |

> **Hardening Note:** `meter_assignments` is the only operational table with 4 triggers (the 4th is `trg_meter_assignments_bi` which prevents double-assigning active meters).

> **Decommissioned:** `transaction_logs` table and `TransactionService` have been retired. Forensic integrity is handled exclusively by the 45 unified trigger-based `audit_logs` and `AuditService`. Do not reference or reintroduce `TransactionService` or `transaction_logs`.


---

## 4. Backend Conventions

### Architecture

- Controllers are thin. All business logic lives in `app/Services/`.
- Do not use Laravel Gates or Policies. Use `AuthorizationService` exclusively.
- Use `DB_WRITE_HOST` for write connections, `DB_READ_HOST` for reads.
- `docs/BACKEND_CODING_BLUEPRINT.md` is the implementation standard for backend coding patterns.
- For backend tasks, treat the blueprint as mandatory unless an exception is explicitly documented.
- `docs/FRONTEND_CODING_BLUEPRINT.md` is the implementation standard for frontend coding patterns.
- For frontend tasks, treat the frontend blueprint as mandatory unless an exception is explicitly documented.

### Service method signatures

Write operations always receive a `User $actor` as the first parameter.
Never use `Auth::id()` or `Auth::user()` inside a service method — the
caller passes the actor explicitly. This keeps services testable.

```php
// correct
public static function create(User $actor, array $data): Contract

// wrong — untestable and hides the dependency
public static function create(array $data): Contract
{
    $userId = Auth::id(); // don't do this
}
```

### Transaction and audit wiring

Every write operation uses the `ManagesWorkflows` trait's `runWriteWorkflow()` helper,
which handles correlation ID injection and DB transaction safety automatically:

```php
// In a Service class that uses ManagesWorkflows:
return self::runWriteWorkflow($actor, 'operation_name', function () use ($actor, $data) {
    // AuditService context is already set by the trait.
    // Execute business logic here.
    $contract = Contract::create([...]);
    return $contract;
});
```

For system/CLI contexts (Artisan commands, seeders), set context manually before writes:

```php
AuditService::setSystemContext();
// then proceed with DB::transaction() as normal
```

### Comment style

Write comments that explain intent or non-obvious decisions.
Do not write comments that restate what the code already says.
Avoid scatter-tags (like CCR-001) in function bodies; maintain
traceability in this document and SRS instead.

### Error handling

Use `ValidationException::withMessages()` for domain validation errors.
Do not catch and silently swallow exceptions.

### Controller-Service-Model enforcement

- Controllers may only: authorize, validate request shape, call a service, map response.
- Controllers must not do direct Eloquent writes or complex domain query logic.
- Service write methods must receive `User $actor` as first parameter.
- Never use `Auth::id()` or `Auth::user()` inside service methods.
- All write operations use `self::runWriteWorkflow()` (from `ManagesWorkflows` trait).
- Controller handles request validation; Service handles domain invariants and business rules.

---

## 5. Database Schema Rules

The canonical schema is `db/havenstay_schema.sql`. A byte-for-byte mirror must be
maintained at `backend/database/sql/havenstay_schema.sql`. Any schema change must be
applied to **both** files simultaneously.

### Column naming — authoritative reference

| Concept           | Column name in schema  | Notes                              |
|-------------------|------------------------|-------------------------------------|
| Audit actor       | `changed_by`           | FK to `users.user_id`, nullable    |
| Audit entity      | `target_table`         | Name of the affected table         |
| Audit record      | `record_id`            | Affected row PK (unsigned bigint)  |
| Audit timestamp   | `changed_at`           | DATETIME default now()             |
| Correlation link  | `correlation_id`       | UUID shared across TX + audit rows |
| Contract Status   | `status`               | ENUM including `pending_payment`   |
| Payment Category  | `payment_category`     | billing, deposit, refund, rollover |
| Utility Link      | `utility_id`           | Physical link mandated for utilities|
| Reading Link      | `reading_id`           | Forensic link to meter reading     |

---

## 6. Frontend Conventions

### API client

All backend requests go through `src/lib/api.js → apiRequest()`.
Authentication token is stored in `localStorage` under `havenstay_token`.

### Component patterns

- All monetary values use `formatPHP()` from `lib/formatters.js`.
- All timestamps use locale formatting with `en-PH` locale.
- Table row IDs use the mono prefix format: `#AUDIT-{id}`,
  `#TENANT-{id}`, `#CONTRACT-{id}`, `#PAY-{id}`, etc. Never display bare integers in ID columns.
- Status values must use `<StatusBadge />`. Never hardcode badge colors inline.
- All styling uses Tailwind CSS v4 with the HS-Utility layer. Ensure utility classes follow semantic patterns defined in globals.css.

### Tunnel / Port-Forwarding (Dev)

When testing with remote browsers (Vercel previews, TestSprite):
1. Open ONE tunnel to the frontend (port 3000): `cloudflared tunnel --url http://localhost:3000`
2. Share the `https://<random>.trycloudflare.com` link — Next.js proxies `/api/*` internally.
3. No `.env` changes needed — the backend accepts `*.trycloudflare.com` and `*.ngrok-free.app` via wildcard CORS.
4. Full guide in `docs/DEV_SETUP.md`.

---

## 7. Key Operational Units

- **Auditor**: Handles `audit_logs` (trigger-written row-level change snapshots).
- **Core**: Users, Tenants, Rooms, Contracts.
- **Finances**: Billing, Payments.
- **Metering**: Utilities, Meters, Assignments, Readings.

> **Removed:** `transaction_logs` (Ledger) — decommissioned in v4.6. All forensic integrity is now handled exclusively by `audit_logs` + `AuditService`.
