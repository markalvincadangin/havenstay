import { describe, expect, it } from "vitest";
import {
  compareTenantDirectoryName,
  formatDateString,
  formatPHP,
  formatReportTimestamp,
  formatTenantDirectoryName,
  getTenantInitials,
  matchesPath,
} from "../../src/lib/formatters";

describe("formatPHP", () => {
  it("formats numbers as PHP currency", () => {
    expect(formatPHP(1234.5)).toMatch(/PHP|₱/);
    expect(formatPHP(0)).toContain("0.00");
  });

  it("returns em dash for nullish or NaN", () => {
    expect(formatPHP(null)).toBe("—");
    expect(formatPHP(undefined)).toBe("—");
    expect(formatPHP(Number.NaN)).toBe("—");
  });
});

describe("formatDateString", () => {
  it("returns dash for empty or invalid input", () => {
    expect(formatDateString("")).toBe("-");
    expect(formatDateString(null)).toBe("-");
    expect(formatDateString("not-a-date")).toBe("-");
  });

  it("formats ISO date strings", () => {
    const out = formatDateString("2026-04-11");
    expect(out).not.toBe("-");
    expect(out.length).toBeGreaterThan(3);
  });
});

describe("formatTenantDirectoryName", () => {
  it("uses Last, First when both present", () => {
    expect(
      formatTenantDirectoryName({ first_name: "Juan", last_name: "Dela Cruz" })
    ).toBe("Dela Cruz, Juan");
  });

  it("returns single name or em dash", () => {
    expect(formatTenantDirectoryName({ first_name: "Madonna", last_name: "" })).toBe("Madonna");
    expect(formatTenantDirectoryName({ first_name: "", last_name: "Smith" })).toBe("Smith");
    expect(formatTenantDirectoryName({ first_name: "  ", last_name: "  " })).toBe("—");
  });
});

describe("getTenantInitials", () => {
  it("uses first letter of first and last name", () => {
    expect(getTenantInitials({ first_name: "Juan", last_name: "Dela Cruz" })).toBe("JD");
  });
});

describe("compareTenantDirectoryName", () => {
  it("sorts by last name then first", () => {
    const a = { first_name: "B", last_name: "Smith" };
    const b = { first_name: "A", last_name: "Smith" };
    expect(compareTenantDirectoryName(a, b)).toBeGreaterThan(0);
  });
});

describe("formatReportTimestamp", () => {
  it("returns a non-empty localized string", () => {
    const s = formatReportTimestamp();
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThan(5);
  });
});

describe("matchesPath", () => {
  it("matches /dashboard only exactly", () => {
    expect(matchesPath("/dashboard", "/dashboard")).toBe(true);
    expect(matchesPath("/dashboard/foo", "/dashboard")).toBe(false);
  });

  it("uses prefix match for other targets", () => {
    expect(matchesPath("/tenants/1", "/tenants")).toBe(true);
    expect(matchesPath("/rooms", "/tenants")).toBe(false);
  });
});
