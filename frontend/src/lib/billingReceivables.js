import { startOfDay } from './formatters';

/**
 * Calendar-based receivables helpers. Billing `status` may be `partial` even when past due
 * (see BillingService::autoUpdateStatus / BR-004); do not use `status === "overdue"` alone for collections KPIs.
 */

/**
 * True when there is a positive balance and the due date is before today (start of day).
 * Works with billing list rows (`balance`, `due_date`) and report rows (`outstanding_balance`, `due_date`).
 *
 * @param {object} row
 * @returns {boolean}
 */
export function isPastDueReceivable(row) {
  if (!row?.due_date) return false;
  const bal = Number(row.balance ?? row.outstanding_balance ?? 0);
  if (Number.isNaN(bal) || bal <= 0) return false;
  const due = startOfDay(row.due_date);
  const today = startOfDay(new Date());
  return due < today;
}

/**
 * Whole days after due date (0 if not past due).
 *
 * @param {string|Date} dueDate
 * @returns {number}
 */
export function daysPastDue(dueDate) {
  if (!dueDate) return 0;
  const today = startOfDay(new Date());
  const due = startOfDay(dueDate);
  const diffTime = today - due;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}
