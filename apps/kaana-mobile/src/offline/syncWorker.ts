import type { PosSyncBatchRequest, PosSyncBatchResponse } from "@kaana/sync-protocol";
import {
  computeBackoffMs,
  isAuthError,
  isConflictStatus,
  isRetryableHttpStatus,
} from "@kaana/sync-engine";
import { outboxStore } from "./outboxStore";
import { mapServerId, cacheMenuFromApi } from "./posLocalStore";
import { setMeta, getMeta } from "./database";
import { API_URL } from "../config/env";
import type { PosApi } from "../pos/createPosApi";
import { API_PROBE_TIMEOUT_MS, withTimeout } from "./menuRefresh";

export type SyncConnectivityState =
  | "ONLINE"
  | "OFFLINE"
  | "SYNCING"
  | "SYNC_ERROR"
  | "NEEDS_ATTENTION";

let connectivityState: SyncConnectivityState = "ONLINE";
let lastSyncAt: string | null = null;
let listeners: Array<(state: SyncConnectivityState, pending: number) => void> = [];

export function getSyncState() {
  return { connectivityState, lastSyncAt };
}

export function subscribeSyncState(
  fn: (state: SyncConnectivityState, pending: number) => void,
): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

async function notifyState() {
  const pending = await outboxStore.getPendingCount();
  for (const fn of listeners) fn(connectivityState, pending);
}

export function setConnectivityOnline(reachable: boolean) {
  connectivityState = reachable ? "ONLINE" : "OFFLINE";
  void notifyState();
}

/** Public health probe — no auth/refresh (offline-session must not block reachability). */
export async function checkApiReachability(_api?: PosApi): Promise<boolean> {
  try {
    await withTimeout(
      fetch(`${API_URL}/health`).then(async (res) => {
        if (!res.ok) throw new Error(`health ${res.status}`);
        const body = (await res.json()) as { status?: string };
        if (body.status !== "ok") throw new Error("health not ok");
      }),
      API_PROBE_TIMEOUT_MS,
      "health probe",
    );
    return true;
  } catch {
    return false;
  }
}

export async function runSyncWorker(params: {
  api: PosApi;
  outletId: string;
  deviceId: string;
  terminalId: string;
  requiresOnlineLogin?: boolean;
}): Promise<{ synced: number; failed: number; conflicts: number }> {
  const reachable = await checkApiReachability(params.api);
  if (!reachable) {
    setConnectivityOnline(false);
    return { synced: 0, failed: 0, conflicts: 0 };
  }

  setConnectivityOnline(true);

  if (params.requiresOnlineLogin) {
    connectivityState = "NEEDS_ATTENTION";
    await notifyState();
    return { synced: 0, failed: 0, conflicts: 0 };
  }

  await outboxStore.recoverStaleSyncing();
  await outboxStore.abandonOrphanSettleCommands();

  connectivityState = "SYNCING";
  await notifyState();

  let synced = 0;
  let failed = 0;
  let conflicts = 0;

  const pending = await outboxStore.getPending(20);
  if (pending.length === 0) {
    connectivityState = "ONLINE";
    await notifyState();
    return { synced, failed, conflicts };
  }

  const commands = pending.map((row) => ({
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    outletId: params.outletId,
    deviceId: params.deviceId,
    terminalId: params.terminalId,
    staffProfileId: row.staffProfileId,
    employeeCode: row.employeeCode,
    operationType: row.operationType as never,
    aggregateId: row.aggregateId,
    localEntityId: row.localEntityId,
    payload: row.payload,
    occurredAt: row.occurredAt,
    sequence: row.sequence,
  }));

  for (const cmd of commands) {
    await outboxStore.markSyncing(cmd.id);
  }

  try {
    const body: PosSyncBatchRequest = {
      outletId: params.outletId,
      deviceId: params.deviceId,
      terminalId: params.terminalId,
      commands,
    };

    const response = await params.api.client.api<PosSyncBatchResponse>("/sync/pos/batch", {
      method: "POST",
      body: JSON.stringify(body),
    });

    for (const result of response.results) {
      const row = pending.find((p) => p.id === result.commandId);
      if (!row) continue;

      if (result.status === "acked") {
        await outboxStore.markAcked(row.id, result.serverEntityId);
        if (result.cloudMappings) {
          for (const [localId, serverId] of Object.entries(result.cloudMappings)) {
            if (localId.startsWith("invoice:")) continue;
            const entityType =
              row.operationType === "CREATE_ORDER" && localId === row.localEntityId
                ? "order"
                : localId === row.aggregateId
                  ? "order"
                  : "item";
            await mapServerId(localId, serverId, entityType);
          }
        }
        synced++;
      } else if (result.status === "conflict") {
        await outboxStore.markConflict(
          row.id,
          result.conflict?.message ?? result.error ?? "Conflict",
          result.conflict as Record<string, unknown>,
        );
        conflicts++;
      } else {
        await outboxStore.markFailed(row.id, result.error ?? "Rejected", true);
        failed++;
      }
    }

    lastSyncAt = new Date().toISOString();
    await setMeta("last_sync_at", lastSyncAt);

    // Pull fresh menu after sync
    try {
      const menu = await params.api.menu.fetchMenu(params.outletId);
      await cacheMenuFromApi(params.outletId, menu);
    } catch {
      // non-fatal
    }
  } catch (err) {
    const status = (err as { status?: number }).status ?? 0;
    const message = err instanceof Error ? err.message : "Sync failed";
    for (const cmd of commands) {
      if (isAuthError(status)) {
        await outboxStore.markFailed(cmd.id, message, true);
        connectivityState = "NEEDS_ATTENTION";
        failed++;
      } else if (isConflictStatus(status)) {
        await outboxStore.markConflict(cmd.id, message);
        conflicts++;
      } else if (isRetryableHttpStatus(status) || status === 0) {
        await outboxStore.markFailed(cmd.id, message, false);
        failed++;
      } else {
        await outboxStore.markFailed(cmd.id, message, true);
        failed++;
      }
    }
    if (connectivityState !== "NEEDS_ATTENTION") {
      connectivityState = failed > 0 ? "SYNC_ERROR" : "ONLINE";
    }
    await notifyState();
    return { synced, failed, conflicts };
  }

  const remaining = await outboxStore.getPendingCount();
  const conflictCount = await outboxStore.getConflictCount();
  if (conflictCount > 0) connectivityState = "NEEDS_ATTENTION";
  else if (remaining > 0) connectivityState = "SYNC_ERROR";
  else connectivityState = "ONLINE";

  await notifyState();
  return { synced, failed, conflicts };
}

export async function scheduleSyncWithBackoff(params: {
  api: PosApi;
  outletId: string;
  deviceId: string;
  terminalId: string;
  attempt?: number;
  requiresOnlineLogin?: boolean;
}): Promise<void> {
  const attempt = params.attempt ?? 0;
  const result = await runSyncWorker(params);
  const pending = await outboxStore.getPendingCount();
  if (pending > 0 && result.failed > 0) {
    const delay = computeBackoffMs(attempt);
    setTimeout(() => {
      void scheduleSyncWithBackoff({ ...params, attempt: attempt + 1 });
    }, delay);
  }
}

export async function getLastSyncLabel(): Promise<string | null> {
  const ts = (await getMeta("last_sync_at")) ?? lastSyncAt;
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
