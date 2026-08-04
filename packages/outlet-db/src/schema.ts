import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const hubMeta = sqliteTable("hub_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const devices = sqliteTable("devices", {
  id: text("id").primaryKey(),
  outletId: text("outlet_id").notNull(),
  terminalId: text("terminal_id"),
  role: text("role").notNull(),
  deviceType: text("device_type").notNull(),
  name: text("name").notNull(),
  lanAddress: text("lan_address"),
  lastSeenAt: text("last_seen_at"),
  syncBacklog: integer("sync_backlog").default(0),
});

export const tables = sqliteTable("tables", {
  id: text("id").primaryKey(),
  floorPlanId: text("floor_plan_id").notNull(),
  number: text("number").notNull(),
  capacity: integer("capacity").default(4),
  status: text("status").default("free"),
  posX: real("pos_x").default(0),
  posY: real("pos_y").default(0),
});

export const menuCategories = sqliteTable("menu_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0),
});

export const menuItems = sqliteTable("menu_items", {
  id: text("id").primaryKey(),
  categoryId: text("category_id").notNull(),
  name: text("name").notNull(),
  price: real("price").notNull(),
  isVeg: integer("is_veg", { mode: "boolean" }).default(true),
  isAvailable: integer("is_available", { mode: "boolean" }).default(true),
  kitchenStationId: text("kitchen_station_id"),
  hsnCode: text("hsn_code"),
});

export const kitchenStations = sqliteTable("kitchen_stations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  cloudId: text("cloud_id"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  orderNumber: text("order_number").notNull(),
  outletId: text("outlet_id").notNull(),
  terminalId: text("terminal_id"),
  tableId: text("table_id"),
  source: text("source").default("dine_in"),
  type: text("type").default("dine_in"),
  status: text("status").default("open"),
  guestCount: integer("guest_count").default(1),
  subtotal: real("subtotal").default(0),
  taxAmount: real("tax_amount").default(0),
  discountAmount: real("discount_amount").default(0),
  totalAmount: real("total_amount").default(0),
  notes: text("notes"),
  synced: integer("synced", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  menuItemId: text("menu_item_id").notNull(),
  name: text("name").notNull(),
  quantity: integer("quantity").default(1),
  unitPrice: real("unit_price").notNull(),
  taxAmount: real("tax_amount").default(0),
  totalPrice: real("total_price").notNull(),
  notes: text("notes"),
  status: text("status").default("pending"),
  kotId: text("kot_id"),
});

export const kots = sqliteTable("kots", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  kitchenStationId: text("kitchen_station_id").notNull(),
  kotNumber: text("kot_number").notNull(),
  status: text("status").default("pending"),
  firedAt: text("fired_at").notNull(),
  readyAt: text("ready_at"),
});

export const kotItems = sqliteTable("kot_items", {
  id: text("id").primaryKey(),
  kotId: text("kot_id").notNull(),
  orderItemId: text("order_item_id").notNull(),
  quantity: integer("quantity").notNull(),
  status: text("status").default("pending"),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  method: text("method").notNull(),
  amount: real("amount").notNull(),
  status: text("status").default("pending"),
  reference: text("reference"),
  processedAt: text("processed_at"),
});

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().unique(),
  invoiceNumber: text("invoice_number").notNull(),
  totalAmount: real("total_amount").notNull(),
  issuedAt: text("issued_at").notNull(),
});

export const syncEvents = sqliteTable("sync_events", {
  id: text("id").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  payload: text("payload").notNull(),
  sequence: integer("sequence").notNull(),
  status: text("status").default("pending"),
  createdAt: text("created_at").notNull(),
  syncedAt: text("synced_at"),
});

export const ingredients = sqliteTable("ingredients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  currentStock: real("current_stock").default(0),
  minStock: real("min_stock").default(0),
});

export const stockLedger = sqliteTable("stock_ledger", {
  id: text("id").primaryKey(),
  ingredientId: text("ingredient_id").notNull(),
  type: text("type").notNull(),
  quantity: real("quantity").notNull(),
  balanceAfter: real("balance_after").notNull(),
  reference: text("reference"),
  createdAt: text("created_at").notNull(),
});
