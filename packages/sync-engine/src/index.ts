export interface SyncQueueItem {
  id: string;
  clientId: string;
  entityType: string;
  entityId: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  retryCount: number;
}

export interface SyncConflict {
  localId: string;
  serverId: string;
  entityType: string;
  resolution: "server_wins" | "client_wins" | "merge";
}

const STORAGE_KEY = "kaana_sync_queue";

export class OfflineSyncQueue {
  private queue: SyncQueueItem[] = [];
  private clientId: string;

  constructor(clientId: string) {
    this.clientId = clientId;
    if (typeof window !== "undefined") {
      this.loadFromStorage();
    }
  }

  enqueue(item: Omit<SyncQueueItem, "id" | "clientId" | "createdAt" | "retryCount">): SyncQueueItem {
    const entry: SyncQueueItem = {
      ...item,
      id: crypto.randomUUID(),
      clientId: this.clientId,
      createdAt: new Date(),
      retryCount: 0,
    };
    this.queue.push(entry);
    this.persist();
    return entry;
  }

  dequeue(): SyncQueueItem | undefined {
    return this.queue.find((q) => q.retryCount < 5);
  }

  markSynced(id: string): void {
    this.queue = this.queue.filter((q) => q.id !== id);
    this.persist();
  }

  markFailed(id: string): void {
    const item = this.queue.find((q) => q.id === id);
    if (item) item.retryCount++;
    this.persist();
  }

  getPending(): SyncQueueItem[] {
    return [...this.queue];
  }

  getPendingCount(): number {
    return this.queue.length;
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${this.clientId}`);
      if (stored) this.queue = JSON.parse(stored);
    } catch {
      this.queue = [];
    }
  }

  private persist(): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(`${STORAGE_KEY}_${this.clientId}`, JSON.stringify(this.queue));
    }
  }
}

export class SyncConflictResolver {
  resolve(conflict: SyncConflict, serverUpdatedAt: Date, clientUpdatedAt: Date): SyncConflict["resolution"] {
    if (conflict.resolution !== "merge") return conflict.resolution;
    return serverUpdatedAt >= clientUpdatedAt ? "server_wins" : "client_wins";
  }
}

export async function replaySyncQueue(
  queue: OfflineSyncQueue,
  syncFn: (item: SyncQueueItem) => Promise<boolean>
): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;
  const pending = queue.getPending();

  for (const item of pending) {
    try {
      const success = await syncFn(item);
      if (success) {
        queue.markSynced(item.id);
        synced++;
      } else {
        queue.markFailed(item.id);
        failed++;
      }
    } catch {
      queue.markFailed(item.id);
      failed++;
    }
  }

  return { synced, failed };
}
