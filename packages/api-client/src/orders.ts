import type { ApiClient } from "./http";
import type { AddOrderItemDto, CreateOrderDto, SettleOrderDto } from "@kaana/shared-types";

export type OrderItemRow = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number | string;
  taxAmount: number | string;
  totalPrice: number | string;
  status: string;
  kotId?: string | null;
  menuItemId: string;
  notes?: string | null;
};

export type OrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  type?: string;
  source?: string;
  notes?: string | null;
  subtotal: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  discountAmount?: number | string;
  guestCount?: number;
  createdAt?: string;
  settledAt?: string | null;
  items: OrderItemRow[];
  table?: { id: string; number: string; status?: string } | null;
  kots?: Array<{ id: string; kotNumber: string; status: string }>;
  payments?: Array<{ id: string; method: string; amount: number | string }>;
};

export type OrderSummary = {
  id: string;
  orderNumber?: number | string;
  status: string;
  type?: string;
  source?: string;
  totalAmount?: number | string;
  createdAt?: string;
  settledAt?: string;
  table?: { number?: string } | null;
  items?: Array<{ id: string; quantity?: number }>;
  payments?: Array<{ method?: string; amount?: number | string }>;
};

export type SettleResult = {
  order: OrderDetail;
  invoice?: { invoiceNumber: string; totalAmount?: number | string };
};

export function createOrdersApi(client: ApiClient) {
  return {
    list(outletId: string, filters?: { status?: string; type?: string }) {
      const params = new URLSearchParams({ outletId });
      if (filters?.status) params.set("status", filters.status);
      if (filters?.type) params.set("type", filters.type);
      return client.api<OrderSummary[]>(`/orders?${params.toString()}`);
    },
    getLive(outletId: string) {
      return client.api<{
        total: number;
        buckets: Record<string, number>;
        orders: Array<{
          id: string;
          orderNumber?: number | string;
          type?: string;
          source?: string;
          status: string;
          totalAmount?: number;
          tableNumber?: string;
          itemCount?: number;
        }>;
      }>(`/orders/live?outletId=${outletId}`);
    },
    getOne(orderId: string) {
      return client.api<OrderDetail>(`/orders/${orderId}`);
    },
    openByTable(outletId: string, tableId: string) {
      return client.api<OrderDetail>(
        `/orders/open/by-table?outletId=${outletId}&tableId=${tableId}`,
      );
    },
    create(body: CreateOrderDto & { terminalId?: string }) {
      return client.api<OrderDetail>("/orders", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    addItem(orderId: string, body: AddOrderItemDto) {
      return client.api<OrderDetail>(`/orders/${orderId}/items`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    updateItemQuantity(orderId: string, itemId: string, quantity: number) {
      return client.api<OrderDetail>(`/orders/${orderId}/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity }),
      });
    },
    removeItem(orderId: string, itemId: string) {
      return client.api<OrderDetail>(`/orders/${orderId}/items/${itemId}`, {
        method: "DELETE",
      });
    },
    fireKot(orderId: string) {
      return client.api<OrderDetail>(`/orders/${orderId}/kot`, { method: "POST" });
    },
    requestBill(orderId: string) {
      return client.api<OrderDetail>(`/orders/${orderId}/request-bill`, { method: "POST" });
    },
    printBill(orderId: string) {
      return client.api<OrderDetail>(`/orders/${orderId}/print-bill`, { method: "POST" });
    },
    settle(orderId: string, body: SettleOrderDto & { idempotencyKey?: string }) {
      return client.api<SettleResult>(`/orders/${orderId}/settle`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    cancel(orderId: string, reason?: string) {
      return client.api<OrderDetail>(`/orders/${orderId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },
    markItemServed(orderId: string, itemId: string) {
      return client.api<OrderDetail>(`/orders/${orderId}/items/${itemId}/served`, {
        method: "PATCH",
      });
    },
  };
}
