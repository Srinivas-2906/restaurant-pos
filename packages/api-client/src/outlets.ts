import type { ApiClient } from "./http";

export type FloorTable = {
  id: string;
  number: string;
  status: string;
  capacity: number;
  activeOrder?: {
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
    kotCount: number;
    createdAt: string;
    elapsedMins: number;
  } | null;
};

export type FloorPlan = {
  id: string;
  name: string;
  tables: FloorTable[];
};

export function createOutletsApi(client: ApiClient) {
  return {
    getFloor(outletId: string) {
      return client.api<FloorPlan>(`/outlets/${outletId}/floor`);
    },
  };
}
