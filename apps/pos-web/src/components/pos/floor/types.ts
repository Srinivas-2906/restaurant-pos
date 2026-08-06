export interface TableActiveOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number | string;
  itemCount: number;
  itemQty: number;
  pendingKot: number;
  inKitchen: number;
  kotCount: number;
  createdAt: string;
  elapsedMins: number;
}

export interface Table {
  id: string;
  number: string;
  status: string;
  capacity: number;
  activeOrder?: TableActiveOrder | null;
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

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  guestCount?: number;
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
