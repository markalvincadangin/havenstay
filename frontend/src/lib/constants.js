/**
 * HavenStay Universal Constants & Enums
 * Source of truth: ENUM columns in `backend/database/sql/havenstay_schema.sql` (mirrors `db/havenstay_schema.sql`),
 * with labels aligned to `docs/SRS.md` §6.3 where applicable. Vitest checks keys vs that DDL file.
 */

// 1. Payment Methods & Statuses
export const METHOD_LABELS = {
  cash: "Cash",
  gcash: "GCash",
  bank_transfer: "Bank Transfer",
  other: "Others",
};

/** Stable order for selects (matches schema ENUM order). */
export const PAYMENT_METHOD_KEYS = Object.keys(METHOD_LABELS);

export const PAYMENT_STATUS_LABELS = {
  posted: "Posted",
  voided: "Voided",
};

// 2. Tenant Statuses
export const TENANT_STATUS_LABELS = {
  active: "Active",
  moved_out: "Moved Out",
  archived: "Archived",
};

// 3. Room Statuses
export const ROOM_STATUS_LABELS = {
  vacant: "Vacant",
  partially_occupied: "Partially Occupied",
  fully_occupied: "Fully Occupied",
  maintenance: "Maintenance",
  archived: "Archived",
};

/** Valid `rooms.status` keys (schema ENUM order). */
export const ROOM_STATUS_KEYS = Object.keys(ROOM_STATUS_LABELS);

/**
 * Room list / detail: when `rooms.status` is `maintenance` or `unavailable`, the whole unit
 * is off the market (bed-level rows may still show vacant/occupied until staff syncs beds).
 */
export const ROOM_UNIT_OFFLINE_BED_HINT = {
  maintenance: "Unit in maintenance — beds are not bookable until the unit is available again.",
};

/**
 * Room edit form — descriptive `<option>` text (same keys as ROOM_STATUS_LABELS).
 */
export const ROOM_STATUS_OPTION_LABELS = {
  vacant: "Vacant (Available)",
  maintenance: "Maintenance",
};

/**
 * Room edit form — descriptive room type options (same keys as ROOM_TYPE_LABELS).
 */
export const ROOM_TYPE_OPTION_LABELS = {
  solo: "Solo (Private Unit)",
  shared: "Shared (Multi-Bed Unit)",
};

// 4. Bed Space Statuses
export const BED_STATUS_LABELS = {
  vacant: "Vacant",
  occupied: "Occupied",
  maintenance: "Maintenance",
};

// 5. Room Category Types
export const ROOM_TYPE_LABELS = {
  solo: "Solo Room",
  shared: "Shared Room",
};

// 6. Contract Lifecycle Statuses
export const CONTRACT_STATUS_LABELS = {
  pending_payment: "Pending Payment",
  active: "Active",
  completed: "Completed",
  terminated: "Terminated",
  voided: "Voided",
};

// 7. Billing Ledger Statuses
export const BILLING_STATUS_LABELS = {
  unpaid: "Unpaid",
  partial: "Partial Payment",
  paid: "Settled",
  overdue: "Past Due",
};

export const BILLING_AGING_FILTER_LABELS = {
  all: "All balances",
  current: "Current (not yet due)",
  past_due: "Past-due balances",
};

// 8. Billing Line Item Categories
export const BILLING_ITEM_TYPE_LABELS = {
  base_rent: "Base Rent",
  utility: "Utility",
  add_on: "Add-on",
  penalty: "Penalty",
  adjustment: "Adjustment",
};

// 9. Audit & System Actions
export const AUDIT_ACTION_LABELS = {
  insert: "Insert",
  update: "Update",
  delete: "Delete",
  create: "Create",
  login: "Login",
  logout: "Logout",
  access_denied: "Access Denied",
  status_change: "Status Change",
  archive: "Archive",
  restore: "Restore",
};

/** `audit_logs.target_table` display names (filters + table). */
export const AUDIT_ENTITY_LABELS = {
  tenants: "Tenants",
  rooms: "Rooms",
  contracts: "Contracts",
  billing: "Billing",
  payments: "Payments",
  users: "Users",
  bed_spaces: "Bed Spaces",
  billing_line_items: "Line Items",
};

/** Entity filter on audit log API — tables with AFTER INSERT/UPDATE/DELETE audit triggers per schema. */
export const AUDIT_ENTITY_FILTER_KEYS = [
  "tenants",
  "rooms",
  "contracts",
  "billing",
  "billing_line_items",
  "payments",
  "users",
  "bed_spaces",
];

/**
 * Human labels for `audit_logs.target_table` when it stores an app permission / resource key
 * (see `AuditService::logAccessDenied()`), not a table name. Keys must match backend strings exactly.
 */
