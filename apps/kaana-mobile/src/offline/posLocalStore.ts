import type { FloorPlan, FloorTable, MenuCategory, OrderSummary } from "@kaana/api-client";
import type { PosCommandType } from "@kaana/sync-protocol";
import { ACTIVE_ORDER_STATUSES } from "../pos/types";
import { getMeta, getOfflineDb, setMeta, uuid } from "./database";

const MENU_CACHED_OUTLET_KEY = "menu_cached_outlet_id";
const FLOOR_CACHED_OUTLET_KEY = "floor_cached_outlet_id";

function openOrdersCacheKey(outletId: string) {
  return `open_orders_cache:${outletId}`;
}
import { outboxStore } from "./outboxStore";

export type LocalOrderStatus = "open" | "kot_fired" | "settled" | "cancelled";
export type LocalSyncStatus = "pending" | "synced" | "conflict";

export interface LocalOrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxAmount: number;
  taxRate: number;
  totalPrice: number;
  notes?: string;
  status: string;
  kotId?: string | null;
  menuItemUpdatedAt?: string;
}

export interface LocalOrder {
  id: string;
  cloudId?: string | null;
  orderNumber: string;
  outletId: string;
  terminalId?: string;
  tableId?: string | null;
  type: string;
  status: LocalOrderStatus;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  syncStatus: LocalSyncStatus;
  staffProfileId: string;
  employeeCode: string;
  occurredAt: string;
  items: LocalOrderItem[];
  kotCount: number;
}

type ActorContext = {
  staffProfileId: string;
  employeeCode: string;
  terminalId: string;
  outletId: string;
  permissions: string[];
  role: string;
};

let localOrderCounter = 0;

function nextLocalOrderNumber(): string {
  localOrderCounter += 1;
  return `LOCAL-${String(localOrderCounter).padStart(5, "0")}`;
}

function computeLineTax(unitPrice: number, qty: number, taxRate: number) {
  const lineTotal = unitPrice * qty;
  const taxAmount = (lineTotal * taxRate) / 100;
  return { lineTotal, taxAmount, totalPrice: lineTotal + taxAmount };
}

async function recalculateOrder(db: Awaited<ReturnType<typeof getOfflineDb>>, orderId: string) {
  const items = await db.getAllAsync<{ total_price: number; tax_amount: number }>(
    "SELECT total_price, tax_amount FROM order_items WHERE order_id = ?",
    orderId,
  );
  const subtotal = items.reduce((s, i) => s + i.total_price - i.tax_amount, 0);
  const taxAmount = items.reduce((s, i) => s + i.tax_amount, 0);
  const totalAmount = subtotal + taxAmount;
  await db.runAsync(
    "UPDATE orders SET subtotal = ?, tax_amount = ?, total_amount = ?, updated_at = ? WHERE id = ?",
    subtotal,
    taxAmount,
    totalAmount,
    new Date().toISOString(),
    orderId,
  );
}

async function enqueueInTransaction(
  db: Awaited<ReturnType<typeof getOfflineDb>>,
  params: {
    operationType: PosCommandType;
    aggregateId: string;
    localEntityId: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
    actor: ActorContext;
    occurredAt: string;
  },
) {
  const seq = await outboxStore.nextGlobalSequence();
  await outboxStore.enqueue({
    id: uuid(),
    operationType: params.operationType,
    aggregateId: params.aggregateId,
    localEntityId: params.localEntityId,
    idempotencyKey: params.idempotencyKey,
    payload: params.payload,
    sequence: seq,
    status: "pending",
    staffProfileId: params.actor.staffProfileId,
    employeeCode: params.actor.employeeCode,
    terminalId: params.actor.terminalId,
    occurredAt: params.occurredAt,
  });
}

