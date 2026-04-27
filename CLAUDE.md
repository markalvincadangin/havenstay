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
    ├── backend/        Laravel 14 API
    ├── frontend/       Next.js 16 App Router SPA
    ├── db/             Canonical schema SQL
    ├── design-system/  UI/UX specification
    └── docs/           SRS, SDD, project docs

---

## 2. Tech Stack

| Layer        | Technology          | Version   |
|--------------|---------------------|-----------|
| Backend      | Laravel (PHP)       | 14 / 8.3+ |
| Auth         | Laravel Sanctum     | 4.3       |
| Frontend     | Next.js, React      | 16 / 19   |
| Styling      | Tailwind CSS        | v4        |
| Database     | MySQL InnoDB        | 8.4+      |
| Infrastructure | Docker Compose    | 3.8+      |

Stack is locked. Do not introduce new frameworks or ORMs.

---

## 3. Database Requirements

These requirements come from the course specification and are treated as
architectural constraints. They must not be removed or worked around.

| ID      | Requirement                        | Where implemented                          |
|---------|------------------------------------|--------------------------------------------|
| CCR-001 | ≥ 6 relational entities            | 16 tables in `db/havenstay_schema.sql`     |
| CCR-002 | Distributed DB (primary-replica)   | `docker-compose.yml`                       |
| CCR-003 | Full CRUD operations               | All service classes                        |
| CCR-004 | SQL operators: AND, OR, BETWEEN, LIKE | Filter methods in service classes       |
| CCR-005 | Multi-table JOINs                  | 6 reporting views (`vw_*`)                 |
| CCR-006 | Explicit transactions              | `DB::transaction()` in write services      |
| CCR-007 | Application-level transaction logs | `transaction_logs` table + `TransactionService` |
| CCR-008 | DB triggers for change logging     | 42 triggers in schema, fires into `audit_logs` |

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

Every write operation that touches a transactional table follows this pattern:

```php
// 1. Log the business intent (survives rollback)
$tx = TransactionService::logStarted('operation_name', $actor->user_id, $details);

// 2. Set database session variables for forensic triggers
AuditService::setAuditUserContext($actor->user_id);
AuditService::setCorrelationContext($tx['correlation_id']);

try {
    $result = DB::transaction(function () use (...) {
        // executes business logic
    });

    // 3. Mark the log as committed
    TransactionService::logCommitted($tx['correlation_id'], [...details]);

    return $result;
} catch (\Throwable $e) {
    // 4. Mark as rolled back on error
    TransactionService::logRolledBack($tx['correlation_id'], $e->getMessage());
    throw $e;
} finally {
    // 5. Clean up correlation context
    AuditService::clearCorrelationContext();
}
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
- Critical writes must follow the standard transaction/audit flow (logStarted -> set contexts -> transaction -> commit/rollback).
- Controller handles request validation; Service handles domain invariants and business rules.

---

## 5. Database Schema Rules

The canonical schema is `db/havenstay_schema.sql`. 

### Column naming — authoritative reference

| Concept           | Column name in schema  | Notes                              |
|-------------------|------------------------|------------------------------------|
| Audit actor       | `changed_by`           | FK to `users.user_id`, nullable    |
| Audit entity      | `target_table`         | Name of the affected table         |
| Audit record      | `record_id`            | Affected row PK (unsigned bigint)  |
| Audit timestamp   | `changed_at`           | DATETIME default now()             |
| TX log action     | `action`               | Technical operation name string    |
| TX log actor      | `initiated_by`         | FK to `users.user_id`, nullable    |
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
- Table row IDs use the mono prefix format: `#TX-{id}`, `#AUDIT-{id}`,
  `#TENANT-{id}`, etc. Never display bare integers in ID columns.

### Tunnel / Port-Forwarding (Dev)

When testing with remote browsers (Vercel previews, TestSprite):
1. Expose backend (8000) via ngrok: `ngrok http 8000`.
2. Update `backend/.env`: `SANCTUM_STATEFUL_DOMAINS=your-tunnel.ngrok-free.app`.
3. Update `frontend/.env.local`: `BACKEND_INTERNAL_URL=https://your-tunnel.ngrok-free.app`.
4. If exposing frontend (3000): Add tunnel host to `ALLOWED_DEV_ORIGINS` in `.env.local`.
5. Restart both services. Full guide in `docs/DEV_SETUP.md`.

---

## 7. Key Operational Units

- **Auditor**: Handles `audit_logs` (low-level row changes).
- **Ledger**: Handles `transaction_logs` (high-level business events).
- **Core**: Users, Tenants, Rooms, Contracts.
- **Finances**: Billing, Payments.
- **Metering**: Utilities, Meters, Assignments, Readings.
