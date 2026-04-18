import { z } from "zod";

/**
 * Common schema for primary IDs following the <entity>_id convention.
 */
export const IdSchema = z.number().int().positive();

/**
 * Tenant Schema (aligned with havenstay_schema tenants.status)
 */
export const TenantSchema = z.object({
  tenant_id: IdSchema,
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  contact_number: z.string().max(20),
  email: z.string().email().nullable().optional(),
  status: z.enum(["active", "moved_out", "archived"]),
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * Room Schema
 */
export const RoomSchema = z.object({
  room_id: IdSchema,
  room_code: z.string().max(20),
  room_type: z.enum(["solo", "shared"]),
  capacity: z.number().int().min(1),
  monthly_rate: z.number().positive(),
  status: z.enum(["vacant", "partially_occupied", "fully_occupied", "maintenance"]),
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * Billing Summary Schema (matched to vw_billing_summary billing_status)
 */
export const BillingSummarySchema = z.object({
  billing_id: IdSchema,
  billing_period_from: z.string(),
  billing_period_to: z.string(),
  due_date: z.string(),
  billing_status: z.enum(["unpaid", "partial", "paid", "overdue"]),
  tenant_name: z.string(),
  room_code: z.string(),
  amount_due: z.number().optional(), // some endpoints might use amount_due
  total_amount: z.number().optional(),
  amount_paid: z.number(),
});