export async function createLocalOrder(
  actor: ActorContext,
  data: { type: string; tableId?: string; guestCount?: number; notes?: string },
): Promise<LocalOrder> {
  const db = await getOfflineDb();
  const id = uuid();
  const now = new Date().toISOString();
  const orderNumber = nextLocalOrderNumber();
  const idempotencyKey = `create:${id}`;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO orders (
        id, idempotency_key, order_number, outlet_id, terminal_id, table_id,
        type, source, status, guest_count, notes, sync_status,
        staff_profile_id, employee_code, occurred_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pos', 'open', ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      id,
      idempotencyKey,
      orderNumber,
      actor.outletId,
      actor.terminalId,
      data.tableId ?? null,
      data.type,
      data.guestCount ?? 1,
      data.notes ?? null,
      actor.staffProfileId,
      actor.employeeCode,
      now,
      now,
      now,
    );

    if (data.tableId) {
      await db.runAsync("UPDATE tables SET status = 'seated' WHERE id = ?", data.tableId);
    }

    await enqueueInTransaction(db, {
      operationType: "CREATE_ORDER",
      aggregateId: id,
      localEntityId: id,
      idempotencyKey,
      payload: {
        clientOrderId: id,
        type: data.type,
        tableId: data.tableId,
        guestCount: data.guestCount ?? 1,
        notes: data.notes,
      },
      actor,
      occurredAt: now,
    });
  });

  return (await getLocalOrder(id))!;
}

export async function addLocalItem(
  actor: ActorContext,
  orderId: string,
  data: {
    menuItemId: string;
    name: string;
    unitPrice: number;
    taxRate: number;
    quantity?: number;
    menuItemUpdatedAt?: string;
    notes?: string;
  },
): Promise<LocalOrder> {
  const db = await getOfflineDb();
  const itemId = uuid();
  const qty = data.quantity ?? 1;
  const { taxAmount, totalPrice } = computeLineTax(data.unitPrice, qty, data.taxRate);
  const now = new Date().toISOString();
  const idempotencyKey = `add:${orderId}:${itemId}`;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO order_items (
        id, order_id, menu_item_id, name, quantity, unit_price, tax_amount, tax_rate,
        total_price, notes, status, menu_item_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      itemId,
      orderId,
      data.menuItemId,
      data.name,
      qty,
      data.unitPrice,
      taxAmount,
      data.taxRate,
      totalPrice,
      data.notes ?? null,
      data.menuItemUpdatedAt ?? null,
    );
    await recalculateOrder(db, orderId);
    await enqueueInTransaction(db, {
      operationType: "ADD_ITEM",
      aggregateId: orderId,
      localEntityId: itemId,
      idempotencyKey,
      payload: {
        localItemId: itemId,
        menuItemId: data.menuItemId,
        name: data.name,
        quantity: qty,
        unitPrice: data.unitPrice,
        taxAmount,
        taxRate: data.taxRate,
        menuItemUpdatedAt: data.menuItemUpdatedAt,
        notes: data.notes,
      },
      actor,
      occurredAt: now,
    });
  });

  return (await getLocalOrder(orderId))!;
}

