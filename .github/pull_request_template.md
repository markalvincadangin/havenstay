## Pull Request Summary

### Problem

Describe the issue or requirement this PR addresses.

### Solution

Describe what was changed and why this approach was selected.

### Impact

- Affected modules:
- Risk level: Low / Medium / High
- Breaking change: Yes / No

## Review Checklist

### A. Backend Execution

- [ ] Business logic remains in services; controllers are thin.
- [ ] Data model and constraints align with canonical schema.
- [ ] Authorization and validation behavior follow current contracts.
- [ ] Transaction-sensitive changes include rollback/error handling.

### B. Frontend Integration

- [ ] API consumption matches documented request/response contract.
- [ ] State management is consistent and avoids duplicate sources of truth.
- [ ] UI rendering matches business semantics and edge states are handled.

### C. Code Quality

- [ ] Changes are modular and follow separation of concerns.
- [ ] Repetition was reduced or centralized (DRY).
- [ ] No dead code/stale imports left in touched files.

### D. Standards and Humanization

- [ ] Naming and coding style match project conventions.
- [ ] Comments are intent-driven, not boilerplate or robotic.
- [ ] User-facing copy is clear and context-appropriate.

### E. Documentation Parity

- [ ] `docs/SRS.md` parity checked for impacted FR/BR/NFR.
- [ ] `docs/SDD.md` parity checked for design behavior.
- [ ] `docs/API_REFERENCE.md` updated if API contract changed.
- [ ] `docs/DATABASE.md` and canonical schema reviewed if data rules changed.
- [ ] `docs/TEST_PLAN.md` updated if traceability or evidence changed.

## Validation Evidence

- [ ] Tests executed and passed locally.
- [ ] Lint checks executed and passed for touched areas.
- [ ] Manual QA evidence attached (if applicable).

Provide evidence summary:

```text
- Command(s) run:
- Result:
- Notes:
```

## Traceability Links

List relevant requirement and test references where applicable.

```text
SRS IDs: FR-..., BR-..., NFR-...
Test IDs: TC-...
Docs updated: ...
```
