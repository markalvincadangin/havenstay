# Login Page Design Specification

> **PROJECT:** HavenStay BHMS
> **Routes:** `/login`
> **Authoritative Source:** `../MASTER.md` (§21, §9, §18.2)

## Form Contract Reference

- Shared form theme and validation behavior: `FORM_PAGES.md` §1
- Login form contract: `FORM_PAGES.md` §2.1
- Source of truth: `docs/SRS.md` (FR-001 to FR-004), `docs/API_REFERENCE.md`

---

## 1. Page Purpose

The Login page provides secure access to BHMS operations with a clear, low-friction sign-in flow.

---

## 2. Layout and Content

- **Title (H1):** `Welcome back`
- **Subtitle:** `Sign in to manage rooms, tenants, and billing.`
- **Form fields:** Username, Password
- **Primary action:** `Sign in`
- **Status/error area:** Inline alert above form actions

### 2.1 Exact Form Labels (Parity with `FORM_PAGES.md` §2.1)
- Username (`username`)
- Password (`password`)

The login page should use a focused, single-column auth panel with no role badge and no operational dashboard chrome.

---

## 3. UX and Accessibility Requirements

- Labels must remain visible at all times (not placeholder-only).
- Keyboard focus state must be clearly visible on both fields and submit button.
- Submit button must have disabled/loading state during auth request.
- Error copy must be plain language and actionable:
  - Example: `Sign-in failed. Check your username and password, then try again.`
- Touch targets should be minimum 44px on mobile primary actions.

---

## 4. Security and Behavioral Rules

- Do not reveal whether username exists when credentials are invalid.
- Do not show technical error details in user-facing alerts.
- On success, redirect to authorized landing route.
- If user is already authenticated, redirect away from `/login`.

---

## 5. Page Titles and Subtitles (Master §21 Exact)

| Route | Title (H1) | Subtitle |
| :--- | :--- | :--- |
| `/login` | `Welcome back` | `Sign in to manage rooms, tenants, and billing.` |

---

*This document is a child of the Master Specification. For global primitives, refer to `../MASTER.md`.*
