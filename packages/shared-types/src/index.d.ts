import { z } from "zod";
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const CreateOrganizationSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodString;
    gstin: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    slug: string;
    gstin?: string | undefined;
    phone?: string | undefined;
    email?: string | undefined;
}, {
    name: string;
    slug: string;
    gstin?: string | undefined;
    phone?: string | undefined;
    email?: string | undefined;
}>;
export declare const CreateOutletSchema: z.ZodObject<{
    brandId: z.ZodString;
    name: z.ZodString;
    code: z.ZodString;
    type: z.ZodEnum<["dine_in", "cloud_kitchen", "central_kitchen", "franchise"]>;
    address: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    gstin: z.ZodOptional<z.ZodString>;
    zone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    code: string;
    type: "dine_in" | "cloud_kitchen" | "central_kitchen" | "franchise";
    brandId: string;
    gstin?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    zone?: string | undefined;
}, {
    name: string;
    code: string;
    type: "dine_in" | "cloud_kitchen" | "central_kitchen" | "franchise";
    brandId: string;
    gstin?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    zone?: string | undefined;
}>;
export declare const CreateUserSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    role: z.ZodEnum<["super_admin", "owner", "manager", "biller", "captain", "chef", "inventory_manager", "accountant"]>;
    outletId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    firstName: string;
    role: "super_admin" | "owner" | "manager" | "biller" | "captain" | "chef" | "inventory_manager" | "accountant";
    password: string;
    phone?: string | undefined;
    lastName?: string | undefined;
    outletId?: string | undefined;
}, {
    email: string;
    firstName: string;
    role: "super_admin" | "owner" | "manager" | "biller" | "captain" | "chef" | "inventory_manager" | "accountant";
    password: string;
    phone?: string | undefined;
    lastName?: string | undefined;
    outletId?: string | undefined;
}>;
export declare const CreateMenuItemSchema: z.ZodObject<{
    categoryId: z.ZodString;
    name: z.ZodString;
    nameHi: z.ZodOptional<z.ZodString>;
    basePrice: z.ZodNumber;
    kitchenStationId: z.ZodOptional<z.ZodString>;
    taxRuleId: z.ZodOptional<z.ZodString>;
    isVeg: z.ZodDefault<z.ZodBoolean>;
    hsnCode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    categoryId: string;
    basePrice: number;
    isVeg: boolean;
    nameHi?: string | undefined;
    kitchenStationId?: string | undefined;
    taxRuleId?: string | undefined;
    hsnCode?: string | undefined;
}, {
    name: string;
    categoryId: string;
    basePrice: number;
    nameHi?: string | undefined;
    kitchenStationId?: string | undefined;
    taxRuleId?: string | undefined;
    isVeg?: boolean | undefined;
    hsnCode?: string | undefined;
}>;
export declare const CreateOrderSchema: z.ZodObject<{
    outletId: z.ZodString;
    terminalId: z.ZodOptional<z.ZodString>;
    tableId: z.ZodOptional<z.ZodString>;
    customerId: z.ZodOptional<z.ZodString>;
    type: z.ZodDefault<z.ZodEnum<["dine_in", "takeaway", "delivery"]>>;
    source: z.ZodDefault<z.ZodEnum<["dine_in", "swiggy", "zomato", "website", "phone", "walk_in"]>>;
    guestCount: z.ZodDefault<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    outletId: string;
    type: "dine_in" | "takeaway" | "delivery";
    source: "phone" | "dine_in" | "swiggy" | "zomato" | "website" | "walk_in";
    guestCount: number;
    terminalId?: string | undefined;
    tableId?: string | undefined;
    customerId?: string | undefined;
    notes?: string | undefined;
}, {
    outletId: string;
    terminalId?: string | undefined;
    type?: "dine_in" | "takeaway" | "delivery" | undefined;
    tableId?: string | undefined;
    customerId?: string | undefined;
    source?: "phone" | "dine_in" | "swiggy" | "zomato" | "website" | "walk_in" | undefined;
    guestCount?: number | undefined;
    notes?: string | undefined;
}>;
export declare const AddOrderItemSchema: z.ZodObject<{
    menuItemId: z.ZodString;
    variantId: z.ZodOptional<z.ZodString>;
    quantity: z.ZodDefault<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
    addons: z.ZodOptional<z.ZodArray<z.ZodObject<{
        addonId: z.ZodString;
        name: z.ZodString;
        price: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        addonId: string;
        price: number;
    }, {
        name: string;
        addonId: string;
        price: number;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    menuItemId: string;
    quantity: number;
    notes?: string | undefined;
    variantId?: string | undefined;
    addons?: {
        name: string;
        addonId: string;
        price: number;
    }[] | undefined;
}, {
    menuItemId: string;
    notes?: string | undefined;
    variantId?: string | undefined;
    quantity?: number | undefined;
    addons?: {
        name: string;
        addonId: string;
        price: number;
    }[] | undefined;
}>;
export declare const SettleOrderSchema: z.ZodObject<{
    payments: z.ZodArray<z.ZodObject<{
        method: z.ZodEnum<["cash", "upi", "card", "wallet", "split"]>;
        amount: z.ZodNumber;
        reference: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        method: "split" | "cash" | "upi" | "card" | "wallet";
        amount: number;
        reference?: string | undefined;
    }, {
        method: "split" | "cash" | "upi" | "card" | "wallet";
        amount: number;
        reference?: string | undefined;
    }>, "many">;
    discountAmount: z.ZodDefault<z.ZodNumber>;
    loyaltyPointsUsed: z.ZodDefault<z.ZodNumber>;
    customerPhone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    payments: {
        method: "split" | "cash" | "upi" | "card" | "wallet";
        amount: number;
        reference?: string | undefined;
    }[];
    discountAmount: number;
    loyaltyPointsUsed: number;
    customerPhone?: string | undefined;
}, {
    payments: {
        method: "split" | "cash" | "upi" | "card" | "wallet";
        amount: number;
        reference?: string | undefined;
    }[];
    discountAmount?: number | undefined;
    loyaltyPointsUsed?: number | undefined;
    customerPhone?: string | undefined;
}>;
export declare const CreateReservationSchema: z.ZodObject<{
    outletId: z.ZodString;
    guestName: z.ZodString;
    guestPhone: z.ZodString;
    guestCount: z.ZodNumber;
    date: z.ZodString;
    source: z.ZodDefault<z.ZodEnum<["walk_in", "phone", "website", "zomato_dining", "eazydiner", "district"]>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    outletId: string;
    date: string;
    source: "phone" | "website" | "walk_in" | "zomato_dining" | "eazydiner" | "district";
    guestCount: number;
    guestName: string;
    guestPhone: string;
    notes?: string | undefined;
}, {
    outletId: string;
    date: string;
    guestCount: number;
    guestName: string;
    guestPhone: string;
    source?: "phone" | "website" | "walk_in" | "zomato_dining" | "eazydiner" | "district" | undefined;
    notes?: string | undefined;
}>;
export declare const PartnerSaveOrderSchema: z.ZodObject<{
    restId: z.ZodString;
    externalOrderId: z.ZodString;
    source: z.ZodEnum<["swiggy", "zomato", "website"]>;
    items: z.ZodArray<z.ZodObject<{
        itemId: z.ZodString;
        name: z.ZodString;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        quantity: number;
        itemId: string;
        unitPrice: number;
        notes?: string | undefined;
    }, {
        name: string;
        quantity: number;
        itemId: string;
        unitPrice: number;
        notes?: string | undefined;
    }>, "many">;
    customer: z.ZodOptional<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        phone?: string | undefined;
    }, {
        name?: string | undefined;
        phone?: string | undefined;
    }>>;
    type: z.ZodDefault<z.ZodEnum<["delivery", "takeaway"]>>;
}, "strip", z.ZodTypeAny, {
    type: "takeaway" | "delivery";
    source: "swiggy" | "zomato" | "website";
    restId: string;
    externalOrderId: string;
    items: {
        name: string;
        quantity: number;
        itemId: string;
        unitPrice: number;
        notes?: string | undefined;
    }[];
    customer?: {
        name?: string | undefined;
        phone?: string | undefined;
    } | undefined;
}, {
    source: "swiggy" | "zomato" | "website";
    restId: string;
    externalOrderId: string;
    items: {
        name: string;
        quantity: number;
        itemId: string;
        unitPrice: number;
        notes?: string | undefined;
    }[];
    customer?: {
        name?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    type?: "takeaway" | "delivery" | undefined;
}>;
export declare const SyncEventSchema: z.ZodObject<{
    clientId: z.ZodString;
    entityType: z.ZodString;
    entityId: z.ZodString;
    action: z.ZodString;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    action: string;
    entityType: string;
    entityId: string;
    clientId: string;
    payload: Record<string, unknown>;
}, {
    action: string;
    entityType: string;
    entityId: string;
    clientId: string;
    payload: Record<string, unknown>;
}>;
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
export declare const WS_CHANNELS: {
    readonly outletOrders: (outletId: string) => string;
    readonly stationKots: (stationId: string) => string;
    readonly terminalSync: (terminalId: string) => string;
};
