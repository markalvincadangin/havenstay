# HavenStay Boarding House Management System (BHMS)
## Project Plan

**Version:** 2.0  
**Last Updated:** May 02, 2026  
**Status:** Completed — Production Ready

---

## 1. Project Overview

This Project Plan defines the execution strategy for designing, developing, and deploying HavenStay BHMS. It is aligned with the following engineering specifications:

- [**CASE_STUDY.md**](CASE_STUDY.md) — Business Value & Context
- [**SRS.md**](SRS.md) — Product Requirements
- [**SDD.md**](SDD.md) — Technical Design

---

## 2. Technology Stack

| Layer | Technology | Version |
| :--- | :--- | :--- |
| **Backend** | Laravel (PHP 8.3+) | 13.x |
| **Frontend** | Next.js (App Router) | 16.x |
| **Frontend Styling** | Tailwind v4 + HS-Utility Layer | — |
| **Database** | MySQL (InnoDB) | 8.4+ |
| **Authentication** | Laravel Sanctum | 4.x |
| **Containerization** | Docker / Docker Compose | — |

---

## 3. Academic Compliance Requirements (CCR)

| CCR | Requirement | Status |
| :--- | :--- | :--- |
| **CCR-001** | ≥ 6 relational tables in MySQL InnoDB | ✅ — 15 tables |
| **CCR-002** | Distributed Database (Primary/Replica) | ✅ — GTID replication |
| **CCR-003** | SQL CRUD via application layer | ✅ — Eloquent + raw SQL |
| **CCR-004** | SQL Operators (AND, OR, BETWEEN, LIKE) | ✅ — Used in reporting views |
| **CCR-005** | Multi-table JOINs | ✅ — 6 reporting views |
| **CCR-006** | ACID Transactions | ✅ — `DB::transaction()` in services |
| **CCR-007** | Change Audit via AFTER Triggers | ✅ — 45 forensic triggers |

---

## 4. Work Breakdown Structure (WBS)

### Phase 1: Planning & Setup
- Finalize requirements and compliance checklist.
- Lock technology stack (Laravel 11 + Next.js 14).
- Initialize repository and Docker Compose development environment.

### Phase 2: Database & Architecture
- Implement authoritative MySQL schema (15 tables, 6 views).
- Develop 45 forensic triggers:
  - 42 data-capture (14 tables × AFTER INSERT + AFTER UPDATE + AFTER DELETE)
  - 2 immutability guards (BEFORE UPDATE + BEFORE DELETE on `audit_logs`)
  - 1 assignment guard (BEFORE INSERT on `meter_assignments`)
- Establish Primary-Replica GTID replication topology.

### Phase 3: Backend Services
- Implement 5-Tier Extended MVC (Middleware → Controller → Service → Model → Database).
- Implement `AuditService`, `AuthorizationService`, `SetAuditContext` middleware.
- Implement all domain services: `ContractService`, `BillingService`, `PaymentService`, `MeterService`, `RoomService`, `TenantService`.
- Implement `BatchBillingProcessor` (resilient non-blocking batch workflow).

### Phase 4: Frontend Application
- Implement Next.js App Router feature-based architecture.
- Build design system using Vanilla CSS (`hs-*` utility classes in `globals.css`).
- Implement RBAC-aware navigation and role-gated pages (Admin, Staff, Viewer).
- Implement all operational modules: Tenants, Rooms, Contracts, Billing, Payments, Utilities, Reports, Audit Logs.

### Phase 5: Forensic Hardening & Stabilization
- Implement Dual-Path Payment Forensic Context Resolution (BR-PAY-011).
- Implement XOR payment constraint (BR-PAY-002) at the schema level.
- Implement Gate Pass Clearance workflow (zero-balance check on move-out).
- Implement Two-Phase Check-In (atomic bed reservation on contract creation).
- Validate all 45 triggers and reporting views against CCR requirements.

---

## 5. Scope and Deliverables

| Deliverable | Description |
| :--- | :--- |
| **[SRS.md](SRS.md)** | Software Requirements Specification |
| **[SDD.md](SDD.md)** | System Design & Architecture Document |
| **[DATABASE.md](DATABASE.md)** | Database Schema and Forensic Engine Reference |
| **[BUSINESS_RULES.md](BUSINESS_RULES.md)** | Authoritative Business Rules (BR) |
| **[API_REFERENCE.md](API_REFERENCE.md)** | REST API Contract — all endpoints |
| **[BACKEND_CODING_BLUEPRINT.md](BACKEND_CODING_BLUEPRINT.md)** | Backend Architecture & Coding Standards |
| **[FRONTEND_CODING_BLUEPRINT.md](FRONTEND_CODING_BLUEPRINT.md)** | Frontend Architecture & Coding Standards |
| **[TEST_PLAN.md](TEST_PLAN.md)** | Verification & Validation Strategy |
| **[DEPLOYMENT.md](DEPLOYMENT.md)** | Production Deployment Guide (Render + Vercel + Aiven) |
| **[DEV_SETUP.md](DEV_SETUP.md)** | Local Development Setup Guide |
| **[OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md)** | Operational Procedures & Temporal Logic |
| **[DISTRIBUTED_DB_SETUP.md](DISTRIBUTED_DB_SETUP.md)** | Primary-Replica Database Setup Guide |
| **[havenstay_schema.sql](../db/havenstay_schema.sql)** | Canonical Database Schema (v5.0) |
| **[havenstay_schema.sql (mirror)](../backend/database/sql/havenstay_schema.sql)** | Deployment Copy — must remain identical to canonical |

---

## 6. Revision History

| Version | Date | Changes |
| :--- | :--- | :--- |
| v1.0 | 2026-03-27 | Initial project plan created. |
| v1.4 | 2026-04-09 | Professional overhaul: ToC refinement and link integrity. |
| v1.5 | 2026-04-11 | WBS CCR trigger count aligned; cross-references verified. |
| v1.6 | 2026-04-18 | Finalized forensic lock for production release. |
| **v2.0** | **2026-05-02** | **Major overhaul: Corrected tech stack (Laravel 11, Next.js 14), trigger count (45), removed non-existent CCR-008. Expanded WBS to all 5 phases. Expanded deliverables to all 14 docs artifacts plus both schema copies.** |

---

*Aligned to: SRS.md v5.2 · SDD.md v5.3 · DATABASE.md v5.3 · BUSINESS_RULES.md v2.3*  
*Last Updated: May 02, 2026*
