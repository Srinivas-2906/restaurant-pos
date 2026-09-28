import * as SQLite from "expo-sqlite";
import { CURRENT_SCHEMA_VERSION, MIGRATIONS } from "./schema";

let dbInstance: SQLite.SQLiteDatabase | null = null;
let openPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getOfflineDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (openPromise) return openPromise;

  openPromise = (async () => {
    const db = await SQLite.openDatabaseAsync("kaana_pos_offline.db");
    await runMigrations(db);
    dbInstance = db;
    return db;
  })();

  return openPromise;
}

export async function closeOfflineDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
    openPromise = null;
  }
}

/** Test helper — reset DB between tests */
export async function resetOfflineDbForTests(): Promise<void> {
  await closeOfflineDb();
  const db = await SQLite.openDatabaseAsync("kaana_pos_offline.db");
  await db.execAsync("DROP TABLE IF EXISTS _migrations");
  const tables = [
    "hub_meta", "menu_categories", "menu_items", "tables", "pos_config",
    "staff_offline", "orders", "order_items", "kots", "payments",
    "sync_outbox", "sync_conflicts", "id_map",
  ];
  for (const t of tables) {
    await db.execAsync(`DROP TABLE IF EXISTS ${t}`);
  }
  await db.closeAsync();
  dbInstance = null;
  openPromise = null;
}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`CREATE TABLE IF NOT EXISTS _migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const applied = await db.getAllAsync<{ version: number }>(
    "SELECT version FROM _migrations ORDER BY version ASC",
  );
  const appliedSet = new Set(applied.map((r) => r.version));

  for (const migration of MIGRATIONS) {
    if (appliedSet.has(migration.version)) continue;
    await db.withTransactionAsync(async () => {
      for (const stmt of migration.sql) {
        await db.execAsync(stmt);
      }
      await db.runAsync(
        "INSERT INTO _migrations (version, applied_at) VALUES (?, ?)",
        migration.version,
        new Date().toISOString(),
      );
    });
  }

  await db.runAsync(
    "INSERT OR REPLACE INTO hub_meta (key, value) VALUES (?, ?)",
    "schema_version",
    String(CURRENT_SCHEMA_VERSION),
  );
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM hub_meta WHERE key = ?",
    key,
  );
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO hub_meta (key, value) VALUES (?, ?)",
    key,
    value,
  );
}
