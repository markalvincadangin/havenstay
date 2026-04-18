import { describe, expect, it } from "vitest";
import {
  formatAuditEntityIdDisplay,
  formatAuditEntityOrResource,
} from "../../src/lib/constants";

describe("formatAuditEntityOrResource", () => {
  it("maps known permission keys from backend logAccessDenied", () => {
    expect(formatAuditEntityOrResource("audit_logs.list")).toBe("Audit trail (list)");
    expect(formatAuditEntityOrResource("reports.billingSummary")).toBe("Report: Billing summary");
  });

  it("maps DB table names via AUDIT_ENTITY_LABELS", () => {
    expect(formatAuditEntityOrResource("tenants")).toBe("Tenants");
  });

  it("humanizes unknown dotted keys", () => {
    expect(formatAuditEntityOrResource("some.new_resource")).toBe("Some New Resource");
  });
});

describe("formatAuditEntityIdDisplay", () => {
  it("hides sentinel denied for access_denied rows", () => {
    expect(formatAuditEntityIdDisplay("denied", "access_denied")).toBe("—");
  });

  it("shows real ids for data changes", () => {
    expect(formatAuditEntityIdDisplay("42", "update")).toBe("42");
  });
});
