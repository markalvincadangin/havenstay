# ADR-005: MySQL Trigger Verification Strategy in GitHub Actions CI

> **Status**: `AWAITING HUMAN APPROVAL`  
> **Date**: September 25, 2026  
> **Deciders**: Systems Architect, DevOps / Infrastructure Lead, Quality Lead  
> **Technical Scope**: GitHub Actions CI/CD Pipeline, MySQL Service Container, Database Trigger Testing  

---

## Context

HavenStay utilizes an advanced forensic database architecture with 45 engine-level MySQL triggers on tables including `billing`, `contracts`, `payments`, `users`, `rooms`, `bed_spaces`, `meters`, and `audit_logs`. These triggers enforce immutability of audit records, automatic timestamp tracking, correlated forensic context capture (`@forensic_context`), and non-bypassable data integrity invariants.

---

## Problem

The current GitHub Actions CI workflow runs exclusively against an in-memory SQLite database. Because SQLite does not execute MySQL-specific trigger syntax or procedural blocks:
- [TestCase.php L89-93](file:///home/markc/projects/active/havenstay/backend/tests/TestCase.php#L89-L93) explicitly stubs out `assertTriggerAuditLog` when running on SQLite: `$this->assertTrue(true)`.
- Consequently, **zero of HavenStay's 45 MySQL audit triggers and CHECK constraints are executed or verified in CI**.
- Any syntax error, broken trigger reference, or DDL regression can pass CI cleanly and fail only upon deployment to production.

---

## Evidence

1. **Current CI Configuration**: [.github/workflows/tests.yml L25-45](file:///home/markc/projects/active/havenstay/.github/workflows/tests.yml#L25-L45) configures `ubuntu-latest` with `extensions: sqlite, pdo_sqlite` and executes `php artisan test`.
2. **The SQLite Bypass**: [TestCase.php L89-93](file:///home/markc/projects/active/havenstay/backend/tests/TestCase.php#L89-L93):
   ```php
   if (config('database.default') !== 'mysql') {
       $this->assertTrue(true); // SQLite fallback
       return;
   }
   ```
3. **Dedicated MySQL Test Command Already Exists**: `backend/composer.json` defines `"test:mysql": "php artisan test --configuration=phpunit.mysql.xml"`.
4. **Local Docker Parity**: `docker-compose.yml` runs `mysql:8.4` using the exact canonical DDL from `docker/primary-init.sql`.

---

## Options Considered

### Option A: MySQL 8.4 Service Container on Every PR (Recommended)
Add a `mysql:8.4` service container to `.github/workflows/tests.yml`. Initialize the database using `havenstay_schema.sql` and run `composer test:mysql` on every pull request and push to `master`.
- *Consequences*: 100% verification of production DDL, triggers, and immutability invariants before code merge. Increases CI runtime by ~35s (total run ~80–85s).

### Option B: SQLite PR Checks + Master/Nightly MySQL Pipeline
Keep the fast SQLite test run on PRs (~40s); create a separate workflow `mysql-triggers.yml` that runs MySQL trigger tests on merge to `master` and on a nightly schedule.
- *Consequences*: Preserves fast PR cycle, but delays trigger regression detection until after code is already merged to master.

### Option C: Status Quo (SQLite Only)
Retain SQLite-only testing; rely entirely on developers manually executing `composer test:mysql` locally via Docker before submitting PRs.
- *Consequences*: High risk of silent production failure; completely unacceptable for a financial management application.

---

## Decision

**Proposed Decision**: Adopt **Option A**. Add the `mysql:8.4` service container to the primary GitHub Actions workflow to guarantee 100% trigger verification on every PR.

*(Subject to explicit human stakeholder approval).*

---

## Rationale

1. **Total CI Time is Negligible**: Adding MySQL adds ~35 seconds. An 80-second CI run is exceptionally fast and well within developer feedback expectations.
2. **Financial Auditing Protection**: In HavenStay, audit triggers are not optional logging; they are engine-enforced compliance records. Allowing untested trigger code into `master` undermines the forensic integrity of the entire system.
3. **Eliminates Configuration Drift**: Developing on SQLite while deploying to MySQL inevitably leads to subtle syntax discrepancies and missed constraint failures.

---

## Consequences

### Positive
- Every pull request executes against the real MySQL 8.4 engine.
- All 45 triggers and CHECK constraints are actively validated on every commit.
- Stubs like `$this->assertTrue(true)` are eliminated from automated quality gates.

### Negative / Trade-offs
- CI runner minutes increase by ~35 seconds per build (well within GitHub Actions free tier allowance).

---

## Rejected Alternatives

- **Option B (Master-only)**: Rejected because broken triggers discovered post-merge block other developers and create master branch instability.
- **Option C (SQLite only)**: Rejected as unacceptable for production financial and occupancy software.

---

## Acceptance Criteria

1. `.github/workflows/tests.yml` provisions a `mysql:8.4` container.
2. Canonical schema `backend/database/sql/havenstay_schema.sql` initializes cleanly without SQL errors.
3. CI executes `composer test:mysql` and passes with 100% green status.
4. `assertTriggerAuditLog` actively queries `audit_logs` and passes.

---

## Related Requirements

- `REQ-020`: Immutable forensic audit logging via database triggers
- `NFR-004`: Database trigger execution and test integrity
- `BR-AUD-001`: Automatic trigger-based event logging

---

## Related Backlog Items

- `HS-BL-06`: MySQL 8.4 CI verification (Readiness Card approved for Phase 1, Slice 4).
