/**
 * HavenStay Universal Constants & Enums
 * Source of truth: ENUM columns in `backend/database/sql/havenstay_schema.sql` (mirrors `db/havenstay_schema.sql`),
 * with labels aligned to `docs/SRS.md` §6.3 where applicable. Vitest checks keys vs that DDL file.
 */

// 1. Payment Methods & Statuses
export const METHOD_LABELS = {
  cash: 'Cash',
  gcash: 'GCash',
  bank_transfer: 'Bank Transfer',
  other: 'Others',
};

/** Stable order for selects (matches schema ENUM order). */
export const PAYMENT_METHOD_KEYS = Object.keys(METHOD_LABELS);

export const PAYMENT_STATUS_LABELS = {
  posted: 'Posted',
  voided: 'Voided',
};

// 2. Tenant Statuses
export const TENANT_STATUS_LABELS = {
  onboarded: 'Onboarded',
  active: 'Active',
  moved_out: 'Moved Out',
  archived: 'Archived',
};

// 3. Room Statuses
export const ROOM_STATUS_LABELS = {
  available: 'Available',
  unavailable: 'Fully Occupied',
  maintenance: 'Maintenance',
  decommissioned: 'Decommissioned',
};

/** Valid `rooms.status` keys (schema ENUM order). */
export const ROOM_STATUS_KEYS = Object.keys(ROOM_STATUS_LABELS);

/**
 * Room list / detail: when `rooms.status` is `maintenance` or `unavailable`, the whole unit
 * is off the market (bed-level rows may still show vacant/occupied until staff syncs beds).
 */
export const ROOM_UNIT_OFFLINE_BED_HINT = {
  maintenance:
    'Unit in maintenance — beds are not bookable until the unit is available again.',
};

/**
 * Room edit form — descriptive `<option>` text (same keys as ROOM_STATUS_LABELS).
 */
export const ROOM_STATUS_OPTION_LABELS = {
  available: 'Available',
  maintenance: 'Maintenance',
};

/**
 * Room edit form — descriptive room type options (same keys as ROOM_TYPE_LABELS).
 */
export const ROOM_TYPE_OPTION_LABELS = {
  private: 'Private (Single Bed Unit)',
  shared: 'Shared (Multi-Bed Unit)',
};

// 4. Bed Space Statuses
export const BED_STATUS_LABELS = {
  vacant: 'Vacant',
  occupied: 'Occupied',
  maintenance: 'Maintenance',
};

// 4.1 Meter Statuses
export const METER_STATUS_LABELS = {
  active: 'Active',
  maintenance: 'Maintenance',
  replaced: 'Replaced',
};

// 5. Room Category Types
export const ROOM_TYPE_LABELS = {
  private: 'Private Room',
  shared: 'Shared Room',
};

// 6. Contract Lifecycle Statuses
export const CONTRACT_STATUS_LABELS = {
  pending_payment: 'Pending Payment',
  active: 'Active',
  completed: 'Completed',
  terminated: 'Terminated',
  voided: 'Voided',
  archived: 'Archived',
};

/**
 * Statuses that represent an ongoing financial or occupancy commitment.
 * Used for tenant availability checks and occupancy reports.
 */
export const ACTIVE_CONTRACT_STATUS_KEYS = ['active', 'pending_payment'];

// 7. Billing Ledger Statuses
export const BILLING_STATUS_LABELS = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
  overdue: 'Overdue',
};

export const BILLING_AGING_FILTER_LABELS = {
  all: 'All Balances',
  current: 'Current (not yet due)',
  past_due: 'Past-due balances',
};

// 8. Billing Line Item Categories
export const BILLING_ITEM_TYPE_LABELS = {
  base_rent: 'Base Rent',
  utility: 'Utility',
  penalty: 'Penalty',
  adjustment: 'Adjustment',
};

// 9. Audit & System Actions
export const AUDIT_ACTION_LABELS = {
  // Lowercase keys for REST API consistency
  insert: 'Insert',
  update: 'Update',
  delete: 'Delete',
  create: 'Create',
  login: 'Login',
  logout: 'Logout',
  access_denied: 'Access Denied',
  failed_login: 'Failed Login',
  status_change: 'Status Change',
  archive: 'Archive',
  restore: 'Restore',
  soft_delete: 'Soft Delete',
  // Uppercase keys for Direct Database Trigger Parity
  CREATE: 'Create',
  UPDATE: 'Update',
  DELETE: 'Delete',
  SOFT_DELETE: 'Soft Delete',
  RESTORE: 'Restore',
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  FAILED_LOGIN: 'Failed Login',
  ACCESS_DENIED: 'Access Denied',
  VOID: 'Void',
  SYSTEM: 'System Event',
  SECURITY: 'Security Alert',
  EXPORT: 'Export',
};

