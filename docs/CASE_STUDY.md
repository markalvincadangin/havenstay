# HavenStay Boarding House Management System (BHMS)
## Case Study: Digital Transformation and Forensic Operational Excellence

**Version:** 2.1  
**Last Updated:** May 02, 2026  
**Status:** Stable - Canonical Case Study

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Business Profile](#2-business-profile)
3. [Current Business Environment](#3-current-business-environment)
4. [Problem Identification](#4-problem-identification)
5. [Business Impact](#5-business-impact)
6. [Opportunity for System Improvement](#6-opportunity-for-system-improvement)
7. [Implementation Case: Forensic Data Retention](#7-implementation-case-forensic-data-retention)
8. [UX Transformation: From Robotic to Professional](#8-ux-transformation-from-robotic-to-professional)
9. [Project Justification and Conclusion](#9-project-justification-and-conclusion)
10. [Revision History](#10-revision-history)

---

## 1. Introduction

Rapid urbanization and the continuous growth of tertiary education have sharply increased demand for off-campus student housing and communal options such as boarding houses. These facilities serve as critical socio-economic infrastructure for students and transient workers. However, a significant technological disparity exists: while large real estate entities utilize advanced Property Management Systems (PMS), smaller operations remain reliant on outdated paper records. **HavenStay BHMS** was developed to bridge this gap, standardizing data management and optimizing operational workflows through forensic-grade digitalization.

## 2. Business Profile

### 2.1 Business Overview
The subject of this project is a representative "Boarding House" model—a residential facility offering multi-room accommodations. Typically managed by a single proprietor or resident "Landlord," these businesses oversee room assignments, maintenance, and complex manual bill collection cycles.

### 2.2 Services Offered
Standard operations include:
- **Room Rentals**: Solo or shared (dormitory-style) accommodations.
- **Utility Provisions**: Electricity and water, monitored via sub-meters.
- **Amenities**: Wifi, shared kitchens, and common bathroom facilities.

## 3. Current Business Environment

### 3.1 Operational Setup
Daily operations are primarily handled through manual or loosely organized digital methods (e.g., fragmented spreadsheets). Rental agreements, move-in/out dates, and deposits are often tracked separately from payment records. Monitoring room occupancy requires physically checking rooms or cross-referencing multiple handwritten logs, leading to significant delays and oversight.

### 3.2 Pricing Structure
Pricing is determined on a monthly basis and varies by room type, capacity, and amenities. Charges typically include:
- Monthly base rent
- Variable utility charges (electricity/water)
- Security deposits and miscellaneous add-on fees
In the current environment, these balances are calculated manually, increasing the likelihood of financial inconsistencies.

### 3.3 Technology Usage
Technology usage is minimal and fragmented:
- Paper-based tenant registries and handwritten payment receipts.
- No centralized system for managing the lifecycle of a contract.
- Historical data retrieval is difficult, and reporting is non-existent.

## 4. Problem Identification

### 4.1 Observed Problems
- **Manual Inefficiency**: Significant time is lost to repetitive record-keeping.
- **Inconsistent Records**: Discrepancies between room status and payment logs.
- **Monitoring Difficulty**: Determining "Bed-Level" availability requires manual validation.
- **Unreliable Payment Tracking**: Outstanding balances are difficult to verify accurately.
- **Limited Accountability**: Lack of user access control makes tracing actions impossible.
- **Data Loss Risk**: Physical logbooks are susceptible to damage (water, fire, or age).

### 4.2 Root Causes
Systemic inefficiencies are symptoms of structural flaws:
1. Total dependence on manual documentation.
2. Absence of a centralized, relational management system.
3. Lack of automated tracking for the billing-to-payment lifecycle.

## 5. Business Impact

Inaccurate payment tracking and unclear occupancy status result in financial discrepancies, disputes, and reduced managerial control, ultimately affecting the sustainability of boarding house operations.

## 6. Opportunity for System Improvement

The HavenStay framework provides a centralized digital framework to realize:
- **Centralized Management**: Consolidating all tenant and room data into a single relational database.
- **Bed-Level Accuracy**: Digitalizing contract terms and occupancy status for shared units.
- **Automated Billing**: Reducing manual computation and improving line-item accuracy.
- **Historical Archiving**: Secure, searchable records of all past tenants and transactions.
- **Data-Driven Reporting**: Instant financial summaries without manual calculation.

## 7. Implementation Case: Forensic Data Retention

To maintain **Audit Compliance (BR-PAY-011)**, HavenStay implemented a Forensic Retrieval Strategy. Previously, archiving a tenant or room would "orphan" their financial records. The new system utilizes `withTrashed()` relationships to ensure every payment is always visually resolvable to its original tenant and room, maintaining a permanent audit trail.

## 8. UX Transformation: From Robotic to Professional

Responding to staff feedback, the HavenStay portal was redesigned to balance authority with usability:
- **Professional Split-Layout**: A high-impact branding section paired with a clean, accessible login portal.
- **Humanized Affordance**: Replacing robotic security terminology (e.g., "Administrative Identity") with professional, familiar standards ("Welcome Back", "Password").

## 9. Project Justification and Conclusion

The development of HavenStay is justified by the critical need for **Data Integrity and Auditability**. By reducing manual inefficiencies and providing a scalable, accessible solution, HavenStay supports better decision-making for small-scale operators. This analysis serves as the foundation for a system designed for forensic operational excellence.

## 10. Revision History

| Version | Date | Changes |
| :--- | :--- | :--- |
| v1.0 | 2026-03-27 | Initial case study finalized. |
| v1.1 | 2026-04-09 | Professional overhaul: Narrative refinement and formatting. |
| v1.2 | 2026-04-11 | Audit narrative aligned to layered logging (triggers + services). |
| v2.0 | 2026-05-02 | Major Update: Added Forensic Data Retention and UX Transformation case studies. |
| **v2.1** | **2026-05-02** | **Full Integration: Merged original business profile ideas with forensic/professional updates. Standardized to HavenStay Doc Standard.** |

---

*Document Author: HavenStay Engineering Team*