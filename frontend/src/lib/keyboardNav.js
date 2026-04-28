import { ADMIN_NAV_ITEMS, OPERATIONS_NAV_ITEMS } from "./navItems";

/**
 * G+letter → route. Letters are fixed UX; hrefs must exist in navItems.
 * Access to Audit Logs (`l`) is reserved for Admin roles.
 */
const G_KEY_TO_HREF = {
  d: "/dashboard",
  t: "/tenants",
  r: "/rooms",
  c: "/contracts",
  b: "/billing",
  p: "/payments",
  m: "/utilities",
  o: "/admin/reports",
  l: "/admin/audit-logs",
  u: "/admin/users",
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

/**
 * Application shortcuts implemented in `useKeyboardShortcuts.js`.
 * Do not use browser-reserved combos for app actions (e.g. Ctrl+P = Print, Ctrl+R = reload).
 */
export const APP_KEYBOARD_SHORTCUTS = [
  { id: "payment-new", keys: "Alt + Shift + P", label: "Open new payment form" },
  { id: "refresh", keys: "Alt + Shift + R", label: "Refresh application data" },
];
