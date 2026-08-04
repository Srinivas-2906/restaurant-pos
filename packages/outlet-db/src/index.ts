import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

export * from "./schema";

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS hub_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY, outlet_id TEXT NOT NULL, terminal_id TEXT, role TEXT NOT NULL,
  device_type TEXT NOT NULL, name TEXT NOT NULL, lan_address TEXT,
  last_seen_at TEXT, sync_backlog INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY, floor_plan_id TEXT NOT NULL, number TEXT NOT NULL,
  capacity INTEGER DEFAULT 4, status TEXT DEFAULT 'free', pos_x REAL DEFAULT 0, pos_y REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS menu_categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, sort_order INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY, category_id TEXT NOT NULL, name TEXT NOT NULL, price REAL NOT NULL,
  is_veg INTEGER DEFAULT 1, is_available INTEGER DEFAULT 1, kitchen_station_id TEXT, hsn_code TEXT
);
CREATE TABLE IF NOT EXISTS kitchen_stations (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, cloud_id TEXT, idempotency_key TEXT NOT NULL UNIQUE, order_number TEXT NOT NULL,
  outlet_id TEXT NOT NULL, terminal_id TEXT, table_id TEXT, source TEXT DEFAULT 'dine_in',
  type TEXT DEFAULT 'dine_in', status TEXT DEFAULT 'open', guest_count INTEGER DEFAULT 1,
  subtotal REAL DEFAULT 0, tax_amount REAL DEFAULT 0, discount_amount REAL DEFAULT 0, total_amount REAL DEFAULT 0,
  notes TEXT, synced INTEGER DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL, menu_item_id TEXT NOT NULL, name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1, unit_price REAL NOT NULL, tax_amount REAL DEFAULT 0,
  total_price REAL NOT NULL, notes TEXT, status TEXT DEFAULT 'pending', kot_id TEXT
);
CREATE TABLE IF NOT EXISTS kots (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL, kitchen_station_id TEXT NOT NULL,
  kot_number TEXT NOT NULL, status TEXT DEFAULT 'pending', fired_at TEXT NOT NULL, ready_at TEXT
);
CREATE TABLE IF NOT EXISTS kot_items (
  id TEXT PRIMARY KEY, kot_id TEXT NOT NULL, order_item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL, status TEXT DEFAULT 'pending'
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL, method TEXT NOT NULL, amount REAL NOT NULL,
  status TEXT DEFAULT 'pending', reference TEXT, processed_at TEXT
);
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE, invoice_number TEXT NOT NULL,
  total_amount REAL NOT NULL, issued_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_events (
  id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL, action TEXT NOT NULL, payload TEXT NOT NULL, sequence INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', created_at TEXT NOT NULL, synced_at TEXT
);
CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, unit TEXT NOT NULL,
  current_stock REAL DEFAULT 0, min_stock REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS stock_ledger (
  id TEXT PRIMARY KEY, ingredient_id TEXT NOT NULL, type TEXT NOT NULL, quantity REAL NOT NULL,
  balance_after REAL NOT NULL, reference TEXT, created_at TEXT NOT NULL
);
`;

export function createOutletDb(dbPath: string) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(MIGRATION_SQL);
  return drizzle(sqlite, { schema });
}

export type OutletDatabase = ReturnType<typeof createOutletDb>;
