# HavenStay Boarding House Management System (BHMS)

## Software Requirements Specification (SRS)

**Version:** 5.2  
**Last Updated:** April 18, 2026  
**Status:** Canonical behavioral baseline and forensic lock (Forensic Synchronization Pass)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [External Interface Requirements](#3-external-interface-requirements)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Data Requirements](#6-data-requirements)
7. [Business Rules](#7-business-rules)
8. [Prioritized Product Backlog](#8-prioritized-product-backlog)
9. [Acceptance and Test Readiness](#9-acceptance-and-test-readiness)
10. [Risks and Mitigations](#10-risks-and-mitigations)
11. [Appendices](#11-appendices)

---

### 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the functional and non‑functional requirements and business rules for the HavenStay Boarding House Management System (BHMS). It serves as the authoritative baseline for design, development, testing, and academic evaluation of the system.

### 1.2 Scope

HavenStay BHMS is a centralized web‑based system for managing boarding house operations. The system shall cover the following capabilities:

- Tenant profile management (create, update, search, archive/restore)
- Room and bed inventory management with bed‑level occupancy tracking
- Rental contract lifecycle management (check-in, update, move-out, termination)
- Billing generation with itemized line items and dynamic balance computation
- Payment recording and soft‑voiding with payment history and aging analysis
- Accounts receivable tracking and outstanding balance reporting
- Operational and financial reporting driven by canonical SQL views with CSV export
- Live operational dashboard with KPIs and move‑out forecasting
- Role‑based access control and full forensic audit and transaction logging

**Out of scope for Release 1**
Online payment gateway integration; SMS or email notification automation; native mobile application; self‑service password reset; automatic monthly billing generation; structured deposit return workflow; automatic carry‑forward of overpayments; maintenance request tracking and work order management; automated late fee calculation; tenant screening and background checks.

### 1.3 Documentation Boundary Matrix


| Document                   | Primary Purpose                         | Boundary                                                            |
| -------------------------- | --------------------------------------- | ------------------------------------------------------------------- |
| **SRS (this document)**    | Defines **what** the product must do    | Requirements, business rules, constraints, and assumptions.         |
| **SDD**                    | Defines **how** the product is designed | Architecture, module responsibilities, and implementation patterns. |
| **API Reference**          | Defines integration contracts           | Endpoint behavior, parameters, payloads, and error semantics.       |
| **Database Documentation** | Defines data-layer structure            | Canonical DDL, views, triggers, and constraints.                    |
| **Test Plan**              | Defines validation evidence             | Test scope, strategy, traceability, and execution evidence.         |


Implementation-specific details such as service/class names, concrete endpoint URIs and HTTP methods, transaction/query mechanics, and DB enforcement constructs are documented in SDD, API Reference, and Database Documentation and are not normative requirement text in this SRS.

### 1.4 Intended Audience

- Property owners and operators
- Developers and QA engineers
- UI/UX designers
- Academic evaluators and Information Management course stakeholders

### 1.5 Definitions and Acronyms


| Term                    | Definition                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------- |
| **BHMS**                | Boarding House Management System                                                       |
| **SRS**                 | Software Requirements Specification                                                    |
| **SDD**                 | System Design Document                                                                 |
| **RBAC**                | Role-Based Access Control                                                              |
| **UAT**                 | User Acceptance Testing                                                                |
| **CCR**                 | Course Compliance Requirement                                                          |
| **FR**                  | Functional Requirement                                                                 |
| **NFR**                 | Non-Functional Requirement                                                             |
| **Contract**            | Rental agreement between a tenant and a specific bed space                             |
| **Bed-level occupancy** | Tracking occupancy per individual bed space within a shared or solo room               |
| **Void**                | Soft cancellation of a posted payment; row is retained with voided_at timestamp        |
| **room_code**           | Unique alphanumeric identifier for a room                                              |
| **Correlation ID**      | UUID linking a workflow-level transaction log to its trigger-written audit log entries |
| **Rent Roll**           | A snapshot report of all units showing occupancy, tenant, rates, and payment status    |
| **AR Aging**            | categorization of outstanding balances by days past due                                |


### 1.6 References


| File                      | Purpose                                                                           |
| ------------------------- | --------------------------------------------------------------------------------- |
| `docs/SDD.md`             | System design and technical architecture                                          |
| `docs/TEST_PLAN.md`       | Test strategy and traceability matrix                                             |
| `docs/PROJECT_PLAN.md`    | Execution schedule and milestones                                                 |
| `db/havenstay_schema.sql` | **Canonical authoritative DDL** — source of truth for schema, views, and triggers |


> **Schema Authority:** `db/havenstay_schema.sql` is the single source of truth for all DDL. The runtime copy must be kept in sync; when conflicts exist, the canonical file prevails.

### 1.7 Academic and Course Compliance Requirements (CCR)

The following CCR items are binding technical constraints for the academic deliverable. Each CCR maps to specific functional requirements in Section 4.12, to design decisions in `docs/SDD.md`, and to test evidence in `docs/TEST_PLAN.md`.


| ID          | Requirement                                              | Priority | Status        | Evidence Location                           |
| ----------- | -------------------------------------------------------- | -------- | ------------- | ------------------------------------------- |
| **CCR-001** | ≥ 14 core entities in the relational data model          | Required | **Satisfied** | `db/havenstay_schema.sql` (14 tables)       |
| **CCR-002** | Distributed DB: primary-replica architecture             | Required | **Satisfied** | `docs/DISTRIBUTED_DB_SETUP.md`              |
| **CCR-003** | SQL CRUD: SELECT, INSERT, UPDATE, DELETE                 | Required | **Satisfied** | `backend/app/Services/`                     |
| **CCR-004** | SQL operators: AND, OR, BETWEEN, LIKE                    | Required | **Satisfied** | `TenantService.php`, `ReportService.php`    |
| **CCR-005** | SQL JOINs for multi-table retrieval                      | Required | **Satisfied** | `db/havenstay_schema.sql` §4                |
| **CCR-006** | Transaction control: START TRANSACTION, COMMIT, ROLLBACK | Required | **Satisfied** | `PaymentService.php`, `ContractService.php` |
| **CCR-007** | Transaction logs for reliability and auditability        | Required | **Satisfied** | `transaction_logs` table                    |
| **CCR-008** | Database triggers for change logging                     | Required | **Satisfied** | `db/havenstay_schema.sql` §5                |


Audit trail coverage and trigger counts are documented in the **Database Documentation** and verified in the **Test Plan**.

---

## 2. Overall Description

### 2.1 Product Perspective

HavenStay BHMS replaces fragmented paper records and spreadsheets with a centralized system that provides operational workflows, reporting, and forensic auditability for small‑scale boarding house operations. The system exposes web interfaces and programmatic APIs; implementation details are documented in SDD and API Reference.

### 2.2 Product Functions (High-Level)

- Manage users, roles, and access control.
- Manage tenant profiles with full historical preservation (archive/restore).
- Manage room inventory and bed‑level occupancy tracking; room status shall reflect bed‑level occupancy within defined latency thresholds under normal load (see NFR-001).
- Create and manage rental contracts including check-in, update, move-out, and termination.
- Generate and track monthly billing cycles with itemized line items.
- Record and void payments with dynamic balance computation and billing status auto-recalculation.
- Provide accounts receivable aging and outstanding balance reports.
- Generate operational reports: occupancy, rent roll, collections performance, tenant history and ledger.
- Live KPI dashboard with pending move‑out forecasting; dashboard data shall refresh to reflect source changes and include defined KPIs (see FR-036a and TEST_PLAN).
- Full forensic audit trail via change logging and workflow synchronization.

### 2.3 User Classes and Access Rights

The following matrix defines the high-level capabilities per role. Each capability maps to specific Functional Requirement IDs and API endpoints in the traceability matrix in TEST_PLAN and API_REFERENCE.md respectively.


| Capability                                     | Admin | Staff | Viewer |
| ---------------------------------------------- | ----- | ----- | ------ |
| Users: list, view                              | ✓     | —     | —      |
| Users: create, update, deactivate, archive     | ✓     | —     | —      |
| Tenants: list, view, search                    | ✓     | ✓     | ✓      |
| Tenants: create, update, deactivate, archive   | ✓     | ✓     | —      |
| Rooms: list, view, availability                | ✓     | ✓     | ✓      |
| Rooms: create, update, archive                 | ✓     | ✓     | —      |
| Contracts: list, view                          | ✓     | ✓     | ✓      |
| Contracts: create, update, move-out, terminate | ✓     | ✓     | —      |
| Billing: list, view                            | ✓     | ✓     | ✓      |
| Billing: create, status override               | ✓     | ✓     | —      |
| Payments: list, view                           | ✓     | ✓     | ✓      |
| Payments: record, void                         | ✓     | ✓     | —      |
| Reports: all report endpoints                  | ✓     | ✓     | ✓      |
| Reports: CSV export                            | ✓     | ✓     | ✓      |
| Audit logs: view, export                       | ✓     | —     | —      |
| Transaction logs: view                         | ✓     | —     | —      |


### 2.4 Operating Environment

- Web browser: latest Chrome, Edge, Firefox.
- Server-hosted web application environment.
- Primary database: Relational DB supporting transactions, foreign key constraints, triggers, and views. Canonical deployment target is MySQL (8.4+) utilizing automated forensic change logging; engine/version details and replica setup are documented in Database Documentation.
- Development database: Local engine (e.g., SQLite) supporting basic relational operations; trigger and view behavior may vary from production and is verified per TEST_PLAN compatibility checks.

---

## 3. External Interface Requirements

### 3.1 User Interface

The system shall provide a responsive web user interface that supports mobile and desktop workflows and adapts to common viewport sizes.

The UI shall present role‑aware navigation so users see only the menu items and actions permitted by their role.

The UI shall provide inline field validation, clear field‑level error messages, and accessible form controls.

Detailed UI implementation, component libraries, exact breakpoints, and visual design are documented in the UI specification and SDD. Acceptance tests for responsiveness and usability are defined in `docs/TEST_PLAN.md`.

### 3.2 API Interface

The system shall expose a RESTful JSON API for authenticated and role‑governed access.

The API shall use standardized protocol status indicators and return consistent error payloads with field‑level validation details where applicable.

List endpoints shall support pagination, filtering, and sorting as appropriate.

Authentication and authorization requirements for API access are defined in the Security section of this SRS; concrete token formats and flows are documented in `docs/API_REFERENCE.md`.

The full API contract (routes, request/response schemas, examples, and error codes) is specified in `docs/API_REFERENCE.md`. API contract tests are defined in `docs/TEST_PLAN.md`.

---

## 4. Functional Requirements

### 4.1 Authentication and Access Control

- **FR-001:** The system shall require authentication via personal credentials before granting access to any protected resource. Unauthenticated requests shall be rejected.
- **FR-002:** The system shall enforce role-based permissions (Admin, Staff, Viewer) on all protected functionality. Authorization decisions shall be auditable.
- **FR-003:** The system shall record authentication and authorization events—including successful login, logout, and access-denied occurrences—in an audit log. Entries shall include timestamp, user identity, action, and outcome.
- **FR-004:** The system shall reject login attempts from deactivated accounts and return a clear status message.

### 4.2 User Management

- **FR-005:** Admin users shall be able to create, update, and manage the lifecycle (deactivation, archiving, and restoration) of user accounts.
- **FR-005a:** The system shall provide a user directory listing name, identity, email, role, and active status.
- **FR-005b:** The system shall allow viewing individual user account details.
- **FR-005c:** The system shall provide a roles reference defining available permissions and assignments.
- **FR-006:** Admin users shall be able to modify user roles and permissions.
- **FR-007:** The system shall enforce uniqueness for user identities (username) and email addresses, and provide validation feedback for duplicate entries.

### 4.3 Tenant Management

- **FR-008:** The system shall support creating and managing tenant profiles with mandatory contact and emergency information.
- **FR-009:** The system shall preserve tenant records through deactivation and archiving workflows to maintain audit integrity; physical deletion of primary tenant records is not permitted.
- **FR-010:** The system shall maintain a chronological history of all contracts for each tenant, accessible from the tenant detail and reporting views.
- **FR-011:** The system shall support multi-criteria search for tenants, with results including occupancy context and current outstanding balance.
- **FR-011a:** The system shall provide operational summaries including total active tenants and move-out forecasts for the next 30 days.

### 4.4 Room and Bed Space Management

- **FR-012:** The system shall support creating and updating room records with unique codes, rates, and capacity configurations. 
- **FR-012a:** Authorized users shall be able to archive and restore rooms. Archive operations shall be disallowed for rooms with active contracts or occupied bed spaces.
- **FR-013:** The system shall synchronize room availability status based on bed-level occupancy while allowing for manual maintenance overrides.
- **FR-014:** The system shall track occupancy at the bed-space level. Each bed space shall maintain an independent status (vacant, occupied, maintenance).
- **FR-015:** The system shall provide real-time occupancy and availability data for all rooms and individual bed spaces.
- **FR-015a:** The system shall provide room statistics including total capacity, current occupancy levels, and status distributions.

### 4.5 Contract Management

- **FR-016:** The system shall create rental contracts linking a single tenant to a specific bed space for a defined period.
- **FR-016a:** The system shall support contract-specific monthly rate overrides that take precedence over default room rates.
- **FR-016b:** For solo rooms, the system shall support automatic bed-space assignment when a specific bed is not selected.
- **FR-017:** The system shall enforce double-occupancy prevention rules:
  - A tenant cannot hold multiple active or pending contracts simultaneously.
  - A bed space cannot be assigned to multiple active or pending contracts simultaneously.
- **FR-017a:** The system shall disallow contract creation for rooms where all constituent bed spaces are occupied or under maintenance.
- **FR-018:** The system shall provide comprehensive contract detail views including tenant contact, location context, term dates, and financial metadata.
- **FR-019:** The system shall support move-out processing for active contracts.
- **FR-019a:** The move-out workflow shall atomically update the contract status to completed, release the bed space to vacant, and update the tenant's global status.
- **FR-019b:** The system shall reject move-out attempts where the actual move-out date is earlier than the move-in date.
- **FR-019c:** The system shall allow updating secondary contract fields (notes, expected move-out date) while the contract is active.
- **FR-019d:** The system shall preserve historical contract records with completed or terminated statuses for audit purposes.
- **FR-019e:** (Philippine Compliance) The system shall enforce a mandatory two-phase check-in process. Contracts shall initialize in a Pending Payment state; bed space occupancy and room status updates shall be suppressed until the contract is manually activated.
- **FR-019f:** (Philippine Compliance) The move-out workflow shall require a `Gate Pass` clearance. The system shall block move-out completion for any contract with an outstanding balance ≥ ₱1.00.

### 4.6 Billing Management

- **FR-020:** The system shall allow authorized users to manually create billing cycle records for active contracts.
- **FR-021:** The system shall support itemized billing with categorized charges (e.g., rent, utilities, adjustments). Each line item requires a description and a non‑zero amount.
- **FR-021a:** The system shall compute billing balances dynamically based on the sum of line items minus the sum of applied and non‑voided payments.
- **FR-021b:** The system shall ensure that the total computed amount for any billing record cannot be negative.
- **FR-022:** The system shall prevent the creation of duplicate billing cycles for the same contract and period.
- **FR-023:** The system shall support filtering and searching of billing records by tenant, due date, status, and receivable state (current vs. past due).
- **FR-023a:** (Philippine Compliance) The system shall support sub-metered utility tracking for rooms. Authorized users shall be able to record periodic readings (Electric/Water) with consumption automatically computed against the previous reading.
- **FR-023b:** The system shall support a master `Appliance Registry` for monthly add-on fees (e.g., Laptops, Kettles).
- **FR-023c:** The system shall automatically include active appliance add-ons as line items during manual billing generation if registered to the contract.
- **Schema Scale**: The system shall utilize precisely 14 normalized tables to achieve core and compliance requirements.
- **FR-025a:** Authorized users shall be able to manually override a billing record's status for reconciliation purposes.

### 4.7 Payment Processing

- **FR-024:** The system shall record payments atomically, ensuring consistent updates to related billing balances and contract statuses.
- **FR-025:** The system shall automatically recompute billing statuses upon posting or voiding of payments.
- **FR-026:** The system shall support soft-voiding of payments. Voided payments shall be retained for audit but excluded from all balance computations.
- **FR-027:** The system shall maintain a complete payment history with filtering by tenant, contract, and date range.
- **FR-027a:** The system shall provide detailed payment views including source billing, amount, method, and void status.

### 4.8 Operational and Financial Reporting

The system shall provide standardized reporting interfaces with support for CSV export and date‑range filtering.

- **FR-028:** The system shall provide occupancy reports at both room and bed-space levels, showing status, tenant context, and historical occupancy rates.
- **FR-029:** The system shall provide financial summary reports including total billed, collected, and outstanding amounts.
- **FR-030:** The system shall provide accounts receivable (AR) aging reports categorizing outstanding balances by age.
- **FR-031:** The system shall provide a tenant financial ledger showing chronological debit/credit entries and current running balance for a selected profile.
- **FR-032:** The system shall provide collections performance reports with payment-method and date-range filtering.

### 4.9 Operational Dashboard

- **FR-033:** The system shall provide a live operational dashboard for all authenticated roles.
- **FR-033a:** The dashboard shall present key performance indicators (KPIs) including occupancy ratios, move-out forecasts, and overdue billing totals.

### 4.10 Forensic Audit and Transaction Logging

- **FR-034:** The system shall capture all create, update, and delete operations on core entities in a permanent, immutable audit log. Entries shall include before/after snapshots and actor identity.
- **FR-035:** The system shall log the lifecycle of critical write workflows (e.g., check-in, billing, payments) including started, committed, and rolled-back statuses to ensure auditability of failed operations.
- **FR-036:** Each workflow execution shall generate a unique correlation identity propagated to all related audit and transaction log entries.

### 4.11 System Integrity and Metadata

- **FR-037:** The system shall enforce bed-level occupancy constraints to prevent double-booking of tenants or bed spaces.
- **FR-038:** Monetary values shall adhere to fixed‑point precision and validity constraints.
- **FR-039:** The system shall ensure room status reflects constituent bed-space occupancy while respecting manual operational overrides.
- **FR-040:** The system shall maintain referential integrity across all entities; metadata required for forensic audit shall be preserved even if related user accounts are deactivated.

---

## 5. Non-Functional Requirements

### 5.1 Performance

- **NFR-001:** The system shall respond to list endpoints within 2 seconds under normal operational load. Normal operational load shall be defined in the Test Plan.
- **NFR-002:** Report endpoints shall respond within 5 seconds for datasets up to 1,000 records under defined test conditions.

### 5.2 Security

- **NFR-003:** User passwords shall be stored using a secure, adaptive hashing algorithm with a cost factor configurable by administrators. Plaintext passwords shall never be logged, returned in API responses, or stored.
- **NFR-004:** All protected system interfaces shall require valid authenticated access tokens. Unauthenticated requests shall be strictly rejected by the system.
- **NFR-005:** Role-based authorization shall be enforced for all protected functionality and shall be auditable.

### 5.3 Reliability

- **NFR-006:** Financial write operations shall be atomic. Partial writes shall be prevented and failures shall leave no inconsistent intermediate state.
- **NFR-007:** All changes to core financial and operational data shall be recorded in an auditable log independent of application logic.

### 5.4 Maintainability

- **NFR-008:** The system architecture shall enforce clear separation of concerns between interface handling, business logic, and data access layers.
- **NFR-009:** Authorization policy enforcement shall be centralized and consistently applied across all protected workflows.

### 5.5 Currency and Localization

- **NFR-010:** Monetary values shall be stored and processed with fixed-point precision sufficient for currency (two decimal places). The system shall present monetary values in Philippine Pesos with consistent rounding rules; display formatting details shall be defined in the UI specification.

### 5.6 Usability

- **NFR-011:** An Admin shall be able to complete the full tenant check-in workflow (create tenant + create contract) in 5 or fewer form submissions via the web interface.
- **NFR-012:** All form validation errors shall be displayed inline at the field level. System validation errors shall include field-specific messages.

### 5.7 Availability and Scalability

- **NFR-013:** The system shall support a minimum of 20 concurrent authenticated sessions without meaningful performance degradation.
- **NFR-014:** The primary database shall be configured for automatic periodic backups. Backup integrity and recovery procedures are out of scope for the application but are defined in the Infrastructure Plan.

### 5.8 Data Privacy

- **NFR-015:** The system shall implement PII (Personally Identifiable Information) masking. Sensitive fields such as emergency contact numbers and physical addresses shall be accessible only to Admin and Staff roles; Viewer roles shall see redacted or masked representations of these attributes in registries and reports.
- **NFR-016:** The system shall achieve 99% availability during scheduled operating hours, excluding planned maintenance windows. Availability measurement method and monitoring thresholds shall be defined in the Operations Plan.
- **NFR-017:** For Release 1, the system shall support at least 200 active tenant records, 50 rooms, and 500 billing records while meeting the performance targets defined in NFR-001 and NFR-002.

---

## 6. Data Requirements

### 6.1 Core Entities

The system shall maintain the following core data entities. Detailed data definitions, column types, and schema constraints are documented in the **Database Documentation** and the canonical schema (`db/havenstay_schema.sql`).


| Entity              | Purpose                                                            | Retention Principle                    |
| ------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| **System Identity** | Users, roles, and authentication metadata                          | Preservation for audit trails          |
| **Tenant Profile**  | Contact and history for residents                                  | Soft‑delete/archiving required         |
| **Room Inventory**  | Room and individual bed‑space configurations                       | Preservation for contract mapping      |
| **Rental Contract** | Agreement linking tenants to specific inventory                    | Permanent record of tenancy            |
| **Billing Header**  | Monthly financial cycle summaries                                  | Permanent financial record             |
| **Billing Item**    | Itemized charges and adjustments                                   | Permanent financial record             |
| **Payment Record**  | Transactional history and void metadata                            | Permanent financial record             |
| **Appliance Registry**| Catalog of billable add-ons and active lease assignments         | Preservation for financial auditing    |
| **Utility Readings**| Sub-meter data (electric/water) recorded for room billing          | Preservation for financial auditing    |
| **Audit Log**       | High‑fidelity record of create/update/delete events                | Append‑only forensic log               |
| **Transaction Log** | Workflow-level state and outcome log                               | Append‑only forensic log               |


### 6.2 Data Integrity and Constraints

The system shall enforce the following data integrity rules at the storage layer:

- **Uniqueness:** Enforcement of unique identities for user accounts (username), room codes, and billing cycles.
- **Validity:** Range and non‑zero constraints for financial amounts and dates.
- **Referential Integrity:** Prevention of data loss for related entities (e.g., blocking deletion of bed spaces with active contracts).
- **Concurrency:** Transactional isolation and locking to prevent double‑booking and inconsistent balance updates.

Details of specific SQL constraints and uniqueness triggers are documented in the **Database Documentation**.

### 6.3 Standardized Reporting Views

The system shall utilize standardized data views to provide consistent reporting snapshots across the dashboard and export interfaces. These views shall provide:

- **Occupancy Snapshots:** Room and bed‑level availability.
- **Financial Status:** Comprehensive billing and payment balances.
- **Contract History:** Temporal records of tenant assignments.
- **Collections Performance:** Non‑voided payment summaries.

Canonical SQL definitions for these reporting structures are maintained in the system schema.

---

## 7. Business Rules

- **BR-001:** The system shall bill rent monthly per active contract as a base_rent line item. Billing cycles shall be created manually by authorized users; automatic billing generation is out of scope for Release 1.
- **BR-002:** Deposits shall be recorded on the contract record. Deposit returns and deductions shall be recorded and auditable; structured deposit reconciliation is deferred to a later release.
- **BR-003:** Utilities, add-ons, penalties, and adjustments shall be recorded as separate billing line items with a defined item type and non-empty description.
- **BR-004:** A billing record shall be considered overdue when the due date is earlier than the system business date and total paid is less than total amount.
- **BR-005:** Move-out processing shall only be permitted for contracts in the active state. Attempts to move out a non-active contract shall be rejected with a validation error.
- **BR-005a:** A committed move-out workflow shall atomically set the actual move-out date, mark the contract as completed, release the associated bed space, update room availability, and update tenant status when applicable.
- **BR-005b:** Tenant status shall transition to a Moved Out state only when the tenant has no remaining active contracts.
- **BR-006:** Records with financial or tenancy history shall be preserved; hard deletes of such records shall be disallowed.
- **BR-006a:** Preservation policies shall include status transitions and soft-delete semantics for tenants, users, contracts, and payments; exact enforcement mechanisms shall be documented in the Database Documentation.
- **BR-007:** Voiding a payment shall record void metadata and trigger immediate recalculation of billing status. The recalculation mechanism shall be auditable and traceable.
- **BR-008:** The system shall have a single, authoritative mechanism for billing status recalculation; the authoritative mechanism shall be documented in the SDD and API Reference.
- **BR-009:** Billing status priority shall be evaluated in sequence: paid, overdue, partial, unpaid. If a billing record satisfies the conditions for multiple statuses (e.g., partial amount paid but due date passed), the state with higher priority in the defined sequence shall be persisted.
- **BR-010:** Overpayments shall be represented as a negative balance (credit). No automatic carry-forward of credits to future billing cycles shall occur in Release 1.
- **BR-011:** Contract completion or termination shall not alter existing billing records; outstanding billing cycles remain until reconciled.
- **BR-012:** Each critical workflow shall generate a unique correlation identifier that links workflow-level transaction logs to row-level audit records.
- **BR-013:** Monetary values shall be stored and processed with fixed-point precision to support two decimal places. Display formatting and exact DB column types shall be specified in the UI specification and Database Documentation respectively.
- **BR-014:** Standard billing periods shall follow a monthly convention; non-monthly periods are permitted but are not the default workflow.
- **BR-015:** The system business date used for date comparisons shall be defined in the Operations Plan and shall use the Asia/Manila timezone.
- **BR-015a:** (Rent Control Act of 2009 / 2026 Update) For residential units with a monthly rent ≤ ₱10,000, any annual rent increase for the same tenant shall not exceed 1% of the current rate. Validations shall occur during contract creation and rate updates.
- **BR-016:** A tenant’s status shall not be manually changed while the tenant has any active contracts.
- **BR-017:** An occupied bed space or a bed space referenced by any contract shall not be deletable to preserve historical referential integrity.
- **BR-018:** Solo rooms shall have a capacity of one. If a solo room is created without explicit bed spaces, the system shall ensure a single bed space exists for that room. Implementation details of auto-creation belong in the SDD.
- **BR-019:** Contracts with expected move-out dates within the next 30 calendar days shall be classified as pending move-outs for operational planning.
- **BR-020:** Penalty and late fee assessment shall be manual in Release 1; automated penalty calculation is deferred.
- **BR-021:** Audit logs and transaction logs are permanent and immutable. Any corrections to the system's operational state must be performed via new transactional entries which generate their own audit trail and correlation identifiers.
- **BR-022:** Financial refunds shall be processed as negative payment entries tied to a specific billing record. Physical cash withdrawal logic and ledger reconciliation for external payouts are out of scope for Release 1.
- **BR-023:** Rent proration for mid-period check-ins or move-outs is out of scope for automated computation in Release 1. The total amount for the first or last billing cycle must be manually calculated by the authorized user before record entry.
- **BR-024:** Security deposit amounts shall be manually specified during contract registration. Per industry standard and R.A. 9653, the security deposit should not exceed a maximum of two (2) months of the contract's monthly rent.

---

## 8. Prioritized Product Backlog


| Priority | Item                                        | FR Reference  | Status                 |
| -------- | ------------------------------------------- | ------------- | ---------------------- |
| P1       | Authentication and Role-Based Access        | FR-001–004    | Complete               |
| P1       | Tenant Profile and Lifecycle Management     | FR-008–011a   | Complete               |
| P1       | Room inventory and Bed-Level tracking       | FR-012–015a   | Complete               |
| P1       | Contract creation and Move-out workflow     | FR-016–019d   | Complete               |
| P1       | Manual Billing and Itemized Charges         | FR-020–023    | Complete               |
| P1       | Payment processing, void, and recalculation | FR-024–027a   | Complete               |
| P1       | Forensic Audit and Transaction Logging      | FR-034–036    | Complete               |
| P1       | Operational and Financial Reporting         | FR-028–032    | Complete               |
| P1       | Forensic triggers and change auditing       | FR-034        | Complete (42 triggers) |
| P1       | Workflow-level transaction logging          | FR-035        | Complete               |
| P2       | User Management and Directory               | FR-005–007    | Complete               |
| P2       | Operational Dashboard and KPIs              | FR-033–033a   | Complete               |
| P3       | Multi‑table retrieval (Views)               | FR-028–032    | Complete               |
| P3       | Primary-replica configuration (CCR-002)     | NFR Reference | Complete               |
| P4       | Maintenance request tracking                | —             | Out of scope           |
| P4       | Deposit return structured workflow          | —             | Out of scope           |


---

## 9. Acceptance and Test Readiness (Non-Normative)

All feature tests run on SQLite. CCR compliance evidence (triggers, transaction logs) must be demonstrated on MySQL. Tests defined in `docs/TEST_PLAN.md`.


| Test ID       | Covers                                       |
| ------------- | -------------------------------------------- |
| TC-AUTH-*     | Credential validation and role enforcement   |
| TC-TENANT-*   | Onboarding, Soft-delete, and Search          |
| TC-CONTRACT-* | Overlap prevention and move-out constraints  |
| TC-BILLING-*  | Itemization and balance recomputation        |
| TC-PAYMENT-*  | Atomic posting and soft-void logic           |
| TC-TX-001     | Transactional state persistence and recovery |
| TC-TRIGGER-001| Row-level forensic logging via triggers      |


**Pre-defense verification checklist:**

- `php artisan test` passes (0 failures on SQLite)
- MySQL trigger count = 42: run `SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = DATABASE();`
- `db/REPLICA_DAILY_START.md` exists and primary-replica topology is startable
- All 6 views exist in the MySQL database: `SHOW FULL TABLES WHERE table_type = 'VIEW';`
- Transaction-log visibility is validated through the documented administrative reporting interface and/or integration checks.
- Audit-log visibility with correlation linkage is validated through the documented administrative reporting interface and/or integration checks.

---

## 10. Risks and Mitigations


| Risk                                          | Likelihood | Impact | Mitigation                                                                                                                      |
| --------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| CCR evidence not demonstrable on SQLite       | Low        | High   | All CCR triggers and transaction log evidence captured on MySQL; SQLite used for unit tests only                                |
| Billing status inconsistency after void       | Low        | High   | Status recalculation is verified in financial workflow tests and monitored through reconciliation checks                        |
| rooms.status written as 'occupied'            | Low        | Medium | Status-domain validation and occupancy synchronization checks are enforced at system-validation level                           |
| Audit log records missing actor identity      | Low        | High   | Audit-context propagation and actor attribution are verified in forensic integration tests                                      |
| Canonical and runtime schema out of sync      | Medium     | High   | Both `db/havenstay_schema.sql` and `backend/database/sql/havenstay_schema.sql` must be updated together for every schema change |
| Concurrent contract creation conflicts        | Low        | Medium | Design-level concurrency handling assumptions are documented in SDD and validated in test scenarios where applicable            |
| Missing analytical report endpoints           | Low        | Medium | FR-032a, FR-032b, FR-032c, FR-028a/b — all confirmed implemented in the reporting engine; verify routes respond before defense  |
| Trigger count stated incorrectly in artifacts | Low        | High   | All documents updated to 42; run `COUNT(*)` query on MySQL before defense                                                       |


---

## 11. Appendices (Non-Normative Implementation Evidence)

### 11.1 API Route Inventory (Informational)

This inventory provides a reference mapping of system interfaces to their corresponding requirements and compliance evidence. Concrete parameters and examples are maintained in `docs/API_REFERENCE.md`.


| Endpoint                               | Method | Controller Action                        | Primary FR | Compliance Evidence |
| -------------------------------------- | ------ | ---------------------------------------- | ---------- | ------------------- |
| `/api/auth/login`                      | POST   | AuthController::login                    | FR-001     | Auth flow           |
| `/api/auth/logout`                     | POST   | AuthController::logout                   | FR-003     | Auth flow           |
| `/api/auth/me`                         | GET    | AuthController::me                       | FR-002     | RBAC reference      |
| `/api/users`                           | GET    | UserController::index                    | FR-005a    | CCR-003 SELECT      |
| `/api/users`                           | POST   | UserController::store                    | FR-005     | CCR-003 INSERT      |
| `/api/users/roles`                     | GET    | UserController::roles                    | FR-005c    | CCR-003 SELECT      |
| `/api/users/{id}`                      | GET    | UserController::show                     | FR-005b    | CCR-003 SELECT      |
| `/api/users/{id}`                      | PUT    | UserController::update                   | FR-005     | CCR-003 UPDATE      |
| `/api/users/{id}/deactivate`           | POST   | UserController::deactivate               | FR-005     | CCR-003 UPDATE      |
| `/api/users/{id}/archive`              | POST   | UserController::archive                  | FR-005     | CCR-003 UPDATE      |
| `/api/users/{id}/restore`              | POST   | UserController::restore                  | FR-005     | CCR-003 UPDATE      |
| `/api/tenants`                         | GET    | TenantController::index                  | FR-011     | CCR-003 SELECT      |
| `/api/tenants/summary`                 | GET    | TenantController::summary                | FR-011a    | CCR-003 SELECT      |
| `/api/tenants`                         | POST   | TenantController::store                  | FR-008     | CCR-003 INSERT      |
| `/api/tenants/search`                  | GET    | TenantController::search                 | FR-011     | CCR-004 LIKE/OR     |
| `/api/tenants/{id}`                    | GET    | TenantController::show                   | FR-008     | CCR-003 SELECT      |
| `/api/tenants/{id}`                    | PUT    | TenantController::update                 | FR-008     | CCR-003 UPDATE      |
| `/api/tenants/{id}/archive`            | POST   | TenantController::archive                | FR-009     | CCR-003 UPDATE      |
| `/api/rooms`                           | GET    | RoomController::index                    | FR-012     | CCR-003 SELECT      |
| `/api/rooms/stats`                     | GET    | RoomController::stats                    | FR-015a    | CCR-003 SELECT      |
| `/api/rooms`                           | POST   | RoomController::store                    | FR-012     | CCR-006 Transaction |
| `/api/rooms/availability`              | GET    | RoomController::availability             | FR-015     | CCR-003 SELECT      |
| `/api/rooms/{id}/bed-spaces`           | POST   | RoomController::addBedSpace              | FR-014     | CCR-003 INSERT      |
| `/api/contracts`                       | POST   | ContractController::store                | FR-016     | CCR-007 Logging     |
| `/api/contracts/{id}/move-out`         | POST   | ContractController::moveOut              | FR-019     | CCR-006, CCR-007    |
| `/api/billing`                         | POST   | BillingController::store                 | FR-020     | CCR-006, CCR-007    |
| `/api/billing/{id}/status`             | PATCH  | BillingController::updateStatus          | FR-025a    | CCR-003 UPDATE      |
| `/api/payments`                        | POST   | PaymentController::store                 | FR-024     | CCR-006, CCR-007    |
| `/api/payments/{id}`                   | DELETE | PaymentController::destroy               | FR-026     | CCR-006, CCR-007    |
| `/api/reports/occupancy`               | GET    | ReportController::occupancy              | FR-028     | CCR-005 Views       |
| `/api/reports/billing-summary`         | GET    | ReportController::billingSummary         | FR-029     | CCR-004 BETWEEN     |
| `/api/reports/outstanding-balances`    | GET    | ReportController::outstandingBalances    | FR-030     | CCR-004 BETWEEN     |
| `/api/reports/tenant-ledger`           | GET    | ReportController::tenantLedger           | FR-031     | CCR-005 Views       |
| `/api/reports/collections-performance` | GET    | ReportController::collectionsPerformance | FR-032     | CCR-004 BETWEEN     |
| `/api/reports/*/export`                | GET    | ReportController::*Export                | FR-032     | CCR-005 Views       |
| `/api/audit-logs`                      | GET    | AuditLogController::index                | FR-034     | CCR-008 Triggers    |
| `/api/audit-logs/export`               | GET    | AuditLogController::export               | FR-034     | CCR-008             |
| `/api/transaction-logs`                | GET    | TransactionController::index             | FR-035     | CCR-007 Logging     |
| `/api/add-ons`                         | GET/POST | ComplianceController                   | FR-023b    | CCR-003 CRUD        |
| `/api/add-ons/{id}/status`             | PATCH  | ComplianceController                   | FR-023b    | CCR-003 UPDATE      |
| `/api/contracts/{id}/add-ons`          | POST   | ComplianceController                   | FR-023c    | CCR-006 Transaction |
| `/api/contracts/{id}/add-ons/{add_on_id}` | DELETE | ComplianceController                   | FR-023c    | CCR-003 DELETE      |
| `/api/rooms/{id}/meter-readings`       | POST   | ComplianceController                   | FR-023a    | CCR-003 INSERT      |
| `/api/health`                          | GET    | Closure                                  | —          | Operational         |


### 11.2 CCR Traceability Matrix (Reference Only)

This table maps the binding academic requirements (CCR) to the functional requirements and validation evidence defined in the project documentation.


| ID          | Requirement       | Related Targets           | Implementation Artifact        | Evidence Reference |
| ----------- | ----------------- | ------------------------- | ------------------------------ | ------------------ |
| **CCR-001** | Relational Model  | 14 Normalized Tables      | `db/havenstay_schema.sql`      | INT-101            |
| **CCR-002** | Distributed Data  | Primary-Replica Topology  | `docs/DISTRIBUTED_DB_SETUP.md` | LIVE-004           |
| **CCR-003** | SQL CRUD          | All operational workflows | `backend/app/Services/`        | TC-AUTH, TC-USER   |
| **CCR-004** | SQL Operators     | Filters and search logic  | `backend/app/Services/`        | TC-REPORT-002      |
| **CCR-005** | SQL JOINs         | 6 Automated Views         | `db/havenstay_schema.sql`      | TC-REPORT-003      |
| **CCR-006** | ACID Transactions | Payment and Check-in      | `backend/app/Services/`        | TC-PAYMENT-003     |
| **CCR-007** | Transaction Logs  | Critical state tracking   | `backend/app/Services/`        | TC-TX-001          |
| **CCR-008** | Forensic Audit    | 42 automated triggers     | `db/havenstay_schema.sql`      | TC-TRIGGER-001     |


### 11.3 Revision History


| Version   | Date           | Changes                                                                                                                                                                                                                                       |
| --------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0–v3.2 | 2026-03–04     | Initial draft through major restructuring, nomenclature sync, and trigger count fixes.                                                                                                                                                        |
| v4.0      | 2026-04-17     | Comprehensive industry-standard audit. Full re-read against codebase. Synchronized all requirement IDs (FR-001–040) across registries; corrected trigger count to 24; validated BR and NFR coverage in test plan.                             |
| v4.1      | 2026-04-17     | Core-doc standardization pass. Added Documentation Boundary Matrix; normalized business rules toward technology-agnostic requirement statements; moved implementation-specific details to SDD and Database Documentation.                     |
| v4.2      | 2026-04-17     | Introduction hardening pass. Formalized Documentation Boundary Matrix; cleaned Section 1 Scope and Purpose; added CCR Traceability Matrix (Section 11.2); linked operational constants (timezone, business date) to the Operations Runbook.   |
| v4.7      | 2026-04-17     | Final audit boundary hardening pass. Formally isolated implementation evidence (Section 9, 11) as Non-Normative; synchronized controller naming (AuthController); eliminated leakage in risk mitigation text to preserve contract purity. |
| v4.8      | 2026-04-18     | Philippine Compliance Hardening. Integrated R.A. 9653 (1% rent cap), two-phase Pending Payment check-in workflow, Gate Pass move-out clearance, and Master Appliance Registry requirements. |
| v4.9      | 2026-04-18     | Forensic Synchronization. Corrected canonical trigger count to 33; closed utility billing traceability gap by adding lifecycle status to Room Meter Readings. |
| v5.1      | 2026-04-18     | Forensic Synchronization. Corrected table count to 14; expanded FR-007 to include unique email mandated by forensics; synchronized FR-017 vacancy guards to include pending contracts. |
| **v5.2**  | **2026-04-18** | **Forensic Lock.** Finalized table count at 14; synchronized trigger count to 42 (full Roles coverage); established Surrogate PK pattern for audit traceability. |


---

*Aligned to: SDD.md v3.5 · db/havenstay_schema.sql (canonical) · API_REFERENCE.md v2.4 · OPERATIONS_RUNBOOK.md · TEST_PLAN.md v4.3*  
*Last Updated: April 18, 2026 (v5.2 — final forensic lock pass)*