/**
 * Shared primary navigation (routes + labels). Icons are mapped in Sidebar only.
 */

export const OPERATIONS_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tenants", label: "Tenants" },
  { href: "/rooms", label: "Rooms" },
  { href: "/contracts", label: "Contracts" },
  { href: "/billing", label: "Billing" },
  { href: "/payments", label: "Payments" },
  { href: "/reports", label: "Reports" },
];

export const ADMIN_NAV_ITEMS = [
  { href: "/admin/users", label: "User Accounts" },
  { href: "/admin/items", label: "Assets & Items" },
  { href: "/admin/meters", label: "Meter Hub" },
  { href: "/admin/audit-logs", label: "Audit Trail" },
  { href: "/admin/transaction-logs", label: "Transaction Logs" },
];
