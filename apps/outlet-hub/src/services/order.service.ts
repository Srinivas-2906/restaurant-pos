import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { OutletDatabase } from "@kaana/outlet-db";
import {
  orders, orderItems, tables, kots, kotItems, payments, invoices, syncEvents,
  menuCategories, menuItems, kitchenStations,
} from "@kaana/outlet-db";
import type { HubState } from "../hub-state";
import type { PrinterManager } from "@kaana/device-bridge";
import { createSyncEvent } from "@kaana/sync-protocol";

export class OrderService {
  constructor(
    private db: OutletDatabase,
    private state: HubState,
    private printers: PrinterManager,
  ) {}

  getFloor() {
    return this.db.select().from(tables).all();
  }

  getMenu() {
    const categories = this.db.select().from(menuCategories).all();
    const items = this.db.select().from(menuItems).all();
    return categories.map((c: { id: string; name: string }) => ({
      ...c,
      items: items.filter((i: { categoryId: string }) => i.categoryId === c.id),
    }));
  }

  createOrder(data: {
    tableId?: string;
    terminalId?: string;
    type?: string;
    source?: string;
    guestCount?: number;
    idempotencyKey?: string;
  }) {
    const now = new Date().toISOString();
    const id = uuid();
    const idempotencyKey = data.idempotencyKey ?? uuid();
    const orderNumber = this.state.nextOrderNumber();

    this.db.insert(orders).values({
      id,
      idempotencyKey,
      orderNumber,
      outletId: this.state.outletId,
      terminalId: data.terminalId,
      tableId: data.tableId,
      source: data.source ?? "dine_in",
      type: data.type ?? "dine_in",
      status: "open",
      guestCount: data.guestCount ?? 1,
      createdAt: now,
      updatedAt: now,
      synced: false,
    }).run();

    if (data.tableId) {
      this.db.update(tables).set({ status: "seated" }).where(eq(tables.id, data.tableId)).run();
    }

    this.enqueueSync("order", id, "create", { orderNumber, ...data });
    this.state.broadcast("outlet:orders", { id, orderNumber, status: "open" });
    return this.getOrder(id);
  }

  addItem(orderId: string, data: { menuItemId: string; name: string; unitPrice: number; quantity?: number; notes?: string }) {
    const qty = data.quantity ?? 1;
    const taxRate = 0.05;
    const lineTotal = data.unitPrice * qty;
    const taxAmount = lineTotal * taxRate;
    const itemId = uuid();

    this.db.insert(orderItems).values({
      id: itemId,
      orderId,
      menuItemId: data.menuItemId,
      name: data.name,
      quantity: qty,
      unitPrice: data.unitPrice,
      taxAmount,
      totalPrice: lineTotal + taxAmount,
      notes: data.notes,
    }).run();

    this.recalculateOrder(orderId);
    this.enqueueSync("order_item", itemId, "create", { orderId, ...data });
    return this.getOrder(orderId);
  }

  fireKOT(orderId: string) {
    const items = this.db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).all()
      .filter((i) => !i.kotId);

    const allMenuItems = this.db.select().from(menuItems).all();
    const stations = this.db.select().from(kitchenStations).all();

    const byStation = new Map<string, typeof items>();
    for (const item of items) {
      const menuItem = allMenuItems.find((m) => m.id === item.menuItemId);
      const stationId = menuItem?.kitchenStationId ?? stations[0]?.id ?? "default";
      if (!byStation.has(stationId)) byStation.set(stationId, []);
      byStation.get(stationId)!.push(item);
    }

    const createdKots = [];
    for (const [stationId, stationItems] of byStation) {
      const kotId = uuid();
      const kotNumber = this.state.nextKotNumber();
      const firedAt = new Date().toISOString();

      this.db.insert(kots).values({
        id: kotId,
        orderId,
        kitchenStationId: stationId,
        kotNumber,
        status: "pending",
        firedAt,
      }).run();

      for (const item of stationItems) {
        this.db.insert(kotItems).values({
          id: uuid(),
          kotId,
          orderItemId: item.id,
          quantity: item.quantity ?? 1,
        }).run();
        this.db.update(orderItems).set({ kotId, status: "kot_fired" }).where(eq(orderItems.id, item.id)).run();
      }

      const station = stations.find((s: { id: string }) => s.id === stationId);
      this.printers.printKOT(
        station?.code ?? "MAIN",
        kotNumber,
        stationItems.map((i) => ({ name: i.name, qty: i.quantity ?? 1 })),
      );

      const kot = this.db.select().from(kots).where(eq(kots.id, kotId)).get();
      createdKots.push(kot);
      this.state.broadcast(`station:${stationId}:kots`, kot);
    }

