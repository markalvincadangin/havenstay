# HavenStay Quick Start Guide

> Get started with AI-assisted development on HavenStay

---

## 📚 Documentation Structure

```
havenstay/
├── CLAUDE.md                    # ⭐ Project rules, tech stack, architecture
├── KIRO.md                      # ⭐ Kiro IDE workflows and patterns
├── UI_PROMPTING_GUIDE.md        # ⭐ UI/UX prompting reference
├── QUICK_START.md               # ⭐ This file
│
├── docs/
│   ├── SRS.md                   # Requirements (FR-*, BR-*)
│   ├── SDD.md                   # Architecture and design
│   └── TEST_PLAN.md             # Test cases
│
├── design-system/havenstay/
│   ├── MASTER.md                # Authoritative UI spec (BHMS, components)
│   └── pages/                   # Page-specific designs
│
├── .kiro/
│   ├── steering/                # Auto-loaded context
│   │   ├── project-rules.md     # References CLAUDE.md + KIRO.md
│   │   ├── database-patterns.md # Auto-loads for PHP files
│   │   ├── frontend-patterns.md # Auto-loads for JS/TS files
│   │   └── ui-ux-workflow.md    # Auto-loads for frontend files
│   └── specs/                   # Feature specifications
│
└── .agent/skills/
    └── ui-ux-pro-max/           # UI/UX design skill
```

---

## 🚀 Quick Start

### 1. Read the Core Documentation

**Start here:**
1. Read `CLAUDE.md` completely (15 min)
2. Skim `KIRO.md` for Kiro-specific patterns (10 min)
3. Bookmark `UI_PROMPTING_GUIDE.md` for UI work

**When needed:**
- `docs/SRS.md` — Before implementing features
- `docs/SDD.md` — When designing or refactoring
- `design-system/havenstay/MASTER.md` — When building UI (primary visual + component spec)

### 2. Understand the Tech Stack

**Backend:**
- Laravel 13 (PHP 8.3+)
- MySQL 8.4+ (primary) / SQLite (dev)
- Laravel Sanctum for auth

**Frontend:**
- Next.js 16.2.1 (App Router)
- React 19.2.4
- Tailwind CSS v4

**Locked — No exceptions!**

### 3. Set Up Your Environment

**Backend:**
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan db:seed
php artisan serve
```

**Frontend:**
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

**Demo credentials:**
- Admin: `admin@havenstay.local` / `HavenStay123!`
- Staff: `staff@havenstay.local` / `HavenStay123!`
- Viewer: `viewer@havenstay.local` / `HavenStay123!`

---

## 💬 How to Prompt in Kiro

### General Development

```
"Implement [feature] following the patterns in #CLAUDE.md"

"Fix [bug] - check KIRO.md Section 9.3 for common issues"

"Add a new API endpoint for [resource] following CLAUDE.md Section 6 patterns"
```

### UI/UX Work

```
"Build the [page] page following #design-system/havenstay/pages/[page].md"

"Fix the [page] UI to match the design system and ui-ux-pro-max best practices"

"Use ui-ux-pro-max to create a design system for [new page]"
```

### Working with Specs

```
"Continue working on #.kiro/specs/dashboard-enhancement/tasks.md"

"Implement the next task in the dashboard spec"
```

### Using Context

```
"I'm working on billing. Load relevant context from CLAUDE.md and show me 
what I need to know"

"Use context-gatherer to understand the payment flow before I add refunds"
```

---

## 🎯 Common Workflows

### Adding a New Feature

1. **Read requirements:** Check `docs/SRS.md` for related FRs
2. **Check design:** Read `docs/SDD.md` for architecture
3. **Prompt:** "Implement [feature] following CLAUDE.md patterns"
4. **Test:** Run `getDiagnostics` and tests
5. **Update:** Update traceability matrix if new FR

### Building a New Page

1. **Check design:** Read `design-system/havenstay/pages/[page].md`
2. **Prompt:** "Build [page] following the design system"
3. **Verify:** Check against ui-ux-pro-max checklist
4. **Test:** `npm run lint && npm run build`

### Fixing a Bug

1. **Understand:** Use context-gatherer if complex
2. **Check docs:** Search KIRO.md Section 9.3 for common issues
3. **Prompt:** "Fix [bug] following CLAUDE.md rules"
4. **Verify:** Run diagnostics and tests

### Refactoring Code

1. **Gather context:** Use context-gatherer to find dependencies
2. **Plan:** Read current implementation
3. **Prompt:** "Refactor [component] following best practices"
4. **Test:** Ensure no regressions

---

## ✅ Pre-Commit Checklist

**Backend:**
- [ ] Ran `getDiagnostics` on changed files
- [ ] Ran `php artisan test` (all pass)
- [ ] Verified CCR compliance if database work
- [ ] Called `setAuditUserContext()` before MySQL transactions
- [ ] Updated schema file if database changes

**Frontend:**
- [ ] Ran `getDiagnostics` on changed files
- [ ] Ran `npm run lint` (passes)
- [ ] Ran `npm run build` (succeeds)
- [ ] Checked against ui-ux-pro-max checklist
- [ ] Verified design system compliance

**Documentation:**
- [ ] Updated traceability matrix if new FR
- [ ] Updated CLAUDE.md if architecture changed
- [ ] Updated spec tasks if working from spec

---

## 🔧 Kiro-Specific Tips

### Efficient File Reading

```
# Use readCode for code files (not readFile)
readCode(path="backend/app/Services/BillingService.php")

