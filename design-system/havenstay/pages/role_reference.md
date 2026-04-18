# Role Reference & Permissions Matrix

## 1. Overview
The Role Reference page provides a definitive guide to the system's Role-Based Access Control (RBAC) implementation. It ensures that staff understand their operational boundaries and that administrators can verify the system's security posture.

**Requirement:** FR-005c ("The system shall provide a roles reference defining available permissions and assignments").

---

## 2. Permissions Matrix (`/settings/roles`)

### 2.1 Visual Specification
- **Layout:** `StandardPage` with a single large **Registry Card** (p-8).
- **Core Component:** A high-contrast grid or table showing capabilities vs. roles.

### 2.2 Functional Matrix Table
| Capability | Admin | Staff | Viewer |
| :--- | :---: | :---: | :---: |
| **Manage Users** | ✓ | — | — |
| **Manage Rooms & Tenants** | ✓ | ✓ | — |
| **View Audit / Transaction Logs** | ✓ | — | — |
| **Record Payments** | ✓ | ✓ | — |
| **View Financial Reports** | ✓ | ✓ | ✓ |
| **Export Operational Data** | ✓ | ✓ | ✓ |

### 2.3 Visual Affirmation
- **Checkmarks (✓):** Use Teal-600 with bold weight.
- **Empty States (—):** Use Stone-300 (Neutral).

---

## 3. Role Definitions

### 3.1 Admin (Owner/Operator)
- **Visual Token:** Emerald Badge.
- **Access Level:** Full read/write across all 14 tables. Exclusive access to User management and Forensic Audit logs.

### 3.2 Staff (Manager)
- **Visual Token:** Teal Badge.
- **Access Level:** Read/Write for daily operations (Tenants, Rooms, Contracts, Billing, Payments). No access to system security logs or user provisioning.

### 3.3 Viewer (Auditor/Guest)
- **Visual Token:** Stone Badge.
- **Access Level:** Absolute Read-Only. No create, edit, or archive actions are visible or enabled (SRS Sec 2.3).

---

## 4. UI Gatekeeping (Viewer Role)
When a Viewer accesses a page:
- **Alert:** Display a top-level `Alert` variant `info` stating: "You are currently in View-Only mode for this module."
- **Buttons:** All primary Teal CTAs are hidden.
- **Inline Actions:** Edit/Archive icons in tables are hidden or replaced with a "View Details" icon.

---

*Aligned to: SRS v5.2 · MASTER.md v5.0.0 · SDD §2.3*
