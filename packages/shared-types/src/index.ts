import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  gstin: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export const CreateOutletSchema = z.object({
  brandId: z.string(),
  name: z.string().min(2),
  code: z.string().min(2),
  type: z.enum(["dine_in", "cloud_kitchen", "central_kitchen", "franchise"]),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  gstin: z.string().optional(),
  zone: z.string().optional(),
});

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum([
    "super_admin", "owner", "manager", "biller", "captain", "chef",
    "inventory_manager", "accountant",
  ]),
  outletId: z.string().optional(),
});

export const CreateMenuItemSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1),
  nameHi: z.string().optional(),
  basePrice: z.number().positive(),
  kitchenStationId: z.string().optional(),
  taxRuleId: z.string().optional(),
  isVeg: z.boolean().default(true),
  hsnCode: z.string().optional(),
});

export const CreateOrderSchema = z.object({
  outletId: z.string(),
  terminalId: z.string().optional(),
  tableId: z.string().optional(),
  customerId: z.string().optional(),
  type: z.enum(["dine_in", "takeaway", "delivery"]).default("dine_in"),
  source: z.enum(["dine_in", "swiggy", "zomato", "website", "phone", "walk_in"]).default("dine_in"),
  guestCount: z.number().int().positive().default(1),
  notes: z.string().optional(),
});

export const AddOrderItemSchema = z.object({
  menuItemId: z.string(),
  variantId: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  notes: z.string().optional(),
  addons: z.array(z.object({ addonId: z.string(), name: z.string(), price: z.number() })).optional(),
});

export const SettleOrderSchema = z.object({
  payments: z.array(z.object({
    method: z.enum(["cash", "upi", "card", "wallet", "split"]),
    amount: z.number().positive(),
    reference: z.string().optional(),
  })),
  discountAmount: z.number().min(0).default(0),
  loyaltyPointsUsed: z.number().int().min(0).default(0),
  customerPhone: z.string().optional(),
});

export const CreateReservationSchema = z.object({
  outletId: z.string(),
  guestName: z.string().min(1),
  guestPhone: z.string().min(10),
  guestCount: z.number().int().positive(),
  date: z.string().datetime(),
  source: z.enum(["walk_in", "phone", "website", "zomato_dining", "eazydiner", "district"]).default("walk_in"),
  notes: z.string().optional(),
});

export const PartnerSaveOrderSchema = z.object({
  restId: z.string(),
  externalOrderId: z.string(),
  source: z.enum(["swiggy", "zomato", "website"]),
  items: z.array(z.object({
    itemId: z.string(),
    name: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
    notes: z.string().optional(),
  })),
  customer: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
  type: z.enum(["delivery", "takeaway"]).default("delivery"),
});

export const SyncEventSchema = z.object({
  clientId: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  action: z.string(),
  payload: z.record(z.unknown()),
});

export type LoginDto = z.infer<typeof LoginSchema>;
export type CreateOrganizationDto = z.infer<typeof CreateOrganizationSchema>;
export type CreateOutletDto = z.infer<typeof CreateOutletSchema>;
export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;
export type AddOrderItemDto = z.infer<typeof AddOrderItemSchema>;
export type SettleOrderDto = z.infer<typeof SettleOrderSchema>;
export type PartnerSaveOrderDto = z.infer<typeof PartnerSaveOrderSchema>;

export interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string;
  outletId?: string;
  role?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export const WS_CHANNELS = {
  outletOrders: (outletId: string) => `outlet:${outletId}:orders`,
  stationKots: (stationId: string) => `station:${stationId}:kots`,
  terminalSync: (terminalId: string) => `terminal:${terminalId}:sync`,
} as const;
