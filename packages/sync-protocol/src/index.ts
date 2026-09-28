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

/** POS offline command types — Step 15 */
export type PosCommandType =
  | "CREATE_ORDER"
  | "ADD_ITEM"
  | "UPDATE_ITEM_QTY"
  | "REMOVE_ITEM"
  | "FIRE_KOT"
  | "SETTLE"
  | "CANCEL_ORDER"
  | "APPLY_DISCOUNT";

export type PosOutboxStatus = "pending" | "syncing" | "acked" | "conflict" | "failed";

export interface PosCommandEnvelope {
  id: string;
  idempotencyKey: string;
  outletId: string;
  deviceId: string;
  terminalId: string;
  staffProfileId: string;
  employeeCode: string;
  operationType: PosCommandType;
  aggregateId: string;
  localEntityId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  sequence: number;
}

export interface PosSyncBatchRequest {
  outletId: string;
  deviceId: string;
  terminalId: string;
  commands: PosCommandEnvelope[];
  lastAckSequence?: number;
}

export interface PosSyncCommandResult {
  commandId: string;
  idempotencyKey: string;
  status: "acked" | "conflict" | "rejected";
  serverEntityId?: string;
  cloudMappings?: Record<string, string>;
  conflict?: {
    code: string;
    message: string;
    serverState?: Record<string, unknown>;
    resolutionOptions?: string[];
  };
  error?: string;
}

export interface PosSyncBatchResponse {
  results: PosSyncCommandResult[];
  lastAckSequence: number;
  menuUpdatedAt?: string;
  capabilitiesUpdatedAt?: string;
}

export interface PosMenuCacheSnapshot {
  outletId: string;
  categories: Array<{
    id: string;
    name: string;
    sortOrder: number;
    items: Array<{
      id: string;
      name: string;
      basePrice: number;
      isVeg: boolean;
      isAvailable: boolean;
      kitchenStationId?: string | null;
      taxRate: number;
      updatedAt?: string;
    }>;
  }>;
  syncedAt: string;
}

export interface PosStaffOfflineSnapshot {
  staffProfileId: string;
  employeeCode: string;
  displayName: string;
  role: string;
  permissions: string[];
  pinVerifier: string;
  offlineAuthValidUntil: string;
  verifiedAt: string;
}

export const OFFLINE_AUTH_TTL_HOURS = 72;
export const OFFLINE_PIN_MAX_ATTEMPTS = 5;
export const OFFLINE_PIN_LOCKOUT_MINUTES = 15;
export const POS_SYNC_BATCH_SIZE = 20;
