export type SyncEntityType =
  | "order"
  | "order_item"
  | "payment"
  | "kot"
  | "table"
  | "menu_availability"
  | "stock_ledger"
  | "device_heartbeat";

export type SyncAction = "create" | "update" | "delete";

export interface SyncEventEnvelope {
  id: string;
  idempotencyKey: string;
  outletId: string;
  deviceId: string;
  entityType: SyncEntityType;
  entityId: string;
  action: SyncAction;
  payload: Record<string, unknown>;
  clientTimestamp: string;
  sequence: number;
}

export interface SyncBatchRequest {
  outletId: string;
  hubId: string;
  events: SyncEventEnvelope[];
  lastAckSequence?: number;
}

export interface SyncBatchResponse {
  accepted: string[];
  rejected: Array<{ id: string; reason: string }>;
  lastAckSequence: number;
  cloudMappings?: Record<string, string>;
}

export interface DeviceRegistration {
  deviceId: string;
  outletId: string;
  terminalId?: string;
  role: string;
  deviceType: "pos" | "kds" | "captain" | "customer_display" | "hub";
  name: string;
  lanAddress?: string;
}

export interface DeviceHeartbeat {
  deviceId: string;
  outletId: string;
  status: "online" | "offline" | "degraded";
  syncBacklog: number;
  lastSyncAt?: string;
  hubConnected: boolean;
  cloudConnected: boolean;
  metadata?: Record<string, unknown>;
}

export interface HubStatus {
  hubId: string;
  outletId: string;
  cloudConnected: boolean;
  pendingSyncCount: number;
  registeredDevices: number;
  lastCloudSyncAt?: string;
  version: string;
}

export const SYNC_CONFLICT_RULES = {
  order: "client_wins" as const,
  payment: "client_wins" as const,
  invoice_number: "hub_authoritative" as const,
  stock_po: "server_wins" as const,
  menu_master: "server_wins" as const,
};

export function createSyncEvent(
  partial: Omit<SyncEventEnvelope, "id" | "clientTimestamp"> & { id?: string }
): SyncEventEnvelope {
  return {
    id: partial.id ?? crypto.randomUUID(),
    clientTimestamp: new Date().toISOString(),
    ...partial,
  };
}

export function validateIdempotencyKey(key: string): boolean {
  return typeof key === "string" && key.length >= 8 && key.length <= 128;
}