export const AUDIT_RESOURCE_LABELS = {
  "audit_logs.list": "Audit trail (list)",
  "audit_logs.export": "Audit trail (export)",
  "billing.create": "Billing (create)",
  "billing.update_status": "Billing (update status)",
  "billing.view": "Billing (view)",
  "bed_spaces.create": "Bed spaces (add)",
  "bed_spaces.occupy": "Bed spaces (assign tenant)",
  "contracts.create": "Contracts (create)",
  "contracts.list": "Contracts (list)",
  "contracts.move_out": "Contracts (move out)",
  "contracts.update": "Contracts (update)",
  "contracts.view": "Contracts (view)",
  "payments.index": "Payments (list)",
  "payments.show": "Payments (view)",
  "payments.store": "Payments (record)",
  "payments.void": "Payments (void)",
  "reports.activeContracts": "Report: Active contracts",
  "reports.activeContractsExport": "Report export: Active contracts",
  "reports.billingSummary": "Report: Billing summary",
  "reports.billingSummaryExport": "Report export: Billing summary",
  "reports.collectionsPerformance": "Report: Collections",
  "reports.collectionsPerformanceExport": "Report export: Collections",
  "reports.occupancy": "Report: Occupancy by room",
  "reports.occupancyExport": "Report export: Occupancy by room",
  "reports.occupancyStatus": "Report: Occupancy by bed",
  "reports.occupancyStatusExport": "Report export: Occupancy by bed",
  "reports.outstandingBalances": "Report: Outstanding balances",
  "reports.outstandingBalancesExport": "Report export: Outstanding balances",
  "reports.tenantHistory": "Report: Tenant history",
  "reports.tenantHistoryExport": "Report export: Tenant history",
  "reports.tenantLedger": "Report: Tenant ledger",
  "reports.tenantLedgerExport": "Report export: Tenant ledger",
  "rooms.create": "Rooms (create)",
  "rooms.update": "Rooms (update)",
  "tenants.create": "Tenants (create)",
  "tenants.deactivate": "Tenants (deactivate)",
  "tenants.reactivate": "Tenants (reactivate)",
  "tenants.update": "Tenants (update)",
  "transaction_logs.list": "Transaction logs (list)",
  "users.assignRole": "Users (assign role)",
  "users.create": "Users (create)",
  "users.deactivate": "Users (deactivate)",
  "users.list": "Users (list)",
  "users.reactivate": "Users (reactivate)",
  "users.show": "Users (view)",
  "users.update": "Users (update)",
};

/**
 * Display `audit_logs.target_table` — DB table names, permission keys, or request paths.
 */
export function formatAuditEntityOrResource(entityName) {
  if (entityName == null || entityName === "") return "—";
  const key = String(entityName).trim();
  if (AUDIT_ENTITY_LABELS[key]) return AUDIT_ENTITY_LABELS[key];
  if (AUDIT_RESOURCE_LABELS[key]) return AUDIT_RESOURCE_LABELS[key];
  if (key.startsWith("/")) return `Request path: ${key}`;
  return key
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Display `audit_logs.record_id`; hides sentinel `denied` for access-denied rows. */
export function formatAuditEntityIdDisplay(entityId, action) {
  if (entityId == null || entityId === "") return "—";
  const s = String(entityId);
  if (action === "access_denied" && s.toLowerCase() === "denied") return "—";
  return s;
}

// 10. Transaction log states (`transaction_logs.status` — SRS.md §6.3; same order as schema ENUM)
export const TX_LOG_STATUS_LABELS = {
  started: "In Progress",
  committed: "Committed",
  failed: "Failed",
  rolled_back: "Rolled Back",
};

/**
 * Tenant history report filter labels — GET /api/reports/tenant-history?status=
 * (docs/API_REFERENCE.md). Combines tenant + contract status codes used by the API.
 */
export const TENANT_HISTORY_STATUS_FILTER_LABELS = {
  all: "All Statuses",
  active: TENANT_STATUS_LABELS.active,
  /** API maps to contracts completed or terminated (ended lease), not tenant profile alone. */
  moved_out: "Ended lease (completed/terminated)",
  completed: CONTRACT_STATUS_LABELS.completed,
  terminated: CONTRACT_STATUS_LABELS.terminated,
};

/**
 * User directory filters — `roles.role_name` (API lowercased) and `is_active` (not DB ENUMs).
 */
export const ROLE_NAME_LABELS = {
  admin: "Admin",
  staff: "Staff",
  viewer: "Viewer",
};

/** Shared fallback when role lookup API is unavailable. */
export const USER_ROLE_FALLBACK_OPTIONS = [
  { role_id: 1, role_name: "admin" },
  { role_id: 2, role_name: "staff" },
  { role_id: 3, role_name: "viewer" },
];

export const USER_ACCOUNT_STATUS_FILTER_LABELS = {
  all: "All statuses",
  active: "Active",
  inactive: "Inactive",
};

/** Normalize enum-like backend keys for safe comparisons. */
export function normalizeEnumKey(value) {
  return String(value ?? "").toLowerCase().trim();
}

export function isContractActive(status) {
  return normalizeEnumKey(status) === "active";
}

export function isPaymentMethodCash(method) {
  return normalizeEnumKey(method) === "cash";
}

/** Billing rows that are valid for manual collection selection. */
export function isBillingCollectibleStatus(status) {
  const key = normalizeEnumKey(status);
  return key === "unpaid" || key === "partial";
}
