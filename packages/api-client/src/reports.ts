import type { ApiClient } from "./http";

export type SalesReport = {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  bySource: Record<string, number>;
  byPayment: Record<string, number>;
  period: { from: string; to: string };
};

export function createReportsApi(client: ApiClient) {
  return {
    sales(outletId: string, from: string, to: string) {
      const params = new URLSearchParams({ outletId, from, to });
      return client.api<SalesReport>(`/reports/sales?${params.toString()}`);
    },
    salesDaily(outletId: string, from: string, to: string) {
      const params = new URLSearchParams({ outletId, from, to });
      return client.api<Array<{ date: string; revenue: number; orders: number }>>(
        `/reports/sales/daily?${params.toString()}`,
      );
    },
    topItems(outletId: string, from: string, to: string) {
      const params = new URLSearchParams({ outletId, from, to });
      return client.api<Array<{ name: string; quantity: number; revenue: number }>>(
        `/reports/items?${params.toString()}`,
      );
    },
    inventory(outletId: string) {
      return client.api<
        Array<{
          id: string;
          name: string;
          unit: string;
          currentStock: number;
          reorderLevel: number;
          isLowStock: boolean;
          value?: number;
        }>
      >(`/reports/inventory?outletId=${outletId}`);
    },
    reconciliation(outletId: string, from: string, to: string) {
      const params = new URLSearchParams({ outletId, from, to });
      return client.api<{
        totalCollected: number;
        byMethod: Record<string, number>;
        orderCount: number;
      }>(`/reports/reconciliation?${params.toString()}`);
    },
  };
}
