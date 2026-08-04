import { eq } from "drizzle-orm";
import type { OutletDatabase } from "@kaana/outlet-db";
import { kots, kotItems, orderItems, menuItems } from "@kaana/outlet-db";
import type { HubState } from "../hub-state";

export class KdsService {
  constructor(private db: OutletDatabase, private state: HubState) {}

  getStationQueue(stationId: string) {
    const stationKots = this.db.select().from(kots)
      .where(eq(kots.kitchenStationId, stationId))
      .all()
      .filter((k) => k.status === "pending" || k.status === "preparing");

    return stationKots.map((kot) => {
      const items = this.db.select().from(kotItems).where(eq(kotItems.kotId, kot.id)).all();
      const enriched = items.map((ki) => {
        const oi = this.db.select().from(orderItems).where(eq(orderItems.id, ki.orderItemId)).get();
        return { ...ki, orderItem: oi };
      });
      return { ...kot, items: enriched };
    });
  }

  getAggregated(outletId: string) {
    const pendingItems = this.db.select().from(orderItems).all()
      .filter((i) => i.status === "kot_fired" || i.status === "pending");

    const grouped: Record<string, number> = {};
    for (const item of pendingItems) {
      grouped[item.name] = (grouped[item.name] ?? 0) + (item.quantity ?? 1);
    }
    return Object.entries(grouped).map(([name, quantity]) => ({ name, _sum: { quantity } }));
  }

  markReady(kotId: string) {
    const now = new Date().toISOString();
    this.db.update(kots).set({ status: "ready", readyAt: now }).where(eq(kots.id, kotId)).run();
    this.db.update(kotItems).set({ status: "ready" }).where(eq(kotItems.kotId, kotId)).run();
    const kot = this.db.select().from(kots).where(eq(kots.id, kotId)).get();
    if (kot) this.state.broadcast(`station:${kot.kitchenStationId}:kots`, { ...kot, status: "ready" });
    return kot;
  }

  markPreparing(kotId: string) {
    this.db.update(kots).set({ status: "preparing" }).where(eq(kots.id, kotId)).run();
    return this.db.select().from(kots).where(eq(kots.id, kotId)).get();
  }

  markItemUnavailable(menuItemId: string) {
    this.db.update(menuItems).set({ isAvailable: false }).where(eq(menuItems.id, menuItemId)).run();
    this.state.broadcast("menu:availability", { menuItemId, isAvailable: false });
    return { menuItemId, isAvailable: false };
  }
}
