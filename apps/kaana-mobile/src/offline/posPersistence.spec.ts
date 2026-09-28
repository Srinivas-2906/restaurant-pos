import Database from "../../../../packages/outlet-db/node_modules/better-sqlite3/lib/index.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import { MIGRATIONS } from "./schema";

function migrateDb(db: Database.Database) {
  for (const migration of MIGRATIONS) {
    for (const stmt of migration.sql) {
      db.exec(stmt);
    }
  }
}

describe("offline settlement persistence", () => {
  let dbPath: string;
  let db: Database.Database;

  afterEach(() => {
    db?.close();
    if (dbPath) rmSync(dbPath, { force: true });
  });

  it("survives DB close/reopen with order, items, kots, payment, and pending outbox", () => {
    dbPath = join(mkdtempSync(join(tmpdir(), "kaana-persist-")), "offline.db");
    const orderId = "order-local-1";
    const now = "2026-09-09T08:17:11.317Z";

    db = new Database(dbPath);
    migrateDb(db);

    db.prepare(
      `INSERT INTO orders (
        id, idempotency_key, order_number, outlet_id, type, status, subtotal, tax_amount,
        total_amount, sync_status, occurred_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(orderId, `create:${orderId}`, "LOCAL-00001", "outlet-1", "takeaway", "settled", 1000, 0, 1000, "pending", now, now, now);

    db.prepare(
      `INSERT INTO order_items (
        id, order_id, menu_item_id, name, quantity, unit_price, tax_amount, tax_rate, total_price, status, kot_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("item-1", orderId, "menu-1", "Chicken Biryani", 1, 300, 0, 0, 300, "kot_fired", "kot-1");

    db.prepare(
      `INSERT INTO kots (id, order_id, kot_number, batch_seq, status, fired_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("kot-1", orderId, "LOCAL-KOT-001", 1, "pending_sync", now, "pending");

    db.prepare(
      `INSERT INTO payments (id, order_id, method, amount, status, processed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("pay-1", orderId, "cash", 1000, "completed", now);

    db.prepare(
      `INSERT INTO sync_outbox (
        id, operation_type, aggregate_id, local_entity_id, idempotency_key, payload_json,
        sequence, status, staff_profile_id, employee_code, terminal_id, occurred_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "out-1",
      "SETTLE",
      orderId,
      orderId,
      `settle:${orderId}`,
      "{}",
      1,
      "pending",
      "staff-1",
      "EMP001",
      "term-1",
      now,
      now,
    );

    db.close();

    db = new Database(dbPath);
    const order = db.prepare("SELECT status, total_amount FROM orders WHERE id = ?").get(orderId) as {
      status: string;
      total_amount: number;
    };
    const item = db.prepare("SELECT name, quantity FROM order_items WHERE order_id = ?").get(orderId) as {
      name: string;
      quantity: number;
    };
    const kotCount = db.prepare("SELECT COUNT(*) as c FROM kots WHERE order_id = ?").get(orderId) as {
      c: number;
    };
    const payment = db.prepare("SELECT method, amount FROM payments WHERE order_id = ?").get(orderId) as {
      method: string;
      amount: number;
    };
    const outboxPending = db
      .prepare("SELECT COUNT(*) as c FROM sync_outbox WHERE status IN ('pending', 'failed', 'syncing')")
      .get() as { c: number };

    expect(order.status).toBe("settled");
    expect(order.total_amount).toBe(1000);
    expect(item.name).toBe("Chicken Biryani");
    expect(item.quantity).toBe(1);
    expect(kotCount.c).toBe(1);
    expect(payment.method).toBe("cash");
    expect(payment.amount).toBe(1000);
    expect(outboxPending.c).toBe(1);
  });
});
