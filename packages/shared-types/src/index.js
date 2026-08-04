"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WS_CHANNELS = exports.SyncEventSchema = exports.PartnerSaveOrderSchema = exports.CreateReservationSchema = exports.SettleOrderSchema = exports.AddOrderItemSchema = exports.CreateOrderSchema = exports.CreateMenuItemSchema = exports.CreateUserSchema = exports.CreateOutletSchema = exports.CreateOrganizationSchema = exports.LoginSchema = void 0;
const zod_1 = require("zod");
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
exports.CreateOrganizationSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    slug: zod_1.z.string().min(2).regex(/^[a-z0-9-]+$/),
    gstin: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
});
exports.CreateOutletSchema = zod_1.z.object({
    brandId: zod_1.z.string(),
    name: zod_1.z.string().min(2),
    code: zod_1.z.string().min(2),
    type: zod_1.z.enum(["dine_in", "cloud_kitchen", "central_kitchen", "franchise"]),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    gstin: zod_1.z.string().optional(),
    zone: zod_1.z.string().optional(),
});
exports.CreateUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    role: zod_1.z.enum([
        "super_admin", "owner", "manager", "biller", "captain", "chef",
        "inventory_manager", "accountant",
    ]),
    outletId: zod_1.z.string().optional(),
});
exports.CreateMenuItemSchema = zod_1.z.object({
    categoryId: zod_1.z.string(),
    name: zod_1.z.string().min(1),
    nameHi: zod_1.z.string().optional(),
    basePrice: zod_1.z.number().positive(),
    kitchenStationId: zod_1.z.string().optional(),
    taxRuleId: zod_1.z.string().optional(),
    isVeg: zod_1.z.boolean().default(true),
    hsnCode: zod_1.z.string().optional(),
});
exports.CreateOrderSchema = zod_1.z.object({
    outletId: zod_1.z.string(),
    terminalId: zod_1.z.string().optional(),
    tableId: zod_1.z.string().optional(),
    customerId: zod_1.z.string().optional(),
    type: zod_1.z.enum(["dine_in", "takeaway", "delivery"]).default("dine_in"),
    source: zod_1.z.enum(["dine_in", "swiggy", "zomato", "website", "phone", "walk_in"]).default("dine_in"),
    guestCount: zod_1.z.number().int().positive().default(1),
    notes: zod_1.z.string().optional(),
});
exports.AddOrderItemSchema = zod_1.z.object({
    menuItemId: zod_1.z.string(),
    variantId: zod_1.z.string().optional(),
    quantity: zod_1.z.number().int().positive().default(1),
    notes: zod_1.z.string().optional(),
    addons: zod_1.z.array(zod_1.z.object({ addonId: zod_1.z.string(), name: zod_1.z.string(), price: zod_1.z.number() })).optional(),
});
exports.SettleOrderSchema = zod_1.z.object({
    payments: zod_1.z.array(zod_1.z.object({
        method: zod_1.z.enum(["cash", "upi", "card", "wallet", "split"]),
        amount: zod_1.z.number().positive(),
        reference: zod_1.z.string().optional(),
    })),
    discountAmount: zod_1.z.number().min(0).default(0),
    loyaltyPointsUsed: zod_1.z.number().int().min(0).default(0),
    customerPhone: zod_1.z.string().optional(),
});
exports.CreateReservationSchema = zod_1.z.object({
    outletId: zod_1.z.string(),
    guestName: zod_1.z.string().min(1),
    guestPhone: zod_1.z.string().min(10),
    guestCount: zod_1.z.number().int().positive(),
    date: zod_1.z.string().datetime(),
    source: zod_1.z.enum(["walk_in", "phone", "website", "zomato_dining", "eazydiner", "district"]).default("walk_in"),
    notes: zod_1.z.string().optional(),
});
exports.PartnerSaveOrderSchema = zod_1.z.object({
    restId: zod_1.z.string(),
    externalOrderId: zod_1.z.string(),
    source: zod_1.z.enum(["swiggy", "zomato", "website"]),
    items: zod_1.z.array(zod_1.z.object({
        itemId: zod_1.z.string(),
        name: zod_1.z.string(),
        quantity: zod_1.z.number().int().positive(),
        unitPrice: zod_1.z.number().positive(),
        notes: zod_1.z.string().optional(),
    })),
    customer: zod_1.z.object({
        name: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
    }).optional(),
    type: zod_1.z.enum(["delivery", "takeaway"]).default("delivery"),
});
exports.SyncEventSchema = zod_1.z.object({
    clientId: zod_1.z.string(),
    entityType: zod_1.z.string(),
    entityId: zod_1.z.string(),
    action: zod_1.z.string(),
    payload: zod_1.z.record(zod_1.z.unknown()),
});
exports.WS_CHANNELS = {
    outletOrders: (outletId) => `outlet:${outletId}:orders`,
    stationKots: (stationId) => `station:${stationId}:kots`,
    terminalSync: (terminalId) => `terminal:${terminalId}:sync`,
};
//# sourceMappingURL=index.js.map