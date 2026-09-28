import type { MenuCategory, OrderDetail } from "@kaana/api-client";

export type PosAuthMode = "management" | "operational";

export type PosOrderType = "dine_in" | "takeaway" | "delivery";

export type PosMenuCategory = MenuCategory;

export type PosOrder = OrderDetail;

export const ACTIVE_ORDER_STATUSES = new Set([
  "draft",
  "open",
  "kot_fired",
  "preparing",
  "ready",
  "served",
  "billed",
]);

export function money(value: number | string | undefined | null): number {
  return Number(value ?? 0);
}

export function itemUnitPrice(item: { unitPrice?: number | string; price?: number | string }): number {
  return money(item.unitPrice ?? item.price);
}

export function menuItemPrice(item: { basePrice?: number | string; price?: number | string }): number {
  return money(item.price ?? item.basePrice);
}

export function pendingItems(order: PosOrder) {
  return order.items.filter((item) => item.status === "pending" && !item.kotId);
}

export function canModifyItem(item: { status: string; kotId?: string | null }) {
  return item.status === "pending" && !item.kotId;
}

export function orderIsSettled(order: PosOrder) {
  return order.status === "settled" || order.status === "cancelled" || order.status === "voided";
}