# Read multiple files at once
readMultipleFiles(paths=["file1.php", "file2.php"])

# Use context-gatherer for complex exploration
invokeSubAgent(name="context-gatherer", prompt="Find all billing-related files")
```

### Multi-File Changes

```
# Use strReplace in parallel for independent changes
strReplace(path="file1.php", oldStr="...", newStr="...")
strReplace(path="file2.php", oldStr="...", newStr="...")

# Use semanticRename for symbol renaming
semanticRename(path="file.php", line=42, character=15, 
               oldName="old", newName="new")

# Use smartRelocate for file moves (auto-updates imports)
smartRelocate(sourcePath="old/path.js", destinationPath="new/path.js")
```

### Testing and Validation

```
# Always use getDiagnostics (not bash commands)
getDiagnostics(paths=["backend/app/Services/BillingService.php"])

# Run tests
executePwsh(command="php artisan test", cwd="backend")
executePwsh(command="npm run lint", cwd="frontend")
```

---

## 📖 Key Concepts

### Course Compliance Requirements (CCR)

8 non-negotiable requirements for academic submission:
- CCR-001: ≥6 entities (we have 11)
- CCR-002: Distributed DB (MySQL primary-replica)
- CCR-003: SQL CRUD operations
- CCR-004: SQL operators (AND, OR, BETWEEN, LIKE)
- CCR-005: SQL joins (use views)
- CCR-006: Transactions (COMMIT/ROLLBACK)
- CCR-007: Transaction logs
- CCR-008: Triggers (AFTER INSERT/UPDATE/DELETE)

**Never break these!**

### Audit Context Pattern

Before any MySQL transaction that writes to trigger-covered tables:

```php
if (DB::connection()->getDriverName() === 'mysql') {
    self::setAuditUserContext($actor->id);
}
```

This sets `@app_user_id` so triggers can write the acting user to `audit_logs`.

### Design System Hierarchy

1. Check `design-system/havenstay/pages/[page].md` first (if present for that screen)
2. Use `design-system/havenstay/MASTER.md` for global tokens, components, and patterns
3. Use `.agent/skills/ui-ux-pro-max/` for recommendations (optional)

---

## 🆘 Troubleshooting

### "Trigger writes NULL for user_id"
**Fix:** Add `setAuditUserContext()` before transaction

### "Frontend shows 401 after login"
**Fix:** Check `FRONTEND_URL` and `SANCTUM_STATEFUL_DOMAINS` in backend `.env`

### "Test fails with overlap error"
**Fix:** Call `guardActiveOverlaps()` before `DB::transaction()`

### "UI doesn't match design"
**Fix:** Read design file and check against ui-ux-pro-max checklist

**More troubleshooting:** See KIRO.md Section 9

---

## 🎓 Learning Path

**Day 1:**
1. Read CLAUDE.md completely
2. Set up local environment
3. Run backend and frontend
4. Log in and explore the app

**Day 2:**
1. Read KIRO.md
2. Try prompting patterns
3. Make a small change (fix a typo)
4. Run diagnostics and tests

**Day 3:**
1. Read UI_PROMPTING_GUIDE.md
2. Build a simple page
3. Verify against checklist
4. Test in browser

**Week 1:**
1. Implement a small feature
2. Write tests
3. Update documentation
4. Get comfortable with workflows

---

## 📞 Getting Help

**In Kiro:**
```
"How do I [task]? Check CLAUDE.md and KIRO.md for guidance"

"Show me examples of [pattern]"

"Review my code for [issue]"
```

**Documentation:**
- `CLAUDE.md` — Project rules
- `KIRO.md` — Kiro workflows
- `UI_PROMPTING_GUIDE.md` — UI prompting
- `docs/SRS.md` — Requirements
- `docs/SDD.md` — Architecture

---

## 🎉 You're Ready!

Start with a simple task:
```
"I want to add a new field to the tenant form. Guide me through it 
following CLAUDE.md patterns"
```

Or explore the codebase:
```
"Use context-gatherer to show me how the billing system works"
```

**Happy coding!** 🚀
