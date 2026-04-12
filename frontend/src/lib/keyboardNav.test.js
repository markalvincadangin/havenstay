import { describe, expect, it } from "vitest";
import { G_KEY_NAV_BINDINGS, G_KEY_ROUTES } from "./keyboardNav";
import { ADMIN_NAV_ITEMS, OPERATIONS_NAV_ITEMS } from "./navItems";

describe("keyboardNav", () => {
  it("every G+ route href exists in navItems", () => {
    const hrefs = new Set([...OPERATIONS_NAV_ITEMS, ...ADMIN_NAV_ITEMS].map((i) => i.href));
    for (const { href } of G_KEY_NAV_BINDINGS) {
      expect(hrefs.has(href), href).toBe(true);
    }
  });

  it("G_KEY_ROUTES matches bindings", () => {
    expect(Object.keys(G_KEY_ROUTES).length).toBe(G_KEY_NAV_BINDINGS.length);
    for (const b of G_KEY_NAV_BINDINGS) {
      expect(G_KEY_ROUTES[b.key]).toBe(b.href);
    }
  });
});
