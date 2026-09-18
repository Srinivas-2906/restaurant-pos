import { OfflineSyncQueue, replaySyncQueue, type SyncQueueItem } from "@kaana/sync-engine";

const CLIENT_ID_KEY = "pos_sync_client_id";

function getClientId(): string {
  if (typeof window === "undefined") return "pos-server";
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

let queue: OfflineSyncQueue | null = null;

export function getPosOfflineQueue(): OfflineSyncQueue {
  if (!queue) queue = new OfflineSyncQueue(getClientId());
  return queue;
}

export function enqueuePosOfflineEvent(input: Omit<SyncQueueItem, "id" | "clientId" | "createdAt" | "retryCount">) {
  return getPosOfflineQueue().enqueue(input);
}

export async function flushPosOfflineQueue(apiBase: string, token: string) {
  const q = getPosOfflineQueue();
  return replaySyncQueue(q, async (item) => {
    const res = await fetch(`${apiBase}/sync/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        clientId: item.clientId,
        entityType: item.entityType,
        entityId: item.entityId,
        action: item.action,
        payload: item.payload,
        outletId: item.payload.outletId,
      }),
    });
    return res.ok;
  });
}

export function startPosOfflineSyncLoop(apiBase: string, getToken: () => string | null, intervalMs = 30_000) {
  if (typeof window === "undefined") return () => undefined;
  const timer = window.setInterval(() => {
    const token = getToken();
    if (!token) return;
    if (getPosOfflineQueue().getPendingCount() === 0) return;
    flushPosOfflineQueue(apiBase, token).catch(() => undefined);
  }, intervalMs);
  return () => window.clearInterval(timer);
}
