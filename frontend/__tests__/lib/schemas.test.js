import { describe, expect, it } from "vitest";
import { BillingSummarySchema, RoomSchema, TenantSchema } from "../../src/lib/schemas";

describe("TenantSchema", () => {
  it("accepts schema-aligned tenant payload", () => {
    const parsed = TenantSchema.safeParse({
      tenant_id: 1,
      first_name: "Ana",
      last_name: "Reyes",
      contact_number: "+639123456789",
      email: "ana@example.com",
      status: "archived",
      created_at: "2026-01-01T00:00:00.000000Z",
      updated_at: "2026-01-02T00:00:00.000000Z",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid tenant status", () => {
    const parsed = TenantSchema.safeParse({
      tenant_id: 1,
      first_name: "Ana",
      last_name: "Reyes",
      contact_number: "09",
      status: "inactive",
      created_at: "2026-01-01T00:00:00.000000Z",
      updated_at: "2026-01-02T00:00:00.000000Z",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("RoomSchema", () => {
  it("accepts vacant room status (rooms.status ENUM)", () => {
    const parsed = RoomSchema.safeParse({
      room_id: 2,
      room_code: "A-101",
      room_type: "shared",
      capacity: 2,
      monthly_rate: 4500,
      status: "vacant",
      created_at: "2026-01-01T00:00:00.000000Z",
      updated_at: "2026-01-02T00:00:00.000000Z",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unavailable as room status", () => {
    const parsed = RoomSchema.safeParse({
      room_id: 2,
      room_code: "A-101",
      room_type: "solo",
      capacity: 1,
      monthly_rate: 4000,
      status: "unavailable",
      created_at: "2026-01-01T00:00:00.000000Z",
      updated_at: "2026-01-02T00:00:00.000000Z",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("BillingSummarySchema", () => {
  it("accepts partial billing_status", () => {
    const parsed = BillingSummarySchema.safeParse({
      billing_id: 9,
      billing_period_from: "2026-04-01",
      billing_period_to: "2026-04-30",
      due_date: "2026-05-05",
      billing_status: "partial",
      tenant_name: "Test",
      room_code: "B-2",
      amount_due: 5000,
      amount_paid: 2000,
    });
    expect(parsed.success).toBe(true);
  });
});