export async function fireLocalKot(actor: ActorContext, orderId: string): Promise<LocalOrder> {
  const db = await getOfflineDb();
  const now = new Date().toISOString();
  const pending = await db.getAllAsync<{ id: string; quantity: number }>(
    "SELECT id, quantity FROM order_items WHERE order_id = ? AND kot_id IS NULL AND status = 'pending'",
    orderId,
  );
  if (pending.length === 0) throw new Error("No pending items to fire");

  const kotId = uuid();
  const kotRow = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM kots WHERE order_id = ?",
    orderId,
  );
  const batchSeq = (kotRow?.c ?? 0) + 1;
  const kotNumber = `LOCAL-KOT-${String(batchSeq).padStart(3, "0")}`;
  const idempotencyKey = `kot:${orderId}:${batchSeq}`;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO kots (id, order_id, kot_number, batch_seq, status, fired_at, sync_status)
       VALUES (?, ?, ?, ?, 'pending_sync', ?, 'pending')`,
      kotId,
      orderId,
      kotNumber,
      batchSeq,
      now,
    );
    for (const item of pending) {
      await db.runAsync(
        "UPDATE order_items SET kot_id = ?, status = 'kot_fired' WHERE id = ?",
        kotId,
        item.id,
      );
    }
    await db.runAsync(
      "UPDATE orders SET status = 'kot_fired', updated_at = ? WHERE id = ?",
      now,
      orderId,
    );
    await enqueueInTransaction(db, {
      operationType: "FIRE_KOT",
      aggregateId: orderId,
      localEntityId: kotId,
      idempotencyKey,
      payload: { kotId, batchSeq, itemIds: pending.map((i) => i.id) },
      actor,
      occurredAt: now,
    });
  });

  return (await getLocalOrder(orderId))!;
}

export async function settleLocalOrder(
  actor: ActorContext,
  orderId: string,
  data: {
    payments: Array<{ method: string; amount: number; reference?: string }>;
    discountAmount?: number;
    idempotencyKey: string;
  },
): Promise<LocalOrder> {
  const db = await getOfflineDb();
  const now = new Date().toISOString();
  const discount = data.discountAmount ?? 0;

  const existing = await db.getFirstAsync<{ status: string }>(
    "SELECT status FROM orders WHERE id = ?",
    orderId,
  );
  if (existing?.status === "settled") {
    return (await getLocalOrder(orderId))!;
  }

  const dupSettle = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM sync_outbox WHERE idempotency_key = ? AND status IN ('pending', 'syncing', 'acked')",
    data.idempotencyKey,
  );
  if (dupSettle) {
    return (await getLocalOrder(orderId))!;
  }

  await db.withTransactionAsync(async () => {
    if (discount > 0) {
      await db.runAsync(
        "UPDATE orders SET discount_amount = ?, updated_at = ? WHERE id = ?",
        discount,
        now,
        orderId,
      );
      await recalculateOrder(db, orderId);
    }

    for (const p of data.payments) {
      await db.runAsync(
        `INSERT INTO payments (id, order_id, method, amount, status, reference, processed_at)
         VALUES (?, ?, ?, ?, 'completed', ?, ?)`,
        uuid(),
        orderId,
        p.method,
        p.amount,
        p.reference ?? null,
        now,
      );
    }

    const order = await db.getFirstAsync<{ table_id: string | null; total_amount: number }>(
      "SELECT table_id, total_amount FROM orders WHERE id = ?",
      orderId,
    );

    await db.runAsync(
      "UPDATE orders SET status = 'settled', sync_status = 'pending', updated_at = ? WHERE id = ?",
      now,
      orderId,
    );

    if (order?.table_id) {
      await db.runAsync("UPDATE tables SET status = 'free' WHERE id = ?", order.table_id);
    }

    await enqueueInTransaction(db, {
      operationType: "SETTLE",
      aggregateId: orderId,
      localEntityId: orderId,
      idempotencyKey: data.idempotencyKey,
      payload: {
        payments: data.payments,
        discountAmount: discount,
        permissions: actor.permissions,
        role: actor.role,
      },
      actor,
      occurredAt: now,
    });
  });

  return (await getLocalOrder(orderId))!;
}

export async function getLocalOrder(orderId: string): Promise<LocalOrder | null> {
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM orders WHERE id = ?",
    orderId,
  );
  if (!row) return null;

  const items = await db.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC",
    orderId,
  );
  const kotRow = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM kots WHERE order_id = ?",
    orderId,
  );

  return {
    id: row.id as string,
    cloudId: row.cloud_id as string | null,
    orderNumber: row.order_number as string,
    outletId: row.outlet_id as string,
    terminalId: row.terminal_id as string | undefined,
    tableId: row.table_id as string | null,
    type: row.type as string,
    status: row.status as LocalOrderStatus,
    subtotal: row.subtotal as number,
    taxAmount: row.tax_amount as number,
    discountAmount: row.discount_amount as number,
    totalAmount: row.total_amount as number,
    syncStatus: row.sync_status as LocalSyncStatus,
    staffProfileId: row.staff_profile_id as string,
    employeeCode: row.employee_code as string,
    occurredAt: row.occurred_at as string,
    kotCount: kotRow?.c ?? 0,
    items: items.map((i) => ({
      id: i.id as string,
      orderId: i.order_id as string,
      menuItemId: i.menu_item_id as string,
      name: i.name as string,
      quantity: i.quantity as number,
      unitPrice: i.unit_price as number,
      taxAmount: i.tax_amount as number,
      taxRate: i.tax_rate as number,
      totalPrice: i.total_price as number,
      notes: (i.notes as string | null) ?? undefined,
      status: i.status as string,
      kotId: i.kot_id as string | null,
      menuItemUpdatedAt: (i.menu_item_updated_at as string | null) ?? undefined,
    })),
  };
}

export type LocalPayment = {
  id: string;
  method: string;
  amount: number;
  status: string;
  processedAt: string;
};

export type PendingSyncOrderSummary = {
  localOrderId: string;
  orderNumber: string;
  type: string;
  status: LocalOrderStatus;
  syncStatus: LocalSyncStatus;
  totalAmount: number;
  itemCount: number;
  occurredAt: string;
  paymentMethod?: string;
  paymentAmount?: number;
};

export async function getLocalOrderPayments(orderId: string): Promise<LocalPayment[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "SELECT id, method, amount, status, processed_at FROM payments WHERE order_id = ? ORDER BY processed_at DESC",
    orderId,
  );
  return rows.map((row) => ({
    id: row.id as string,
    method: row.method as string,
    amount: row.amount as number,
    status: row.status as string,
    processedAt: row.processed_at as string,
  }));
}

export async function listPendingSyncOrderSummaries(
  outletId: string,
): Promise<PendingSyncOrderSummary[]> {
  const orders = await listPendingLocalOrders(outletId);
  const summaries: PendingSyncOrderSummary[] = [];

  for (const order of orders) {
    const payments = await getLocalOrderPayments(order.id);
    summaries.push({
      localOrderId: order.id,
      orderNumber: order.orderNumber,
      type: order.type,
      status: order.status,
      syncStatus: order.syncStatus,
      totalAmount: order.totalAmount,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      occurredAt: order.occurredAt,
      paymentMethod: payments[0]?.method,
      paymentAmount: payments[0]?.amount,
    });
  }

  return summaries;
}

export async function listPendingLocalOrders(outletId: string): Promise<LocalOrder[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM orders WHERE outlet_id = ? AND sync_status != 'synced' ORDER BY created_at DESC",
    outletId,
  );
  const orders: LocalOrder[] = [];
  for (const r of rows) {
    const o = await getLocalOrder(r.id);
    if (o) orders.push(o);
  }
  return orders;
}

export async function mapServerId(localId: string, serverId: string, entityType: string) {
  const db = await getOfflineDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO id_map (local_id, server_id, entity_type, mapped_at) VALUES (?, ?, ?, ?)",
    localId,
    serverId,
    entityType,
    new Date().toISOString(),
  );
  if (entityType === "order") {
    await db.runAsync(
      "UPDATE orders SET cloud_id = ?, sync_status = 'synced' WHERE id = ?",
      serverId,
      localId,
    );
  }
}

export async function cacheMenuFromApi(outletId: string, categories: MenuCategory[]): Promise<void> {
  const db = await getOfflineDb();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM menu_items");
    await db.runAsync("DELETE FROM menu_categories");
    for (const cat of categories) {
      await db.runAsync(
        "INSERT INTO menu_categories (id, name, sort_order) VALUES (?, ?, ?)",
        cat.id,
        cat.name,
        (cat as { sortOrder?: number }).sortOrder ?? 0,
      );
      for (const item of cat.items) {
        const extended = item as typeof item & {
          taxRule?: { cgstRate?: number; sgstRate?: number };
          kitchenStationId?: string | null;
          updatedAt?: string;
        };
        const taxRate = extended.taxRule
          ? Number(extended.taxRule.cgstRate ?? 0) + Number(extended.taxRule.sgstRate ?? 0)
          : 0;
        await db.runAsync(
          `INSERT INTO menu_items (
            id, category_id, name, price, is_veg, is_available,
            kitchen_station_id, tax_rate, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          item.id,
          cat.id,
          item.name,
          Number(item.basePrice),
          item.isVeg ? 1 : 0,
          item.isAvailable !== false ? 1 : 0,
          extended.kitchenStationId ?? null,
          taxRate,
          extended.updatedAt ?? now,
        );
      }
    }
  });
  await setMeta(MENU_CACHED_OUTLET_KEY, outletId);
  await setMeta(`menu_synced_at:${outletId}`, now);
}

