# System Error States & Boundary UX

## 1. Overview
Standardized error pages ensure that even when the system encounters a boundary condition, the experience remains "Forensic" (informative) and "Frictionless" (clear path to recovery).

---

## 2. Access Denied (403 Forbidden)

### 2.1 Visual Specification
- **Component:** `EmptyState` shell.
- **Icon:** `ShieldAlert` (Stone-400).
- **Title:** "Access Denied" (hs-page-title).
- **Subtitle:** "Your current role does not have permission to access this resource or perform this action."
- **Primary Action:** "Back to Dashboard" (Teal CTA).

---

## 3. Page Not Found (404)

### 3.1 Visual Specification
- **Component:** `EmptyState` shell.
- **Icon:** `SearchX` (Stone-400).
- **Title:** "Page Not Found" (hs-page-title).
- **Subtitle:** "The resource you are looking for might have been moved, deleted, or never existed."
- **Primary Action:** "Back to Home" (Teal CTA).

---

## 4. System Error (500)

### 4.1 Visual Specification
- **Component:** `EmptyState` shell.
- **Icon:** `Activity` (Stone-400).
- **Title:** "Something Went Wrong" (hs-page-title).
- **Subtitle:** "The server encountered an unexpected condition. Administrators have been notified via the system logs."
- **Forensic Footer:** Display a **Correlation ID** code at the bottom of the page in `DM Mono` for staff to reference in the transaction logs.
  - `Error Ref: #CORR-7f2a-91`

---

## 5. Global Policy Constraints
When an action is blocked by a business rule (e.g., deleting a room with active tenants):
- **Component:** `RecordStateAlert` (Section 5.11.1 in MASTER.md).
- **Position:** Fixed at the top of the detail page.
- **Tone:** Explicit and non-technical.
  - "This room cannot be archived because it currently contains active bed spaces."

---

*Aligned to: SRS v5.2 · MASTER.md v5.0.0*
