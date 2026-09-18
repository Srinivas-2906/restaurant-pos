# Step 12 — Inventory & Procurement Architecture

## Authoritative stock model

| Concept | Source | Notes |
|---------|--------|-------|
| **On-hand** | `Ingredient.currentStock` | Updated only via `writeLedger()` |
| **Committed** | `Ingredient.committedStock` | KOT reservations via `StockCommitment` |
| **Available** | `currentStock - committedStock` | Used for low-stock dashboard and menu availability |
| **Movement history** | `StockLedger` | Append-only; corrections via new adjustment rows |
| **Location balance** | `InventoryBalance` | Upserted alongside ledger writes |

**Invariant:** For each ingredient, sum of non-zero ledger quantities (excluding `committed_out` / `commit_release`) must equal `currentStock`. Available = on-hand minus committed.

## Units

- **Stock/base unit:** `Ingredient.unit` (e.g. kg, L, pcs)
- **Consumption unit:** `Ingredient.consumptionUnit` (e.g. g, ml) with `stockToConsumptionFactor`
- **Purchase unit:** `Ingredient.purchaseUnit` with `purchaseToStockFactor`
- Conversions: `@kaana/inventory-core` supports weight (kg↔g), volume (L↔ml), count (piece↔dozen), custom package factors
- No cross-dimension conversion (weight→volume blocked)

## Purchase lifecycle (`POStatus`)

```
draft → sent → partial → received
         ↘ cancelled (any time before fully received)
```

- `pending_approval` exists in schema but is unused
- Receive allowed only from `sent` or `partial`
- Cancel blocked when fully `received`; partial receipts remain in ledger

## GRN / receiving

- Each receive creates a `GoodsReceipt` + `GoodsReceiptLine` rows
- Stock-in via ledger type `purchase`
- **Idempotency:** optional `idempotencyKey` on receive body; ledger reference `idempotent:{poId}:{key}:{ingredientId}`
- Fully received PO returns idempotently on retry without key
- **Over-receive:** rejected when `alreadyReceived + qty > ordered`

## Inventory costing

- **Weighted average cost (WAC)** updated on each receipt via `updateCostOnReceipt`
- Fields: `weightedAverageCost`, `lastPurchaseCost`, `costPerUnit` on `Ingredient`
- No FIFO / GL posting (Step 13 scope)

## Negative stock policy

Per-ingredient `negativeStockPolicy`: `block` | `warn` | `allow`

- `block`: reject mutations that would go negative
- `warn`: clamp to zero (legacy default behavior)
- `allow`: permit negative on-hand

## Ledger event types (canonical)

`opening_stock`, `purchase`, `purchase_return`, `recipe_consumption`, `sale`, `committed_out`, `commit_release`, `wastage`, `transfer_in`, `transfer_out`, `stock_count_adjustment`, `adjustment`, `production_consumption`, `production_output`, plus specialty types (`expiry_writeoff`, `staff_meal`, etc.)

## Permissions

| Role | Read | Mutate |
|------|------|--------|
| owner, manager, inventory_manager | ✓ | ✓ |
| accountant | ✓ | invoices only |
| biller, chef | read-only | ✗ |
| operational JWT | read where role allows | ✗ (403) |

## Capability gating

- Module: `inventory` — all endpoints
- Feature: `procurement.purchase_orders` — PO/GRN flows
- Feature: `inventory.stock_transfer` — transfer create/dispatch/receive

## Stock count

`StockCount` → `in_progress` → lines updated → `approveStockCount` posts `stock_count_adjustment` ledger entries → `posted`. Idempotent approve.

## Transfers

`CentralKitchenTransfer`: `requested` → dispatch → `in_transit` → receive → `received`. Dispatch/receive idempotent via unique ledger references per line.

## Reconciliation

`GET /inventory/outlets/:outletId/reconcile` replays ledger sums vs `currentStock` for all active ingredients.