export async function loadCachedMenu(outletId?: string): Promise<MenuCategory[]> {
  const cachedOutletId = await getMeta(MENU_CACHED_OUTLET_KEY);
  if (outletId && cachedOutletId && cachedOutletId !== outletId) {
    return [];
  }

  const db = await getOfflineDb();
  const categories = await db.getAllAsync<{ id: string; name: string; sort_order: number }>(
    "SELECT id, name, sort_order FROM menu_categories ORDER BY sort_order ASC",
  );
  const items = await db.getAllAsync<Record<string, unknown>>("SELECT * FROM menu_items");
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    items: items
      .filter((i) => i.category_id === c.id)
      .map((i) => ({
        id: i.id as string,
        name: i.name as string,
        basePrice: i.price as number,
        isVeg: Boolean(i.is_veg),
        isAvailable: Boolean(i.is_available),
        kitchenStationId: i.kitchen_station_id as string | null,
        categoryId: c.id,
        updatedAt: i.updated_at as string | undefined,
        taxRule: {
          cgstRate: (i.tax_rate as number) / 2,
          sgstRate: (i.tax_rate as number) / 2,
        },
      })),
  }));
}

export async function hasCachedMenu(outletId?: string): Promise<boolean> {
  const menu = await loadCachedMenu(outletId);
  return menu.some((category) => category.items.length > 0);
}

