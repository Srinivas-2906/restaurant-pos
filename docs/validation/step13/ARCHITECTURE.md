# Step 13 — Double-Entry Accounting Architecture

## Overview

Step 13 adds a production double-entry general ledger over Step 12 inventory events and operational business transactions. **All authoritative financial statements derive from posted `JournalEntry` + `JournalLine` records**, not from sales dashboards, stock snapshots, or supplier totals.

## Core models

| Model | Scope | Purpose |
|-------|-------|---------|
| `GlAccount` | Organization | Chart of accounts (23 default accounts) |
| `JournalEntry` | Organization (+ optional header `outletId`) | Posted journal header with provenance |
| `JournalLine` | Per line | Debit/credit with optional `outletId` dimension |
| `Expense` | Organization/outlet | Operating expense records linked to journals |
| `SupplierPayment` | Organization/outlet | AP settlement linked to journals |
| `PurchaseInvoice` | Outlet | Supplier bills (existing model, now posts to GL) |

## Chart of accounts

Deterministic codes seeded via `ensureDefaultAccounts()` / seed bootstrap:

- **Assets:** Cash (1000), Bank (1010), UPI Clearing (1020), Card Clearing (1030), AR (1100), Inventory (1200), In Transit (1210), Input CGST/SGST (2300/2310)
- **Liabilities:** AP (2000), GRNI (2100), Output CGST/SGST/IGST (2200–2220)
- **Equity:** Owner Capital (3000), Drawings (3100), Opening Balance Equity (3200)
- **Revenue:** Sales (4000), Adjustment Gain (4900)
- **Expense:** COGS (5000), Wastage (5100), Adjustment Loss (5200), Operating (5300)

## Journal invariants

1. **Balance:** `SUM(debits) = SUM(credits)` using Prisma `Decimal` (`assertBalanced`, 0.005 tolerance).
2. **Immutability:** Posted journals are not edited; corrections use reversal journals.
3. **Idempotency:** Unique `(organizationId, idempotencyKey)` — retries return existing journal.
4. **Provenance:** Every automated journal has `sourceEvent`, `sourceId`, `reference`.
5. **Posting date:** Reports use `postingDate`, not `createdAt`.

## Source event → journal mapping

| Business event | sourceEvent | Idempotency key | Journal |
|----------------|-------------|-----------------|---------|
| Opening stock | `inventory_opening` | `opening-inventory:{outletId}:{ingredientId}` | DR Inventory / CR Opening Equity |
| Order settlement | `order_settlement` | `sales:{orderId}` | DR Payment asset / CR Revenue + Output GST |
| Recipe consumption | `order_cogs` | `cogs:{orderId}` | DR COGS / CR Inventory |
| Goods receipt | `goods_receipt` | `grn:{goodsReceiptId}` | DR Inventory / CR GRNI |
| Supplier bill | `supplier_invoice` | `supplier-invoice:{id}` | DR GRNI (+ Input GST if present) / CR AP |
| Supplier payment | `supplier_payment` | `supplier-payment:{id}` | DR AP / CR Cash/Bank |
| Wastage | `inventory_wastage` | `wastage:{wastageEntryId}` | DR Wastage / CR Inventory |
| Stock adjustment (loss) | `inventory_adjustment_loss` | `adjustment:{ledgerId}` | DR Adj Loss / CR Inventory |
| Stock adjustment (gain) | `inventory_adjustment_gain` | `adjustment:{ledgerId}` | DR Inventory / CR Adj Gain |
| Stock count variance | (same as adjustment) | same | Posted on count approval |
| Transfer dispatch | `inventory_transfer_dispatch` | `transfer-dispatch:{transferId}` | DR In Transit / CR Inventory (source) |
| Transfer receive | `inventory_transfer_receive` | `transfer-receive:{transferId}` | DR Inventory (dest) / CR In Transit |
| Expense | `expense` | `expense:{expenseId}` | DR Expense / CR Cash/Bank |
| Owner capital | `owner_capital` | caller-supplied | DR Cash/Bank / CR Owner Capital |
| Owner drawing | `owner_drawing` | caller-supplied | DR Drawings / CR Cash/Bank |
| Manual journal | `manual_journal` | none | User-defined balanced lines |
| Reversal | `journal_reversal` | `reversal:{originalId}` | Opposite of original lines |

## Tax treatment

- **Sales:** Tax-exclusive menu pricing. Invoice `taxableAmount = subtotal - discount`. CGST/SGST from invoice (order tax split 50/50). Revenue journal uses net taxable amount (discount reduces revenue directly — no contra account in MVP).
- **Known limitation:** Discount does not recalculate item-level tax; invoice tax remains pre-discount order tax. Journals match invoice totals.
- **Purchases:** Input GST posted only when `PurchaseInvoice` has explicit CGST/SGST fields. No fabricated input tax.

## WAC / COGS linkage

Accounting **never recalculates** weighted average cost. COGS and inventory movements use:

- `StockLedger.totalValue` for consumption, wastage, adjustments
- GRN receipt totals from inventory engine
- Opening stock ledger values for opening journals

## GRNI / AP flow

1. **PO sent:** No GL impact (PO-OPEN-001 verified).
2. **GRN received:** DR Inventory / CR GRNI.
3. **Supplier bill:** DR GRNI (+ input GST) / CR AP — no second inventory asset post.
4. **Payment:** DR AP / CR Cash/Bank.

**PO-REC-001:** Display-only received PO; opening stock is authoritative. No duplicate inventory posting.

## Expense flow

`POST /accounting/expenses` creates `Expense` + journal: DR Operating Expense (5300 default) / CR payment asset.

## Capital / drawings

Owner capital and drawings post via manual-journal-gated endpoints. **Not P&L items.**

## Reports (journal-derived)

| Report | Formula |
|--------|---------|
| Trial Balance | Sum debits/credits per account through `postingDate`; must balance |
| P&L | Revenue (credit − debit) and Expense (debit − credit) for date range |
| Balance Sheet | Asset/Liability/Equity TB rows + retained earnings = cumulative P&L through as-of |
| General Ledger | Account ledger with running balance by normal balance rules |

**Retained earnings:** Computed at report time from cumulative P&L (no formal period close yet).

**Cash Flow:** Deferred — activity classification not reliable enough for authoritative statement.

## Reconciliation

`GET /accounting/reconcile` validates:

- Trial balance balanced
- Balance sheet equation (Assets = Liabilities + Equity)
- Inventory GL vs ingredient valuation (WAC × currentStock)

## Consistency strategy

Business events and GL posting share PostgreSQL. Inventory/order settlement posts accounting **in the same request flow** after domain success. Failures throw — no silent swallow. Automated posting is **not gated** by finance UI capability; finance module gates read/UI access only.

## Authorization

- **Read reports / COA / journal:** owner, manager, accountant (+ finance module)
- **Write (expense, manual journal, capital):** owner, accountant/manager; operational staff denied
- **Tenant isolation:** All queries scoped by `organizationId` from JWT

## Known limitations

- No GSTR filing, e-invoice, TDS, payroll journals
- No settled-order refund/reversal workflow (document only)
- Split tender: supported if Payment domain provides multiple payments; no new split-payment feature added
- Discount/tax recalculation on discounted orders incomplete (Step 8 semantics)
- Formal fiscal period locking / year-end close deferred
- IGST input posting blocked in MVP
- Cash Flow statement not implemented

## Seed behavior

After inventory reset, accounting journals are cleared. Bootstrap creates default COA + one opening inventory journal per `opening_stock` ledger row. Running seed twice produces identical opening journals (idempotent keys).
