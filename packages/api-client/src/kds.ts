import type { ApiClient } from "./http";

export type KdsQueueKotItem = {
  id: string;
  quantity: number;
  status: string;
  orderItem: { id: string; name: string; notes?: string | null };
};

export type KdsQueueKot = {
  id: string;
  kotNumber: string;
  status: string;
  firedAt: string;
  readyAt?: string | null;
  notes?: string | null;
  kitchenStation: { id: string; name: string; code: string };
  order: {
    id: string;
    orderNumber: string;
    type?: string;
    source?: string;
    table?: { id: string; number: string } | null;
  };
  items: KdsQueueKotItem[];
};

export function createKdsApi(client: ApiClient) {
  return {
    getOutletQueue(outletId: string) {
      return client.api<KdsQueueKot[]>(`/kds/outlets/${outletId}/queue`);
    },
    getStationQueue(stationId: string) {
      return client.api<KdsQueueKot[]>(`/kds/stations/${stationId}/queue`);
    },
    markPreparing(kotId: string) {
      return client.api<KdsQueueKot>(`/kds/kot/${kotId}/preparing`, { method: "PATCH" });
    },
    markReady(kotId: string) {
      return client.api<KdsQueueKot>(`/kds/kot/${kotId}/ready`, { method: "PATCH" });
    },
  };
}
