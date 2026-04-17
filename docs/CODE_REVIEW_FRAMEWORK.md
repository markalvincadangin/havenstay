# HavenStay Full-Stack Code Review Framework

Version: 1.0  
Status: Active baseline for engineering quality reviews  
Owner: Project Management + Technical Leads

## 1. Purpose

This framework defines a repeatable, full-stack review system to validate implementation quality against HavenStay core documentation:

- `docs/SRS.md` (requirements contract, what)
- `docs/SDD.md` (technical design, how)
- `docs/API_REFERENCE.md` (integration contract)
- `docs/DATABASE.md` and `db/havenstay_schema.sql` (data-layer authority)
- `docs/TEST_PLAN.md` (verification evidence)
- `docs/PROJECT_PLAN.md` (scope and delivery commitments)

The review process is designed to:

1. Detect implementation drift early.
2. Improve maintainability and testability.
3. Enforce coding and documentation standards.
4. Remove low-value or robotic documentation/commentary.
5. Stay reusable for future projects through extension modules.

## 2. Governance and Review Cadence

### 2.1 Review Cadence

- PR Review: mandatory on every pull request.
- Weekly Deep Review: module-level health and architecture checks.
- Release Gate Review: final readiness before merge-to-main release candidate.

### 2.2 Reviewer Roles

- Review Lead: scope owner and final gate decision.
- Backend Reviewer: services, controllers, models, schema alignment.
- Frontend Reviewer: API integration, state, and rendering behavior.
- Quality Reviewer: architecture, DRY, lint/test health.
- Documentation Reviewer: requirements parity and documentation discipline.

### 2.3 Severity Levels

- Critical: security, data integrity, major requirements breach; blocks merge.
- High: functional mismatch/regression risk; must be resolved before merge.
- Medium: maintainability/performance concern; fix now or ticketed with owner.
- Low: style/readability optimization; include in debt queue.

## 3. Review Areas and Structured Checklists

## A. Backend Execution

### Objective

Verify backend implementation aligns with business rules, service boundaries, and canonical schema constraints.

### Checklist

- Modules and Service Design
  - [ ] Business logic is implemented in service classes, not controllers.
  - [ ] Cross-module dependencies are explicit and minimal.
  - [ ] Service methods have clear contracts (inputs, validation, outputs).
  - [ ] Transaction boundaries are explicit for multi-write workflows.

- Controllers and API Behavior
  - [ ] Controllers are thin: request validation, authorization, delegation, response mapping.
  - [ ] HTTP responses/status codes match `docs/API_REFERENCE.md`.
  - [ ] Role authorization behavior matches SRS/API definitions.

- Models and Database Alignment
  - [ ] Table fields and data types align with `db/havenstay_schema.sql`.
  - [ ] Enum domains and allowed statuses are synchronized across code/docs/DB.
  - [ ] Nullability, FK constraints, and uniqueness rules are respected.
  - [ ] Soft-delete/archive behavior matches documented lifecycle rules.

- Data Integrity and Forensics
  - [ ] Write operations maintain transaction-log and audit consistency requirements.
  - [ ] Reporting logic aligns to documented view semantics.
  - [ ] Date/status rules are consistently applied across services and controllers.

- Test Evidence
  - [ ] Feature tests cover happy path, boundary, and failure rollback paths.
  - [ ] Regression tests exist for historically sensitive logic (status transitions, voiding, reconciliation).

### Common Red Flags

- Duplicated business logic across controllers/services.
- Hard-coded status logic conflicting with documented rules.
- Implicit side effects without transaction or audit expectations.

## B. Frontend Integration

### Objective

Ensure frontend behavior accurately reflects API contracts and requirement semantics.

### Checklist

- API Consumption
  - [ ] Requests are routed through shared API client abstractions.
  - [ ] Query parameters and payloads align with API contract.
  - [ ] Error/retry/loading states are complete and deterministic.

- State Management
  - [ ] State ownership is clear (local, shared, server-derived).
  - [ ] No duplicated source of truth for the same domain value.
  - [ ] Filter/sort/pagination state transitions are predictable.

- UI Rendering
  - [ ] Displayed statuses and labels match SRS business semantics.
  - [ ] Currency/date formatting uses shared formatters and locale rules.
  - [ ] Empty/error/no-access states are consistently handled.

- UX + Workflow Integrity
  - [ ] Confirmations exist for destructive operations.
  - [ ] UI authorization/visibility aligns with RBAC requirements.
  - [ ] User-facing copy is clear, humanized, and context-appropriate.

- Test Evidence
  - [ ] Component/integration coverage includes major interaction flows.
  - [ ] API contract changes are reflected in frontend tests and assertions.

### Common Red Flags

- UI labels and backend semantics diverge for the same status/filter.
- Direct endpoint coupling bypasses shared API utilities.
- Synchronous state updates in effects causing unstable rendering.

## C. Code Quality

### Objective

Maintain modularity, testability, and long-term maintainability.

### Checklist

- Modularity and Separation of Concerns
  - [ ] Files/classes/functions have clear single responsibility.
  - [ ] Domain logic, transport logic, and presentation logic are separated.
  - [ ] Shared helpers/utilities are extracted where repetition exists.

- DRY and Maintainability
  - [ ] Repetitive query/validation/formatting logic is consolidated.
  - [ ] No dead code, stale imports, or obsolete feature toggles.
  - [ ] Naming is domain-expressive and consistent across layers.

- Reliability and Performance Hygiene
  - [ ] No obvious unbounded loops, heavy repeated computation, or overfetching.
  - [ ] Error handling preserves context and does not swallow failures.
  - [ ] Key paths include at least one guardrail or regression test.

