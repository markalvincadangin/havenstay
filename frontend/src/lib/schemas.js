import { z } from 'zod';

export const TenantStatusEnum = z.enum([
  'active',
  'moving_out',
  'moved_out',
  'archived',
  'blacklisted',
]);

export const TenantSchema = z.object({
  tenant_id: z.number().int().positive().optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  contact_number: z.string().min(7),
  email: z.string().email().optional().nullable(),
  status: TenantStatusEnum,
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const RoomStatusEnum = z.enum([
  'vacant',
  'partially_occupied',
  'fully_occupied',
  'maintenance',
  'archived',
]);

export const RoomTypeEnum = z.enum(['shared', 'solo']);

export const RoomSchema = z.object({
  room_id: z.number().int().positive().optional(),
  room_code: z.string().min(1),
  room_type: RoomTypeEnum,
  capacity: z.number().int().positive(),
  monthly_rate: z.number().nonnegative(),
  status: RoomStatusEnum,
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const BillingStatusEnum = z.enum([
  'pending',
  'partial',
  'paid',
  'overdue',
  'cancelled',
]);

export const BillingSummarySchema = z.object({
  billing_id: z.number().int().positive().optional(),
  billing_period_from: z.string(),
  billing_period_to: z.string(),
  due_date: z.string(),
  billing_status: BillingStatusEnum,
  tenant_name: z.string().optional(),
  room_code: z.string().optional(),
  amount_due: z.number().nonnegative(),
  amount_paid: z.number().nonnegative(),
});
