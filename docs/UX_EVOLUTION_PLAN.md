# [ARCHIVED] HavenStay UX Evolution Plan (Next Gen v7.0)

> **Purpose:** This document outlines the strategic UI/UX improvements to transition HavenStay from a functional utility to a premium, enterprise-grade "Command Center." It serves as the bridge between current (v6.5) standards and the Next Gen implementation.
> 
> Once fully implemented, these principles will be merged into `design-system/havenstay/MASTER.md`, bumping the core specification to v7.0.

---

## 1. Core UX Paradigm Shifts

### 1.1 Form Navigation (Wizards vs. Standard Forms)
*HCI Focus: Miller's Law (Chunking) & Fitts's Law (Interaction Cost)*

*   **New Records = Wizards:** All complex creation flows will be converted to multi-step wizards to reduce Cognitive Load.
    *   *Targets:* New Tenant Registration (`/tenants/new`), New Contract/Lease Creation (`/contracts/new`), Utility Apportionment (Already partially wizard-driven at `/billing/wizard`).
*   **Update/Edit Records = Side-Sheets & Inline:** Navigating to an entirely new page to change a phone number violates Fitts's Law.
    *   *Targets:* All minor record updates (e.g., editing tenant details, updating meter status).
    *   *Implementation:* Introduce a universal **Side-Sheet Overlay** component that slides in from the right, allowing edits while maintaining the spatial context of the directory in the background.

### 1.2 Data Visualization (Cards vs. Tables)
*HCI Focus: Visual Search Patterns & Recognize vs. Recall*

*   **Expanded Card Usage (Glanceable Entities):**
    *   **User/Staff Management:** Convert `/admin/users` from a sterile table to a responsive grid of User Profile Cards.
    *   **Rooms/Beds:** Maintain and refine current Room Cards, enhancing them with predictive status indicators.
    *   **Audit Pulse:** At the dashboard level, display critical security events as highlighting cards rather than raw table rows.
*   **Strict Table Usage (Dense Operations):**
    *   **Financials:** Billing, Payments, and Contracts remain in robust `Table` components for critical side-by-side comparison.
    *   **Forensics:** The deep Audit Log (`/admin/audit-logs`) remains a dense, scannable table.

---

## 2. Premium Design Layer

### 2.1 The "Active Decision" Dashboard
Shift the dashboard paradigm from passive reporting to active decision support.
*   **Predictive Analytics Cards:** Introduce an intelligent widget tier. Example: Instead of just listing "Pending Move-outs: 4", render an actionable card: *"4 Contracts expiring in 48h. [Review & Send Notices]"*.

### 2.2 Glassmorphism & Z-Depth Hierarchy
Enhance the visual layering to create a premium feel.
*   **Implementation:** Apply `backdrop-blur-md bg-white/70` (Glassmorphism) to Sidebars, Mobile Navs, and floating Side-Sheets. This maintains a connection to the data beneath while bringing the active task to the immediate foreground.

### 2.3 Micro-Animations (System Status Feedback)
*   **Pulse Indicators:** Use subtle pulsing animations on status dots (e.g., emerald pulse for "Active," amber pulse for "Pending Sync") to communicate that the system is alive and monitoring operations in real-time.

### 2.4 Progressive Disclosure
*   **Expandable Rows:** Instead of forcing users to click into a full "Detail View" to see the latest payment for a contract, implement expandable table rows (Accordions) that reveal immediate context inline.

---

## 3. Implementation Roadmap

### Phase 1: Foundation (The Primitives)
1. Build `<WizardFrame>` component with integrated progress tracking.
2. Build `<SideSheetOverlay>` component to replace `PageHeader` standard forms for edits.
3. Update `globals.css` with new variables for glassmorphism panels.

### Phase 2: High-Stakes Workflows
1. Convert `/tenants/new` to a 3-Step Wizard.
2. Convert `/contracts/new` to a 4-Step Wizard.
3. Retrofit `/admin/users` to a Card Grid layout.

### Phase 3: Dashboard & Context
1. Upgrade dashboard KPIs to "Active Decision" cards.
2. Refactor Tables to support `isExpandable` row rendering.
3. Apply micro-animations to `StatusBadge` global implementations.

### Phase 4: Spec Synchronization
1. Merge these completed patterns into `design-system/havenstay/MASTER.md`.
2. Update versions to v7.0.0.
3. Archive this transition document.