    this.db.update(orders).set({ status: "kot_fired", updatedAt: new Date().toISOString() }).where(eq(orders.id, orderId)).run();
    return createdKots;
  }

  settle(orderId: string, data: { payments: Array<{ method: string; amount: number; reference?: string }>; discountAmount?: number }) {
    const order = this.getOrder(orderId);
    if (!order) throw new Error("Order not found");

    for (const p of data.payments) {
      this.db.insert(payments).values({
        id: uuid(),
        orderId,
        method: p.method,
        amount: p.amount,
        status: p.method === "upi" && !p.reference ? "pending" : "completed",
        reference: p.reference,
        processedAt: new Date().toISOString(),
      }).run();
    }

    const invoiceNumber = this.state.nextInvoiceNumber();
    this.db.insert(invoices).values({
      id: uuid(),
      orderId,
      invoiceNumber,
      totalAmount: order.totalAmount ?? 0,
      issuedAt: new Date().toISOString(),
    }).run();

    this.db.update(orders).set({
      status: "settled",
      discountAmount: data.discountAmount ?? 0,
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, orderId)).run();

    if (order.tableId) {
      this.db.update(tables).set({ status: "free" }).where(eq(tables.id, order.tableId)).run();
    }

    this.printers.printBill(
      invoiceNumber,
      order.items.map((i) => ({ name: i.name, qty: i.quantity ?? 1, total: i.totalPrice })),
      order.totalAmount ?? 0,
    );

    this.enqueueSync("order", orderId, "update", { status: "settled" });
    this.state.broadcast("outlet:orders", { id: orderId, status: "settled" });
    return { order: this.getOrder(orderId), invoiceNumber };
  }

  getOrder(orderId: string) {
    const order = this.db.select().from(orders).where(eq(orders.id, orderId)).get();
    if (!order) return null;
    const items = this.db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).all();
    return { ...order, items };
  }

  listOrders(status?: string) {
    const all = this.db.select().from(orders).all();
    return status ? all.filter((o) => o.status === status) : all;
  }

  seedDemoData() {
    const existing = this.db.select().from(menuItems).all();
    if (existing.length > 0) return;

    const stations = [
      { id: "st-tandoor", name: "Tandoor", code: "TANDOOR" },
      { id: "st-main", name: "Main Kitchen", code: "MAIN" },
    ];
    for (const s of stations) this.db.insert(kitchenStations).values(s).run();
    this.printers.routeStation("TANDOOR", "default");
    this.printers.routeStation("MAIN", "default");

    const catId = "cat-main";
    this.db.insert(menuCategories).values({ id: catId, name: "Main Course", sortOrder: 1 }).run();
    const items = [
      { id: "mi-1", categoryId: catId, name: "Paneer Tikka", price: 249, kitchenStationId: "st-tandoor", isVeg: true },
      { id: "mi-2", categoryId: catId, name: "Butter Chicken", price: 349, kitchenStationId: "st-main", isVeg: false },
      { id: "mi-3", categoryId: catId, name: "Butter Naan", price: 59, kitchenStationId: "st-tandoor", isVeg: true },
    ];
    for (const item of items) this.db.insert(menuItems).values(item).run();

    for (let i = 1; i <= 8; i++) {
      this.db.insert(tables).values({
        id: `table-${i}`,
        floorPlanId: "fp-1",
        number: `T${i}`,
        capacity: i <= 4 ? 4 : 6,
        status: "free",
      }).run();
    }
  }

  private recalculateOrder(orderId: string) {
    const items = this.db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).all();
    const subtotal = items.reduce((s, i) => s + i.unitPrice * (i.quantity ?? 1), 0);
    const taxAmount = items.reduce((s, i) => s + (i.taxAmount ?? 0), 0);
    const totalAmount = items.reduce((s, i) => s + i.totalPrice, 0);
    this.db.update(orders).set({ subtotal, taxAmount, totalAmount, updatedAt: new Date().toISOString() }).where(eq(orders.id, orderId)).run();
  }

  private enqueueSync(entityType: string, entityId: string, action: string, payload: Record<string, unknown>) {
    const event = createSyncEvent({
      idempotencyKey: uuid(),
      outletId: this.state.outletId,
      deviceId: this.state.hubId,
      entityType: entityType as never,
      entityId,
      action: action as never,
      payload,
      sequence: this.state.nextSequence(),
    });

    this.db.insert(syncEvents).values({
      id: event.id,
      idempotencyKey: event.idempotencyKey,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      payload: JSON.stringify(event.payload),
      sequence: event.sequence,
      status: "pending",
      createdAt: event.clientTimestamp,
    }).run();

    this.state.pendingSyncCount++;
  }
}
