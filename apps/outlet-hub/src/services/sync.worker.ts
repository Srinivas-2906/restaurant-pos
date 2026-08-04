import { eq } from "drizzle-orm";
import type { OutletDatabase } from "@kaana/outlet-db";
import { syncEvents } from "@kaana/outlet-db";
import type { HubStatus, SyncBatchRequest } from "@kaana/sync-protocol";
import type { HubState } from "../hub-state";

export class SyncWorker {
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private db: OutletDatabase,
    private state: HubState,
    private cloudApiUrl: string,
  ) {}

  start(intervalMs = 15000) {
    this.sync();
    this.interval = setInterval(() => this.sync(), intervalMs);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }

  async sync() {
    const pending = this.db.select().from(syncEvents).all().filter((e) => e.status === "pending");
    if (pending.length === 0) {
      this.state.cloudConnected = await this.pingCloud();
      this.state.pendingSyncCount = 0;
      return;
    }

    const events = pending.map((e) => ({
      id: e.id,
      idempotencyKey: e.idempotencyKey,
      outletId: this.state.outletId,
      deviceId: this.state.hubId,
      entityType: e.entityType as never,
      entityId: e.entityId,
      action: e.action as never,
      payload: JSON.parse(e.payload),
      clientTimestamp: e.createdAt,
      sequence: e.sequence,
    }));

    const batch: SyncBatchRequest = {
      outletId: this.state.outletId,
      hubId: this.state.hubId,
      events,
    };

    try {
      const res = await fetch(`${this.cloudApiUrl}/sync/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });

      if (res.ok) {
        const result = await res.json() as { accepted: string[] };
        const now = new Date().toISOString();
        for (const id of result.accepted) {
          this.db.update(syncEvents).set({ status: "synced", syncedAt: now }).where(eq(syncEvents.id, id)).run();
        }
        this.state.cloudConnected = true;
        this.state.pendingSyncCount = this.db.select().from(syncEvents).all().filter((e) => e.status === "pending").length;
      } else {
        this.state.cloudConnected = false;
      }
    } catch {
      this.state.cloudConnected = false;
    }
  }

  private async pingCloud(): Promise<boolean> {
    try {
      const res = await fetch(`${this.cloudApiUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  getStatus(): HubStatus {
    return this.state.getStatus();
  }
}