/** `audit_logs.target_table` display names (filters + table). */
export const AUDIT_ENTITY_LABELS = {
  tenants: 'Tenants',
  rooms: 'Rooms',
  contracts: 'Contracts',
  billing: 'Billings',
  payments: 'Payments',
  users: 'Users',
  roles: 'System Roles',
  bed_spaces: 'Bed Spaces',
  billing_line_items: 'Line Items',
  meters: 'Utility Meters',
  meter_assignments: 'Meter Assignments',
  meter_readings: 'Meter Readings',
  utility_rates: 'Utility Rates',
  utilities: 'Utility Services',
};

/**
 * Entity filter groupings for audit log UI.
 * Standardizes the 3-category administrative filter standard.
 */
export const AUDIT_ENTITY_FILTER_GROUPS = {
  'Core Entities': [
    'tenants',
    'rooms',
    'bed_spaces',
    'contracts',
    'users',
    'roles',
  ],
  Utility: [
    'utilities',
    'meters',
    'meter_readings',
    'meter_assignments',
    'utility_rates',
  ],
  Financial: ['billing', 'billing_line_items', 'payments'],
};

/**
 * Human labels for `audit_logs.target_table` when it stores an app permission / resource key
 * (see `AuditService::logAccessDenied()`), not a table name. Keys must match backend strings exactly.
 */
export const AUDIT_RESOURCE_LABELS = {
  'audit_logs.list': 'Audit trail (list)',
  'audit_logs.export': 'Audit trail (export)',
  'billing.create': 'Billing (create)',
  'billing.update_status': 'Billing (update status)',
  'billing.view': 'Billing (view)',
  'bed_spaces.create': 'Bed spaces (add)',
  'bed_spaces.occupy': 'Bed spaces (assign tenant)',
  'contracts.create': 'Contracts (create)',
  'contracts.list': 'Contracts (list)',
  'contracts.move_out': 'Contracts (move out)',
  'contracts.update': 'Contracts (update)',
  'contracts.view': 'Contracts (view)',
  'payments.index': 'Payments (list)',
  'payments.show': 'Payments (view)',
  'payments.store': 'Payments (record)',
  'payments.void': 'Payments (void)',
  'reports.activeContracts': 'Report: Active contracts',
  'reports.activeContractsExport': 'Report export: Active contracts',
  'reports.billingSummary': 'Report: Billing summary',
  'reports.billingSummaryExport': 'Report export: Billing summary',
  'reports.collectionsPerformance': 'Report: Collections',
  'reports.collectionsPerformanceExport': 'Report export: Collections',
  'reports.occupancy': 'Report: Occupancy by room',
  'reports.occupancyExport': 'Report export: Occupancy by room',
  'reports.occupancyStatus': 'Report: Occupancy by bed',
  'reports.occupancyStatusExport': 'Report export: Occupancy by bed',
  'reports.outstandingBalances': 'Report: Outstanding balances',
  'reports.outstandingBalancesExport': 'Report export: Outstanding balances',
  'reports.tenantHistory': 'Report: Tenant history',
  'reports.tenantHistoryExport': 'Report export: Tenant history',
  'reports.tenantLedger': 'Report: Tenant ledger',
  'reports.tenantLedgerExport': 'Report export: Tenant ledger',
  'rooms.create': 'Rooms (create)',
  'rooms.update': 'Rooms (update)',
  'tenants.create': 'Tenants (create)',
  'tenants.deactivate': 'Tenants (deactivate)',
  'tenants.reactivate': 'Tenants (reactivate)',
  'tenants.update': 'Tenants (update)',
  'users.assignRole': 'Users (assign role)',
  'users.create': 'Users (create)',
  'users.deactivate': 'Users (deactivate)',
  'users.list': 'Users (list)',
  'users.reactivate': 'Users (reactivate)',
  'users.show': 'Users (view)',
  'users.update': 'Users (update)',
};

/**
 * Display `audit_logs.target_table` — DB table names, permission keys, or request paths.
 */
