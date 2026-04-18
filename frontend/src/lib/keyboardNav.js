import { ADMIN_NAV_ITEMS, OPERATIONS_NAV_ITEMS } from "./navItems";

/**
 * G+letter → route. Letters are fixed UX; hrefs must exist in navItems.
 * `w` = Transaction logs (`/transaction-logs`; admin-only route).
 */
const G_KEY_TO_HREF = {
  d: "/dashboard",
  t: "/tenants",
  r: "/rooms",
  c: "/contracts",
  b: "/billing",
  p: "/payments",
  o: "/reports",
  l: "/admin/audit-logs",
  u: "/admin/users",
  w: "/admin/transaction-logs",
};

const allNav = [...OPERATIONS_NAV_ITEMS, ...ADMIN_NAV_ITEMS];

function labelForHref(href) {
  const found = allNav.find((item) => item.href === href);
  if (!found) {
    throw new Error(`keyboardNav: missing href in navItems: ${href}`);
  }
  return found.label;
}

/** For help modal: key, href, sidebar label */
export const G_KEY_NAV_BINDINGS = Object.entries(G_KEY_TO_HREF).map(([key, href]) => ({
  key,
  href,
  label: labelForHref(href),
}));

/** For useKeyboardShortcuts: { d: "/dashboard", ... } */
export const G_KEY_ROUTES = Object.fromEntries(G_KEY_NAV_BINDINGS.map((b) => [b.key, b.href]));