export async function cacheFloorFromApi(outletId: string, floor: FloorPlan): Promise<void> {
  const db = await getOfflineDb();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM tables");
    for (const table of floor.tables) {
      await db.runAsync(
        `INSERT INTO tables (id, floor_plan_id, number, capacity, status, pos_x, pos_y)
         VALUES (?, ?, ?, ?, ?, 0, 0)`,
        table.id,
        floor.id,
        table.number,
        table.capacity,
        table.status,
      );
    }
  });
  await setMeta(FLOOR_CACHED_OUTLET_KEY, outletId);
  await setMeta(`floor_synced_at:${outletId}`, now);
}

async function attachLocalActiveOrders(tables: FloorTable[]): Promise<FloorTable[]> {
  const db = await getOfflineDb();
  const enriched: FloorTable[] = [];

  for (const table of tables) {
    const active = await db.getFirstAsync<{
      id: string;
      order_number: string;
      status: string;
      total_amount: number;
      occurred_at: string;
    }>(
      `SELECT id, order_number, status, total_amount, occurred_at
       FROM orders
       WHERE table_id = ? AND status IN ('open', 'kot_fired')
       LIMIT 1`,
      table.id,
    );

    if (!active) {
      enriched.push(table);
      continue;
    }

    const qtyRow = await db.getFirstAsync<{ q: number }>(
      "SELECT COALESCE(SUM(quantity), 0) as q FROM order_items WHERE order_id = ?",
      active.id,
    );
    const itemQty = qtyRow?.q ?? 0;

    enriched.push({
      ...table,
      status: "seated",
      activeOrder: {
        id: active.id,
        orderNumber: active.order_number,
        status: active.status,
        totalAmount: active.total_amount,
        itemCount: itemQty,
        itemQty,
        pendingKot: 0,
        inKitchen: 0,
        kotCount: 0,
        createdAt: active.occurred_at,
        elapsedMins: 0,
      },
    });
  }

  return enriched;
}

