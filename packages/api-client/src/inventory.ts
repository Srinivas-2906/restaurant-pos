import type { ApiClient } from "./http";

export type InventoryDashboard = {
  totalValue: number;
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  lowStockItems: Array<{
    id: string;
    name: string;
    currentStock: number;
    available: number;
    reorderLevel: number;
    unit: string;
  }>;
};

export type IngredientRow = {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  reorderLevel?: number;
  category?: { name?: string } | null;
};

export type PurchaseOrderRow = {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number | string;
  createdAt: string;
  supplier?: { id: string; name: string };
  items?: Array<{
    id: string;
    quantity: number | string;
    unitPrice: number | string;
    ingredient?: { id: string; name: string; unit: string };
  }>;
};

export function createInventoryApi(client: ApiClient) {
  return {
    dashboard(outletId: string) {
      return client.api<InventoryDashboard>(`/inventory/outlets/${outletId}/stock-summary`);
    },
    ingredients(outletId: string) {
      return client.api<IngredientRow[]>(`/inventory/outlets/${outletId}/ingredients`);
    },
    stockLedger(outletId: string, ingredientId?: string, limit = 20) {
      const params = new URLSearchParams({ limit: String(limit) });
      if (ingredientId) params.set("ingredientId", ingredientId);
      return client.api<
        Array<{
          id: string;
          type: string;
          quantity: number | string;
          notes?: string | null;
          createdAt: string;
          ingredient?: { name: string; unit: string };
        }>
      >(`/inventory/outlets/${outletId}/stock-ledger?${params.toString()}`);
    },
    adjustStock(
      outletId: string,
      payload: { ingredientId: string; quantity: number; notes?: string; reason: string },
    ) {
      return client.api(`/inventory/outlets/${outletId}/stock-adjustments`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    recordWastage(
      outletId: string,
      payload: { ingredientId: string; quantity: number; notes?: string; reason?: string },
    ) {
      return client.api(`/inventory/outlets/${outletId}/wastage`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    suppliers(outletId: string) {
      return client.api<Array<{ id: string; name: string }>>(
        `/inventory/outlets/${outletId}/suppliers`,
      );
    },
    purchaseOrders(outletId: string) {
      return client.api<PurchaseOrderRow[]>(`/inventory/outlets/${outletId}/purchase-orders`);
    },
    createPurchaseOrder(
      outletId: string,
      payload: {
        supplierId: string;
        items: Array<{ ingredientId: string; quantity: number; unitPrice: number }>;
        notes?: string;
      },
    ) {
      return client.api<PurchaseOrderRow>(`/inventory/outlets/${outletId}/purchase-orders`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    receivePurchaseOrder(
      poId: string,
      lines?: Array<{ poItemId: string; receivedQty: number }>,
    ) {
      return client.api(`/inventory/purchase-orders/${poId}/receive`, {
        method: "POST",
        body: JSON.stringify(lines ? { lines } : {}),
      });
    },
  };
}
