import {
  canManageUsers,
  canViewReports,
  canViewAuditLogs,
  canViewBilling,
  _canManageRooms,
  canManageMeters,
} from './auth';
/**
 * Shared primary navigation (routes + labels + visibility predicates).
 * Icons are mapped in Sidebar only to avoid circular component dependencies.
 */
export const OPERATIONS_NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', predicate: () => true },
  { href: '/tenants', label: 'Tenants', predicate: canViewBilling },
  { href: '/rooms', label: 'Rooms', predicate: canViewBilling },
  { href: '/contracts', label: 'Contracts', predicate: canViewBilling },
  { href: '/billing', label: 'Billings', predicate: canViewBilling },
  { href: '/payments', label: 'Payments', predicate: canViewBilling },
  { href: '/utilities', label: 'Utilities', predicate: canManageMeters },
];
export const ADMIN_NAV_ITEMS = [
  { href: '/admin/users', label: 'Users', predicate: canManageUsers },
  { href: '/admin/reports', label: 'Reports', predicate: canViewReports },
  {
    href: '/admin/audit-logs',
    label: 'Audit Logs',
    predicate: canViewAuditLogs,
  },
];