export async function loadCachedFloor(outletId?: string): Promise<FloorTable[]> {
  const cachedOutletId = await getMeta(FLOOR_CACHED_OUTLET_KEY);
  if (outletId && cachedOutletId && cachedOutletId !== outletId) {
    return [];
  }

  const db = await getOfflineDb();
  const rows = await db.getAllAsync<{
    id: string;
    number: string;
    capacity: number;
    status: string;
  }>("SELECT id, number, capacity, status FROM tables ORDER BY number ASC");

  const tables: FloorTable[] = rows.map((row) => ({
    id: row.id,
    number: row.number,
    capacity: row.capacity,
    status: row.status,
    activeOrder: null,
  }));

  return attachLocalActiveOrders(tables);
}

export async function listLocalOpenOrderSummaries(outletId: string): Promise<OrderSummary[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllAsync<{
    id: string;
    cloud_id: string | null;
    order_number: string;
    status: string;
    type: string;
    total_amount: number;
    occurred_at: string;
    table_id: string | null;
  }>(
    `SELECT id, cloud_id, order_number, status, type, total_amount, occurred_at, table_id
     FROM orders
     WHERE outlet_id = ? AND status IN ('open', 'kot_fired')
     ORDER BY occurred_at DESC`,
    outletId,
  );

  const summaries: OrderSummary[] = [];
  for (const row of rows) {
    let tableNumber: string | undefined;
    if (row.table_id) {
      const table = await db.getFirstAsync<{ number: string }>(
        "SELECT number FROM tables WHERE id = ?",
        row.table_id,
      );
      tableNumber = table?.number;
    }

    summaries.push({
      id: row.cloud_id ?? row.id,
      orderNumber: row.order_number,
      status: row.status,
      type: row.type,
      source: "pos",
      totalAmount: row.total_amount,
      createdAt: row.occurred_at,
      table: tableNumber ? { number: tableNumber } : null,
    });
  }
  return summaries;
}

function mergeOpenOrderSummaries(
  cached: OrderSummary[],
  local: OrderSummary[],
): OrderSummary[] {
  const byId = new Map<string, OrderSummary>();
  for (const order of cached) byId.set(order.id, order);
  for (const order of local) byId.set(order.id, order);
  return [...byId.values()].sort((a, b) => {
    const ta = new Date(a.createdAt ?? 0).getTime();
    const tb = new Date(b.createdAt ?? 0).getTime();
    return tb - ta;
  });
}

export async function cacheOpenOrdersFromApi(
  outletId: string,
  orders: OrderSummary[],
): Promise<void> {
  const active = orders.filter((o) => ACTIVE_ORDER_STATUSES.has(o.status));
  await setMeta(openOrdersCacheKey(outletId), JSON.stringify(active));
  await setMeta(`open_orders_synced_at:${outletId}`, new Date().toISOString());
}

export async function loadCachedOpenOrders(outletId?: string): Promise<OrderSummary[]> {
  if (!outletId) return [];

  const raw = await getMeta(openOrdersCacheKey(outletId));
  let cached: OrderSummary[] = [];
  if (raw) {
    try {
      cached = JSON.parse(raw) as OrderSummary[];
    } catch {
      cached = [];
    }
  }

  const local = await listLocalOpenOrderSummaries(outletId);
  return mergeOpenOrderSummaries(cached, local);
}
