export interface TableActiveOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number | string;
  itemCount: number;
  itemQty: number;
  pendingKot: number;
  inKitchen: number;
  readyCount?: number;
  servedCount?: number;
  allReady?: boolean;
  allServed?: boolean;
  kotCount: number;
  createdAt: string;
  elapsedMins: number;
}

export interface TableReservationSummary {
  id: string;
  guestName: string;
  guestCount: number;
  date: string;
  status: string;
}

export interface Table {
  id: string;
  number: string;
  status: string;
  capacity: number;
  activeOrder?: TableActiveOrder | null;
  activeReservation?: TableReservationSummary | null;
  upcomingReservation?: TableReservationSummary | null;
}

export type TableWithOrder = Table & { activeOrder: TableActiveOrder | null };

export interface MenuItem {
  id: string;
  name: string;
  nameHi?: string | null;
  price: number | string;
  basePrice?: number | string;
  isAvailable: boolean;
  isVeg: boolean;
}

export interface Category {
  id: string;
  name: string;
  nameHi?: string | null;
  items: MenuItem[];
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number | string;
  taxAmount: number | string;
  totalPrice: number | string;
  status: string;
  kotId?: string | null;
  menuItemId: string;
}

export type OrderSource =
  | "dine_in"
  | "swiggy"
  | "zomato"
  | "website"
  | "phone"
  | "walk_in";

export type OrderType = "dine_in" | "takeaway" | "delivery";

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  type?: OrderType;
  source?: OrderSource;
  externalOrderId?: string | null;
  notes?: string | null;
  aggregatorData?: Record<string, unknown> | null;
  subtotal: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  guestCount?: number;
  createdAt?: string;
  items: OrderItem[];
  table?: Table | null;
  kots?: Array<{ id: string; kotNumber: string; status: string }>;
}

export interface FloorPlan {
  id: string;
  name: string;
  tables: TableWithOrder[];
}

export function money(value: number | string | undefined): number {
  return Number(value ?? 0);
}

export function formatInr(value: number | string | undefined): string {
  return `₹${money(value).toFixed(0)}`;
}

export function itemPrice(item: MenuItem): number {
  return money(item.price ?? item.basePrice);
}
