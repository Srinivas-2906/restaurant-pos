# Step 15 — Production Offline-First POS Architecture

## Audit: Existing Packages

### @kaana/outlet-db (REAL — Node reference)
- Drizzle schema mirroring cloud Order/KOT/Payment domain
- `better-sqlite3` bootstrap — **not React Native compatible**
- Inline `CREATE IF NOT EXISTS` — no versioned migrations
- Used by `apps/outlet-hub` as the reference offline implementation
- **Reuse:** schema shape, idempotencyKey on orders, sync_events outbox pattern

### @kaana/sync-protocol (REAL — types only)
- `SyncEventEnvelope`, `SyncBatchRequest/Response`, `SYNC_CONFLICT_RULES`
- `createSyncEvent()`, `validateIdempotencyKey()`
- **Extended in Step 15:** `PosCommandType`, `PosCommandEnvelope`, `PosSyncBatchRequest/Response`

### @kaana/sync-engine (PARTIAL — web localStorage)
- `OfflineSyncQueue` uses `localStorage` — unsuitable for RN
- **Extended in Step 15:** `PersistentOutboxStore` interface + retry/backoff helpers
- Mobile implements `PersistentOutboxStore` via expo-sqlite

### @kaana/device-bridge (STUB)
- ESC/POS console driver only — not used for Step 15

### kaana-mobile POS (pre-Step 15)
- Online-only: REST + Socket.IO
- Employee JWT in memory — PIN required after restart
- No SQLite, no offline queue

## Final Architecture Decision

**Model A — Local-first writes (chosen)**

All POS mutations write to local SQLite + outbox atomically, then a background sync worker pushes when API is reachable. Online UX remains immediate because local write is synchronous; sync is async.

Cloud PostgreSQL remains authoritative. Local DB holds:
1. Cached server snapshots (menu, floor, capabilities, staff)
2. Locally-created pending business state
3. Durable sync outbox
4. Conflict/reconciliation records

## Local Database (expo-sqlite)

Schema mirrors `@kaana/outlet-db` subset plus mobile-specific tables:

| Table | Purpose |
|-------|---------|
| `_migrations` | Versioned schema migrations (never wipe on upgrade) |
| `hub_meta` | sync checkpoint, last menu sync, DB version |
| `menu_categories`, `menu_items` | Structured menu cache |
| `tables` | Floor cache |
| `pos_config` | Capabilities snapshot + offline grace metadata |
| `staff_offline` | Server-verified staff snapshot for offline PIN |
| `orders`, `order_items`, `kots`, `payments` | Local order domain |
| `sync_outbox` | Persistent command queue |
| `sync_conflicts` | Structured conflicts (table, version, etc.) |
| `id_map` | localEntityId → serverEntityId |

Migrations: v1 base schema, applied incrementally. Pending outbox rows survive migration.

## Client Identity

- **localOrderId** — UUID generated on device at create time; never changes
- **idempotencyKey** — stable per operation (`create:{localOrderId}`, `settle:{localOrderId}`, `kot:{localOrderId}:{batchSeq}`)
- Same key on retry → exactly one cloud effect via `PosSyncCommand` server table

## Server ID Mapping

After CREATE_ORDER ack:
- `id_map` stores `localOrderId → serverOrderId`
- Dependent commands (ADD_ITEM, FIRE_KOT, SETTLE) resolve server ID through mapping
- Order also stores `clientOrderId` on server for lookup

## Outbox

Each row: id, operationType, aggregateId, idempotencyKey, payload (JSON), sequence, status, attempts, lastAttemptAt, lastError, staffProfileId, terminalId, occurredAt.

States: `pending` | `syncing` | `acked` | `conflict` | `failed`

Failed/conflicted rows are never deleted automatically.

## Command Ordering

Per-order aggregate sequencing via monotonic `sequence` on outbox rows. Sync worker processes in sequence order per `aggregateId`. Independent orders sync in parallel.

## Offline Authentication

**Security model:**
- Terminal activation credential remains in SecureStore (unchanged)
- On successful online PIN login, server returns staff snapshot + issues device-bound offline verifier
- Mobile stores HMAC-SHA256(deviceSecret, pin) as verifier — **never plaintext PIN**
- `offlineAuthValidUntil` — 72 hours from last online auth (configurable)
- Staff snapshot includes role, permissions, staffProfileId
- Local PIN attempts rate-limited (5 failures → 15 min lockout)
- On reconnect: immediate online revalidation of employee + terminal
- Only staff who authenticated online on this device within validity window may login offline

## Cached Data

**Menu:** categories, items, prices, tax metadata, availability, kitchen station refs — refreshed on online bootstrap and post-sync pull.

**Floor:** tables with last-known status; offline dine-in uses cache; local table occupancy marked optimistically.

**Capabilities:** last `/capabilities/me` snapshot; offline grace allows previously authorized POS for bounded period; server wins on reconnect.

## Price/Tax Snapshot Policy

Order items store at creation time:
- menuItemId, name, unitPrice, taxAmount, taxRate, menuItemUpdatedAt, configVersion
- Server sync validates item existed and price was within tolerance of cached menu at `occurredAt`
- Completed offline sale **never repriced** — snapshot is authoritative for that transaction
- Server accepts with provenance metadata; future sales use refreshed menu

## Offline KOT

Local KOT record + `FIRE_KOT` outbox command. UI: "Kitchen send pending". Remote KDS does not receive until cloud sync (Step 16 boundary). Idempotency via `kot:{localOrderId}:{batchNumber}`.

## Offline Settlement

Supported tenders offline:
- **Cash** — fully supported
- **UPI/Card** — manual tender classification only (no gateway authorization claimed)

Settlement creates local payment + marks order settled + frees local table + enqueues SETTLE command with stable idempotency key.

## Invoice/KOT Numbering

Offline uses local display numbers (`LOCAL-ORD-xxx`, `LOCAL-KOT-xxx`). Server assigns authoritative numbers on sync. Receipt shows local number + "Pending sync" until ack.

## Sync Engine Flow (Reconnect)

1. Validate device/session (online)
2. Push pending outbox (bounded batches of 20)
3. Record conflicts; do not overwrite unsynced local state
4. Pull menu, floor, capabilities, open orders
5. Merge acks into id_map; update local synced flags
6. Update sync checkpoint

Retry: exponential backoff + jitter for 5xx/network; 401/403 → auth attention; 409 → conflict; 400 → failed/needs attention.

## Conflict Policy

| Scenario | Behavior |
|----------|----------|
| Table occupied on server | Structured conflict; options: move table, convert takeaway, manual resolve |
| Server order version mismatch | Optimistic concurrency conflict |
| Menu item removed | Preserve snapshot sale |
| Negative stock on sync | Preserve commercial order; flag inventory reconciliation exception |
| Terminal/employee revoked on reconnect | Block new ops; preserve pending records |

## Revocation While Offline

Server cannot instantly revoke disconnected terminal. Bounded offline authorization applies. On reconnect: revocation detected → block further sync/business → preserve local unsynced records → admin recovery path.

## Accounting & Inventory

No local accounting posting. No authoritative offline inventory. Server commit/consume/release on sync via existing Step 12 domain. Post-sync reconciliation expected 0 delta.

## Business Date / occurredAt

All offline commands carry `occurredAt` (client business time, outlet timezone). Server uses for posting date per Step 13 semantics — not sync timestamp.

## Known Step 16/17 Boundaries (Acceptable)

- KDS on another device does not see offline KOT until connectivity returns
- Captain offline coordination deferred
- Physical printing deferred
- Instant cloud revocation impossible while disconnected
