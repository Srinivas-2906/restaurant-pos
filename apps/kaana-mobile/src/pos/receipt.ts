import type { OrderDetail } from "@kaana/api-client";
import { money } from "./types";

export type ReceiptData = {
  restaurantName: string;
  outletName: string;
  billNumber: string;
  dateTime: string;
  orderType: string;
  tableNumber?: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; total: number }>;
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  paymentMethod?: string;
  paymentAmount?: number;
};

export function buildReceiptData(
  order: OrderDetail,
  meta: { restaurantName: string; outletName: string; paymentMethod?: string; paymentAmount?: number },
): ReceiptData {
  return {
    restaurantName: meta.restaurantName,
    outletName: meta.outletName,
    billNumber: String(order.orderNumber),
    dateTime: order.settledAt ?? order.createdAt ?? new Date().toISOString(),
    orderType: order.type ?? "takeaway",
    tableNumber: order.table?.number,
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: money(item.unitPrice),
      total: money(item.totalPrice),
    })),
    subtotal: money(order.subtotal),
    discount: money(order.discountAmount),
    taxAmount: money(order.taxAmount),
    total: money(order.totalAmount),
    paymentMethod: meta.paymentMethod,
    paymentAmount: meta.paymentAmount,
  };
}