export function formatAuditEntityOrResource(entityName) {
  if (entityName == null || entityName === '') return '—';
  const key = String(entityName).trim();
  if (AUDIT_ENTITY_LABELS[key]) return AUDIT_ENTITY_LABELS[key];
  if (AUDIT_RESOURCE_LABELS[key]) return AUDIT_RESOURCE_LABELS[key];
  if (key.startsWith('/')) return `Request path: ${key}`;
  return key
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Display `audit_logs.record_id`; hides sentinel `denied` for access-denied rows. */
export function formatAuditEntityIdDisplay(entityId, action) {
  if (entityId == null || entityId === '') return '—';
  const s = String(entityId);
  if (action === 'access_denied' && s.toLowerCase() === 'denied') return '—';
  return s;
}

/** Transaction logs were retired in v4.8 in favor of trigger-based audit logs. */

/**
 * Tenant history report filter labels — GET /api/reports/tenant-history?status=
 * (docs/API_REFERENCE.md). Combines tenant + contract status codes used by the API.
 */
export const TENANT_HISTORY_STATUS_FILTER_LABELS = {
  all: 'All Statuses',
  active: TENANT_STATUS_LABELS.active,
  /** API maps to contracts completed or terminated (ended lease), not tenant profile alone. */
  moved_out: 'Ended lease (completed/terminated)',
  completed: CONTRACT_STATUS_LABELS.completed,
  terminated: CONTRACT_STATUS_LABELS.terminated,
};

/**
 * User directory filters — `roles.role_name` (API lowercased) and `is_active` (not DB ENUMs).
 */
export const ROLE_NAME_LABELS = {
  admin: 'Admin',
  staff: 'Staff',
  viewer: 'Viewer',
};

/** Shared fallback when role lookup API is unavailable. */
export const USER_ROLE_FALLBACK_OPTIONS = [
  { role_id: 1, role_name: 'admin' },
  { role_id: 2, role_name: 'staff' },
  { role_id: 3, role_name: 'viewer' },
];

export const USER_ACCOUNT_STATUS_FILTER_LABELS = {
  all: 'All Statuses',
  active: 'Active',
  inactive: 'Inactive',
  archived: 'Archived',
};

/** Normalize enum-like backend keys for safe comparisons. */
export function normalizeEnumKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim();
}

export function isContractActive(status) {
  return normalizeEnumKey(status) === 'active';
}

/**
 * BR-CON-010: Core terms are immutable once a contract has ended.
 * Returns true if the contract is in a terminal state.
 */
export function isContractEnded(status) {
  const key = normalizeEnumKey(status);
  return ['completed', 'terminated', 'voided', 'archived'].includes(key);
}

/**
 * Returns true if the contract allows general metadata edits (notes, expected move-out).
 * Terminal states block all edits except notes (handled at form level).
 */
export function isContractEditable(status) {
  return !isContractEnded(status);
}

/**
 * BR-CON-005: Rates and deposits are locked once a contract is active.
 * Only 'pending_payment' allows correction of financial terms.
 */
export function isContractFinanciallyLocked(status) {
  const key = normalizeEnumKey(status);
  return ['active', 'completed', 'terminated', 'voided', 'archived'].includes(
    key
  );
}

export function isPaymentMethodCash(method) {
  return normalizeEnumKey(method) === 'cash';
}

/** Billing rows that are valid for manual collection selection. */
export function isBillingCollectibleStatus(status) {
  const key = normalizeEnumKey(status);
  return key === 'unpaid' || key === 'partial';
}

/** Predefined Tailwind classes for interactive registry table rows. */
export const INTERACTIVE_TABLE_ROW_CLASS =
  'group cursor-pointer border-t border-stone-100 transition-colors hover:bg-stone-50 active:bg-stone-100';

/**
 * Authoritative ID prefixes for forensic display.
 * Maps entity types to their UI-facing prefixes.
 */
export const ID_PREFIX_MAP = {
  tenant: 'TENANT',
  contract: 'CONTRACT',
  billing: 'BILL',
  room: 'ROOM',
  bed: 'BS',
  payment: 'PAY',
  audit: 'AUDIT',
  reading: 'RDG',
  meter: 'MTR',
  rate: 'RATE',
  user: 'USER',
  utility: 'UTL',
};
// 10. Dashboard UI Labels & Search Patterns

export const SEARCH_LABELS = {
  tenants: 'Search Tenants',
  rooms: 'Search Rooms',
  contracts: 'Search Contracts',
  billing: 'Search Billing',
  payments: 'Search Payments',
  audit_logs: 'Search Audit Logs',
  users: 'Search Users',
  utilities: 'Search Utilities',
  meters: 'Search Meters',
};

export const SEARCH_PLACEHOLDERS = {
  tenants: 'Name, phone, email, or #TENANT ID…',
  rooms: 'Room code, tenant name, amenities, or #ROOM ID…',
  contracts: 'Tenant name, room code, or #CONTRACT ID…',
  billing: 'Tenant name, phone, or #BILL ID…',
  payments: 'Tenant name, reference, or #PAYMENT ID…',
  audit_logs: 'IP address, actor name, or #LOG ID…',
  users: 'Name, username, email, or #USER ID…',
  utilities: 'Name, measurement unit, or #UTILITY ID…',
  meters: 'Serial number, assigned room, or #METER ID…',
};

/** Shared UI filter standard labels. */
export const FILTER_ALL_OPTION = 'All Statuses';

export const ROLE_FILTER_LABELS = {
  all: 'All Roles',
  ...ROLE_NAME_LABELS,
};

export const UTILITY_TYPE_FILTER_LABELS = {
  all: 'All Types',
};

export const UTILITY_STATUS_FILTER_LABELS = {
  all: 'All Statuses',
  active: 'Active',
  archived: 'Archived',
};
export const FILTER_ALL_TYPES = 'All Types';
export const FILTER_ALL_RESOURCES = 'All Resources';
export const FILTER_ALL_ACTIONS = 'All Actions';