- Static and Automated Quality Gates
  - [ ] Lint and test commands pass for touched modules.
  - [ ] New warnings are either resolved or documented with rationale.

### Common Red Flags

- God classes/components with mixed responsibilities.
- Copy-paste logic across multiple files.
- Comments that narrate obvious code instead of intent.

## D. Standards and Humanization

### Objective

Enforce professional conventions while removing robotic or AI-generated documentation style.

### Checklist

- Coding Standards
  - [ ] Language/framework conventions are consistently followed.
  - [ ] Error, logging, and response conventions remain uniform.
  - [ ] Security and privacy-sensitive handling follows documented constraints.

- Comment and Documentation Quality
  - [ ] Comments explain intent, rationale, or constraints.
  - [ ] Generic AI-like filler comments are removed.
  - [ ] Internal docs avoid repetitive templated phrasing.
  - [ ] Terminology remains consistent with SRS/SDD/API docs.

- Collaboration Hygiene
  - [ ] PR descriptions explain why, impact, and validation.
  - [ ] Commits are scoped and traceable to requirement/test IDs where practical.

### Common Red Flags

- Boilerplate comment blocks with no engineering value.
- Inconsistent domain terminology across docs and code.
- Overly verbose, non-specific remediation notes.

## E. Documentation Parity

### Objective

Verify that code and behavior remain synchronized with formal documentation artifacts.

### Checklist

- Requirements and Design Parity
  - [ ] Implemented behavior maps to FR/BR/NFR expectations.
  - [ ] SRS (what) and SDD (how) boundaries are preserved in code comments/docs.
  - [ ] Architectural assumptions in SDD are reflected in implementation patterns.

- Interface and Data Parity
  - [ ] API request/response contracts match `docs/API_REFERENCE.md`.
  - [ ] Data objects and constraints match `docs/DATABASE.md` and canonical DDL.
  - [ ] Canonical and runtime schema references are consistent.

- Validation Parity
  - [ ] Test evidence exists for critical FR/BR/NFR expectations.
  - [ ] Test mappings and IDs in `docs/TEST_PLAN.md` remain current.
  - [ ] Known exceptions/deviations are documented with owner and target date.

### Common Red Flags

- Requirements implemented but not reflected in tests/docs.
- API behavior changed without API reference updates.
- Baseline version drift across core documents.

## F. Design System & Operational Excellence

### Objective

Enforce the "Command Center" operational aesthetic, ensuring high-density scannability and premium UI consistency defined in `MASTER.md`.

### Checklist

- UI Component Authority
  - [ ] Standardized components like `PageHeaderActions`, `KpiCard`, and `ResourceIdCell` are used instead of ad hoc implementations.
  - [ ] Navigational consistency: `backHref` and User context are present in all operational headers.
  - [ ] Action consistency: `primaryLinkCtaClass` and `secondaryOutlineLinkClass` tokens are leveraged for all primary/secondary actions.

- Typography and Density
  - [ ] Metadata labels and table headers follow the `text-[10px] font-black uppercase tracking-widest` standard.
  - [ ] KPI indicators maintain the high-density `font-black` operational weight.
  - [ ] Table cells for IDs and currency use `DM Mono` with `tabular-nums`.

- Scannability and Forensic Clarity
  - [ ] ID columns use full prefixes (e.g., `#TENANT-`, `#BILL-`) for forensic traceability.
  - [ ] Tables use `embedded` semantics correctly inside registry cards.
  - [ ] Status badges follow the semantic color mapping in `MASTER.md`.

### Common Red Flags

- "Floating" buttons or titles that bypass the `PageHeaderActions` container.
- Use of non-standard font weights (e.g., `font-bold` instead of `font-black`) in summary strips or metadata.
- Inconsistent spacing in form sections (`p-8` registry card standard).

## 4. Review Report Template

Use this structure for each formal review cycle:

### 4.1 Executive Summary

- Scope:
- Branch or milestone:
- Overall decision: Pass / Pass with Conditions / Fail
- Release risk level:
- Top blockers:

### 4.2 Findings by Severity

- Critical:
- High:
- Medium:
- Low:

Each finding should include:

- ID
- Area (A-E)
- Description
- Impact
- Owner
- Due Date

### 4.3 Scorecard Snapshot

- Backend Execution:
- Frontend Integration:
- Code Quality:
- Standards and Humanization:
- Documentation Parity:
- Design System Excellence:

### 4.4 Actionable Recommendations

For each recommendation:

- Action
- Priority
- Owner
- Effort estimate
- Success metric
- Planned sprint

### 4.5 Sign-off

- Review Lead:
- Backend Reviewer:
- Frontend Reviewer:
- Documentation Reviewer:
- Final decision:

## 5. Adaptation for Future Projects

This framework is intentionally extensible.

### 5.1 Core-Plus Extension Model

Keep Sections A-E as the universal core, then append optional modules:

- Security and Compliance Extension
- Performance and Reliability Extension
- Mobile/Client Platform Extension
- DevOps and Observability Extension

### 5.2 Project Configuration Layer

For each new project, define:

- Domain glossary and naming conventions
- Required artifacts and baseline versions
- Quality gates and severity thresholds
- Mandatory evidence and test coverage expectations

### 5.3 Continuous Improvement Loop

- Track recurring findings by category.
- Convert repeated issues into standards/checklists/automation.
- Review and version this framework quarterly.

## 6. Minimum Adoption Steps

1. Use this document as the team review standard.
2. Enforce PR checklist usage for all production-impact changes.
3. Require links to requirement IDs and validation evidence when applicable.
4. Run weekly deep reviews and summarize risk trends.
5. Apply release gate policy: no open Critical findings and no unowned High findings.
