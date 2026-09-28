export const MIGRATIONS: Array<{ version: number; sql: string[] }> = [
  {
    version: 1,
    sql: [
      `CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS hub_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS menu_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        is_veg INTEGER DEFAULT 1,
        is_available INTEGER DEFAULT 1,
        kitchen_station_id TEXT,
        tax_rate REAL DEFAULT 0,
        updated_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS tables (
        id TEXT PRIMARY KEY,
        floor_plan_id TEXT,
        number TEXT NOT NULL,
        capacity INTEGER DEFAULT 4,
        status TEXT DEFAULT 'free',
        pos_x REAL DEFAULT 0,
        pos_y REAL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS pos_config (
        id TEXT PRIMARY KEY DEFAULT 'default',
        capabilities_json TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        offline_grace_until TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS staff_offline (
        staff_profile_id TEXT PRIMARY KEY,
        employee_code TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL,
        permissions_json TEXT NOT NULL,
        pin_verifier TEXT NOT NULL,
        offline_auth_valid_until TEXT NOT NULL,
        verified_at TEXT NOT NULL,
        failed_attempts INTEGER DEFAULT 0,
        locked_until TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        cloud_id TEXT,
        idempotency_key TEXT NOT NULL UNIQUE,
        order_number TEXT NOT NULL,
        outlet_id TEXT NOT NULL,
        terminal_id TEXT,
        table_id TEXT,
        type TEXT DEFAULT 'takeaway',
        source TEXT DEFAULT 'pos',
        status TEXT DEFAULT 'open',
        guest_count INTEGER DEFAULT 1,
        subtotal REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        total_amount REAL DEFAULT 0,
        notes TEXT,
        sync_status TEXT DEFAULT 'pending',
        staff_profile_id TEXT,
        employee_code TEXT,
        occurred_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        menu_item_id TEXT NOT NULL,
        name TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        unit_price REAL NOT NULL,
        tax_amount REAL DEFAULT 0,
        tax_rate REAL DEFAULT 0,
        total_price REAL NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'pending',
        kot_id TEXT,
        menu_item_updated_at TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )`,
      `CREATE TABLE IF NOT EXISTS kots (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        kitchen_station_id TEXT,
        kot_number TEXT NOT NULL,
        batch_seq INTEGER DEFAULT 1,
        status TEXT DEFAULT 'pending_sync',
        fired_at TEXT NOT NULL,
        sync_status TEXT DEFAULT 'pending',
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )`,
      `CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        method TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'completed',
        reference TEXT,
        processed_at TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )`,
      `CREATE TABLE IF NOT EXISTS sync_outbox (
        id TEXT PRIMARY KEY,
        operation_type TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        local_entity_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        payload_json TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        last_attempt_at TEXT,
        last_error TEXT,
        staff_profile_id TEXT NOT NULL,
        employee_code TEXT NOT NULL,
        terminal_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS sync_conflicts (
        id TEXT PRIMARY KEY,
        outbox_id TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        conflict_code TEXT NOT NULL,
        message TEXT NOT NULL,
        server_state_json TEXT,
        resolution_options_json TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS id_map (
        local_id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        mapped_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON sync_outbox(status, sequence)`,
      `CREATE INDEX IF NOT EXISTS idx_sync_outbox_aggregate ON sync_outbox(aggregate_id, sequence)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_sync ON orders(sync_status)`,
    ],
  },
];

export const CURRENT_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 1;
