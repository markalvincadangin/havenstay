# HavenStay Operations Runbook

This document defines the operational procedures and environmental constants for the HavenStay Boarding House Management System (BHMS).

## 1. Temporal Definitions (BR-015)

The system relies on a deterministic "Business Date" for financial and logic evaluation (overdue detection, receivables aging, movement forecasting).

- **System Timezone**: All date comparisons and timestamps are evaluated in the **Asia/Manila** (PST) timezone.
- **System Business Date**: In Release 1, the business date is derived from the current server system time in the Asia/Manila timezone.
- **Reporting Cutoff**: Collections and billing summaries use a "day-inclusive" window (e.g. `00:00:00` to `23:59:59` of the specified dates).

## 2. Operational Windows (BR-019)

- **Pending Move-out Window**: Defined as **30 calendar days** from the current business date. This window is used by the Dashboard KPI and Tenant Summary endpoints.
- **Billing Overdue Threshold**: A billing cycle is considered overdue immediately after the `due_date` has passed (i.e., `due_date < current_business_date`) if a balance remains.

## 3. Manual Procedures (Release 1)

As part of the Release 1 constraints defined in **BR-001** and **BR-020**:

- **Billing Generation**: Operators must manually trigger billing generation for each contract per cycle via the `/api/billing` endpoint.
- **Penalty Assessment**: The system does not automatically calculate late fees. Operators must manually add a `penalty` item type to the itemized billing line items if a fee is required by policy.
- **Deposit Reconciliation**: Final deposit returns or deductions are recorded as free-text notes in the contract closure workflow.

## 4. Maintenance and Troubleshooting

### Primary-Replica Lag
If the dashboard appears stale (replica data not in sync with primary), verify the MySQL replication status:
```sql
SHOW REPLICA STATUS\G
```

### Forensic Auditing
To trace a specific workflow outcome to its database changes, filter the **Audit Logs** by the `correlation_id` returned in the API response header or found in the audit entry details.

---
*Last Updated: April 2026*
