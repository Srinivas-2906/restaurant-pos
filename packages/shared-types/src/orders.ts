export type BillingMode = "cashier_settles" | "captain_can_settle";

export type FulfilmentType = "restaurant" | "aggregator" | "customer_pickup";

export type OrderSource =
  | "dine_in"
  | "pos"
  | "captain"
  | "qr"
  | "swiggy"
  | "zomato"
  | "ondc"
  | "website"
  | "phone"
  | "walk_in";

export type OrderType = "dine_in" | "takeaway" | "delivery";

export function inferFulfilment(
  type: OrderType,
  source: OrderSource,
): FulfilmentType | undefined {
  if (type === "delivery" && (source === "swiggy" || source === "zomato" || source === "ondc")) {
    return "aggregator";
  }
  if (type === "takeaway" && (source === "walk_in" || source === "pos" || source === "captain")) {
    return "customer_pickup";
  }
  if (type === "delivery" && (source === "phone" || source === "website" || source === "pos")) {
    return "restaurant";
  }
  return undefined;
}

export function getOutletBillingMode(settings: unknown): BillingMode {
  if (settings && typeof settings === "object" && "billingMode" in settings) {
    const mode = (settings as { billingMode?: string }).billingMode;
    if (mode === "captain_can_settle") return "captain_can_settle";
  }
  return "cashier_settles";
}

export interface OrderItemDto {
  id: string;
  name: string;
  quantity: number;
  status: string;
  unitPrice: number | string;
  totalPrice: number | string;
  kotId?: string | null;
  notes?: string | null;
}

export interface KotDto {
  id: string;
  kotNumber: string;
  status: string;
  kitchenStation?: { id: string; name: string; code: string };
}

export interface OrderDto {
  id: string;
  orderNumber: string;
  outletId: string;
  tableId?: string | null;
  type: OrderType;
  source: OrderSource;
  fulfilment?: FulfilmentType | null;
  status: string;
  guestCount: number;
  subtotal: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  billRequestedAt?: string | null;
  items: OrderItemDto[];
  kots?: KotDto[];
  table?: { id: string; number: string; status?: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string | null } | null;
}

export interface LiveOrdersSummary {
  total: number;
  buckets: {
    dineIn: number;
    takeaway: number;
    ownDelivery: number;
    swiggy: number;
    zomato: number;
    other: number;
  };
  orders: Array<{
    id: string;
    orderNumber: string;
    type: OrderType;
    source: OrderSource;
    status: string;
    totalAmount: number | string;
    tableNumber?: string | null;
    itemCount: number;
    billRequestedAt?: string | null;
  }>;
}
