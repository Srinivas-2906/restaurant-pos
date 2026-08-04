import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { ingredients, stockLedger, syncEvents } from "@kaana/outlet-db";
import type { OutletDatabase } from "@kaana/outlet-db";
import type { HubState } from "../hub-state";

interface POItem {
  ingredientId: string;
  quantity: number;
  name?: string;
}

interface PurchaseOrder {
  id: string;
  status: string;
  items: POItem[];
  createdAt: string;
}

export class InventoryService {
  private purchaseOrders: PurchaseOrder[] = [];

  constructor(
    private db: OutletDatabase,
    private state: HubState,
  ) {
    this.seed();
  }

  private seed() {
    const existing = this.db.select().from(ingredients).all();
    if (existing.length === 0) {
      for (const row of [
        { id: "ing-paneer", name: "Paneer", unit: "kg", currentStock: 10, minStock: 2 },
        { id: "ing-chicken", name: "Chicken", unit: "kg", currentStock: 15, minStock: 3 },
      ]) {
        this.db.insert(ingredients).values(row).run();
      }
      this.purchaseOrders.push({
        id: "po-demo-1",
        status: "pending",
        items: [{ ingredientId: "ing-paneer", quantity: 5, name: "Paneer" }],
        createdAt: new Date().toISOString(),
      });
    }
  }

  listIngredients() {
    return this.db.select().from(ingredients).all();
  }

  listPurchaseOrders() {
    return this.purchaseOrders;
  }

  receivePO(poId: string) {
    const po = this.purchaseOrders.find((p) => p.id === poId);
    if (!po || po.status !== "pending") {
      throw new Error("PO not found or already received");
    }

    const now = new Date().toISOString();
    for (const item of po.items) {
      const ing = this.db.select().from(ingredients).where(eq(ingredients.id, item.ingredientId)).get();
      if (!ing) continue;

      const newStock = (ing.currentStock ?? 0) + item.quantity;
      this.db.update(ingredients).set({ currentStock: newStock }).where(eq(ingredients.id, item.ingredientId)).run();

      const ledgerId = randomUUID();
      this.db.insert(stockLedger).values({
        id: ledgerId,
        ingredientId: item.ingredientId,
        type: "grn",
        quantity: item.quantity,
        balanceAfter: newStock,
        reference: poId,
        createdAt: now,
      }).run();

      this.enqueueSync(ledgerId, {
        type: "grn",
        quantity: item.quantity,
        poId,
        ingredientId: item.ingredientId,
        outletId: this.state.outletId,
      });
    }

    po.status = "received";
    return { po, ingredients: this.listIngredients() };
  }

  private enqueueSync(entityId: string, payload: Record<string, unknown>) {
    const id = randomUUID();
    const seq = this.db.select().from(syncEvents).all().length + 1;
    this.db.insert(syncEvents).values({
      id,
      idempotencyKey: `grn-${entityId}`,
      entityType: "stock_ledger",
      entityId,
      action: "create",
      payload: JSON.stringify(payload),
      sequence: seq,
      status: "pending",
      createdAt: new Date().toISOString(),
    }).run();
    this.state.pendingSyncCount = this.db.select().from(syncEvents).all().filter((e) => e.status === "pending").length;
  }
}
