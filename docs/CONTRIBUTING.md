# HavenStay — Version Control & Collaboration

**Version:** 1.0  
**Last Updated:** June 26, 2026

---

## 1. Branching Strategy (Trunk-Based)

HavenStay currently utilizes a simplified trunk-based branching strategy centered on `master`.

- **`master`** is the protected, deployable source of truth.
- All new work happens in short-lived branches created off `master`.

**Naming Convention:**
```text
feature/<short-description>
fix/<short-description>
docs/<short-description>
chore/<short-description>   # tooling, deps, config
```

*Note:* If the team scales beyond a solo developer, this strategy may evolve to include a `develop` integration branch.

## 2. CI/CD & Deployment Link

**Merging to `master` triggers an automatic production deployment.**
Because Render and Vercel are configured to auto-deploy on pushes to `master`, never merge half-finished or broken work. Every merge to `master` goes live.

## 3. Commit Message Convention

Use **Conventional Commits** to keep the git history scannable:

```text
feat: add property search filters
fix: correct booking date validation logic
docs: update API endpoints
refactor: extract reusable UI component
chore: bump dependencies
```

## 4. Pull Request Workflow

1. Branch off `master`.
2. Commit work in small, logical chunks using conventional commits.
3. Push branch and open a Pull Request into `master`.
4. Fill out the PR template accurately (ensuring local Docker verification with `make up`).
5. **Squash and Merge** the PR to keep `master` history linear and clean.
6. Delete the branch after merging.

## 5. Branch Protection Rules

The following GitHub branch protection rules are applied to `master`:

- **Require status checks to pass:** (`smart-build.yml`). This ensures tests and linting succeed before merge.
- **Require a pull request before merging:** Forces all changes through the PR process, ensuring CI runs and the PR template is filled out.
- **Do NOT allow direct pushes or force pushes.**

> [!NOTE]
> **Aspirational Rule — Required Reviews:** In a solo-developer setup, requiring an approving review (count ≥ 1) will block merges completely. This specific protection rule is deferred until a second contributor is added.

## 6. GitHub Issues (Task Tracking)

Use the predefined Issue Templates (`Bug Report` and `Feature Request`) to track work.

**Standard Labels:**
- `type:` feature / bug / docs / chore
- `priority:` high / medium / low
- `status:` blocked / in-progress / needs-review

## 7. `docs/` Folder Structure

The `docs/` directory serves as the centralized knowledge base:

| File | Purpose |
|:---|:---|
| `README.md` | Entry point, quick start |
| `ARCHITECTURE.md` / `SDD.md` | System overview, diagrams, design decisions |
| `DOCKER.md` | Local development setup |
| `API_REFERENCE.md` | Endpoint definitions |
| `CONTRIBUTING.md` | Version control & collaboration rules (this guide) |
| `DATABASE.md` | Schema, ERD, and data rules |
| `CI_CD.md` | CI/CD pipeline documentation |
| `DEPLOYMENT.md` | Production hosting and deployment guides |

---

*Document Author: HavenStay Infrastructure*
