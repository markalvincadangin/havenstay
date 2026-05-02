# HavenStay Boarding House Management System (BHMS)
## Operations Runbook: Standard Procedures and Temporal Logic

**Version:** 1.5  
**Last Updated:** May 02, 2026  
**Status:** Stable - Operational Baseline

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Temporal Definitions (BR-015)](#2-temporal-definitions-br-015)
3. [Operational Windows (BR-019)](#3-operational-windows-br-019)
4. [Environmental Constants](#4-environmental-constants)
5. [Routine Maintenance](#5-routine-maintenance)
6. [Revision History](#6-revision-history)

---

## 1. Introduction

This document defines the operational procedures, environmental constants, and temporal logic for the HavenStay Boarding House Management System (BHMS). It ensures that all users and systems interpret time and data consistently across different timezones and reporting periods.

## 2. Temporal Definitions (BR-015)

The system relies on a deterministic "Business Date" for financial and logic evaluation, such as overdue detection, receivables aging, and movement forecasting.

- **System Timezone**: All date comparisons and timestamps are evaluated in the **Asia/Manila** (PST) timezone.
- **System Business Date**: In Release 1, the business date is derived from the current server system time in the Asia/Manila timezone.
- **Reporting Cutoff**: Collections and billing summaries use a "day-inclusive" window (e.g., `00:00:00` to `23:59:59` of the specified dates).

## 3. Operational Windows (BR-019)

Operational windows define when certain batch actions (like billing generation) are permitted to ensure data stability.

- **Billing Generation**: Permitted only after the 25th of the current month for the upcoming cycle.
- **Grace Period**: Standard 5-day grace period for all billing cycles before they are marked as `overdue`.

## 4. Environmental Constants

- **Currency**: All financial values are handled in Philippine Pesos (PHP).
- **Rounding**: Per BR-ANL-001, all final computations use `decimal:2` precision with standard arithmetic rounding.

## 5. Routine Maintenance

- **Log Rotation**: System logs are rotated every 30 days to maintain performance.
- **Audit Review**: Admin users should review `audit_logs` weekly to ensure compliance with forensic standards.

## 6. Revision History

| Version | Date | Changes |
| :--- | :--- | :--- |
| v1.0 | 2026-03-20 | Initial runbook created. |
| v1.4 | 2026-04-20 | Updated timezone and reporting cutoff definitions. |
| **v1.5** | **2026-05-02** | **Standardized formatting and aligned with HavenStay Documentation Standard.** |

---

*Document Author: HavenStay Operations Team*
