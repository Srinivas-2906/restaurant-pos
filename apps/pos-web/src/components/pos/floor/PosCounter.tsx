"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChefHat,
  Clock,
  Loader2,
  Minus,
  Plus,
  Receipt,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { api, getOutletId, getUser, TABLE_PHASE_STYLES } from "@/lib/api";
import { BillPrintSheet, type ProformaBill } from "./BillPrintSheet";
import { PaymentModal } from "./PaymentModal";
import { Toast } from "./Toast";
import { deriveTablePhase, formatElapsed, phaseLabel, type TablePhase } from "./tablePhase";
import {
  formatInr,
  itemPrice,
  money,
  type Category,
  type FloorPlan,
  type MenuItem,
  type Order,
  type TableWithOrder,
} from "./types";

function VegMark({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 rounded-sm border-2 shrink-0 ${
        isVeg ? "border-emerald-600" : "border-red-600"
      }`}
      title={isVeg ? "Vegetarian" : "Non-vegetarian"}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? "bg-emerald-600" : "bg-red-600"}`} />
    </span>
  );
}

function FloorLegend() {
  const phases: TablePhase[] = ["free", "ordering", "kitchen", "bill_printed", "reserved"];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
      {phases.map((phase) => {
        const style = TABLE_PHASE_STYLES[phase];
        return (
          <span key={phase} className="inline-flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-full ${style.dot}`} />
            {phaseLabel(phase)}
          </span>
        );
      })}
    </div>
  );
}

function TableOrderSummary({ order }: { order: NonNullable<TableWithOrder["activeOrder"]> }) {
  return (
    <div className="w-full mt-2 pt-2 border-t border-black/10 space-y-1">
      <p className="text-sm font-bold text-slate-900">{formatInr(order.totalAmount)}</p>
      <p className="text-[11px] text-slate-600">
        {order.itemQty} items · {formatElapsed(order.elapsedMins)}
      </p>
      <div className="flex flex-wrap gap-1">
        {order.pendingKot > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-200 text-orange-900">
            {order.pendingKot} not sent
          </span>
        )}
        {order.inKitchen > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
            {order.inKitchen} in kitchen
          </span>
        )}
      </div>
    </div>
  );
}

export function PosCounter() {
  const outletId = getOutletId() || "";
  const user = getUser();

  const [floor, setFloor] = useState<FloorPlan | null>(null);
  const [menu, setMenu] = useState<Category[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableWithOrder | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [activeCategory, setActiveCategory] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" }>({ msg: "", type: "ok" });
  const [showPay, setShowPay] = useState(false);
  const [billToPrint, setBillToPrint] = useState<ProformaBill | null>(null);
  const [clockRecordId, setClockRecordId] = useState<string | null>(null);

  const notify = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "ok" }), 3500);
  };

  const loadFloorAndMenu = useCallback(async () => {
    if (!outletId) return;
    const [floorData, menuData] = await Promise.all([
      api<FloorPlan | null>(`/outlets/${outletId}/floor`),
      api<Array<{ categories: Category[] }>>(`/outlets/${outletId}/menu`),
    ]);
    setFloor(floorData);
    const cats = menuData[0]?.categories ?? [];
    setMenu(cats);
    if (cats[0] && !activeCategory) setActiveCategory(cats[0].id);
  }, [outletId, activeCategory]);

  useEffect(() => {
    if (!outletId) {
      setLoading(false);
      return;
    }
    loadFloorAndMenu()
      .catch((e) => notify(e.message, "err"))
      .finally(() => setLoading(false));
  }, [outletId, loadFloorAndMenu]);

  useEffect(() => {
    if (!outletId || selectedTable) return;
    const interval = setInterval(() => {
      loadFloorAndMenu().catch(() => undefined);
    }, 20_000);
    return () => clearInterval(interval);
  }, [outletId, selectedTable, loadFloorAndMenu]);

  const refreshOrder = useCallback(async (orderId: string) => {
    const updated = await api<Order>(`/orders/${orderId}`);
    setOrder(updated);
    return updated;
  }, []);

  async function openTable(table: TableWithOrder) {
    if (busy) return;
    setBusy(true);
    try {
      setSelectedTable(table);
      let existing = null;
      if (table.status !== "free") {
        existing = await api<Order | null>(
          `/orders/open/by-table?outletId=${outletId}&tableId=${table.id}`,
        );
      }
      if (existing) {
        setOrder(existing);
        notify(`Resumed ${existing.orderNumber}`);
      } else {
        const created = await api<Order>("/orders", {
          method: "POST",
          body: JSON.stringify({ outletId, tableId: table.id, type: "dine_in", guestCount: table.capacity }),
        });
        setOrder(created);
        notify(`Order ${created.orderNumber} opened`);
      }
      await loadFloorAndMenu();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not open table", "err");
      setSelectedTable(null);
      setOrder(null);
    } finally {
      setBusy(false);
    }
  }

  async function addItem(item: MenuItem) {
    if (!order || busy || !item.isAvailable) return;
    setBusy(true);
    try {
      await api(`/orders/${order.id}/items`, {
        method: "POST",
        body: JSON.stringify({ menuItemId: item.id, quantity: 1 }),
      });
      await refreshOrder(order.id);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not add item", "err");
    } finally {
      setBusy(false);
    }
  }

  async function changeQty(itemId: string, delta: number, currentQty: number) {
    if (!order || busy) return;
    setBusy(true);
    try {
      await api(`/orders/${order.id}/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: currentQty + delta }),
      });
      await refreshOrder(order.id);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not update quantity", "err");
    } finally {
      setBusy(false);
    }
  }

  async function removeLine(itemId: string) {
    if (!order || busy) return;
    setBusy(true);
    try {
      await api(`/orders/${order.id}/items/${itemId}`, { method: "DELETE" });
      await refreshOrder(order.id);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not remove item", "err");
    } finally {
      setBusy(false);
    }
  }

  async function fireKOT() {
    if (!order || busy) return;
    const pending = order.items.filter((i) => !i.kotId);
    if (pending.length === 0) {
      notify("All items already sent to kitchen", "err");
      return;
    }
    setBusy(true);
    try {
      const kots = await api<Array<{ kotNumber: string }>>(`/orders/${order.id}/kot`, { method: "POST" });
      await refreshOrder(order.id);
      notify(`Sent to kitchen · ${kots.map((k) => k.kotNumber).join(", ")}`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "KOT failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function printBill() {
    if (!order || busy) return;
    setBusy(true);
    try {
      const result = await api<{ bill: ProformaBill; order: Order }>(`/orders/${order.id}/print-bill`, {
        method: "POST",
      });
      setOrder(result.order);
      setBillToPrint(result.bill);
      notify(result.bill.isReprint ? "Bill reprinted" : "Bill printed — hand to customer before payment");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Print bill failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function settle(payments: Array<{ method: string; amount: number }>) {
    if (!order) return;
    const result = await api<{ invoice: { invoiceNumber: string } }>(`/orders/${order.id}/settle`, {
      method: "POST",
      body: JSON.stringify({ payments }),
    });
    setShowPay(false);
    notify(`Payment complete · ${result.invoice.invoiceNumber}`);
    setOrder(null);
    setSelectedTable(null);
    await loadFloorAndMenu();
  }

  async function clockIn() {
    const userId = user?.id ?? localStorage.getItem("userId");
    if (!userId || !outletId) return;
    try {
      const rec = await api<{ id: string }>("/staff/clock-in", {
        method: "POST",
        body: JSON.stringify({ outletId, userId, source: "pos" }),
      });
      setClockRecordId(rec.id);
      notify("Shift started");
    } catch {
      notify("Clock-in failed", "err");
    }
  }

  async function clockOut() {
    if (!clockRecordId) return;
    try {
      await api(`/staff/clock-out/${clockRecordId}`, { method: "POST" });
      setClockRecordId(null);
      notify("Shift ended");
    } catch {
      notify("Clock-out failed", "err");
    }
  }

  const allItems = useMemo(() => menu.flatMap((c) => c.items.map((i) => ({ ...i, categoryName: c.name }))), [menu]);

  const filteredItems = useMemo(() => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return allItems.filter((i) => i.name.toLowerCase().includes(q));
    }
    const cat = menu.find((c) => c.id === activeCategory);
    return (cat?.items ?? []).map((i) => ({ ...i, categoryName: cat?.name }));
  }, [menu, activeCategory, search, allItems]);

  const tableStats = useMemo(() => {
    const tables = (floor?.tables ?? []) as TableWithOrder[];
    return {
      free: tables.filter((t) => deriveTablePhase(t) === "free").length,
      active: tables.filter((t) => t.activeOrder).length,
      billPrinted: tables.filter((t) => deriveTablePhase(t) === "bill_printed").length,
      total: tables.length,
    };
  }, [floor]);

  const pendingCount = order?.items.filter((i) => !i.kotId).length ?? 0;
  const firedCount = order?.items.filter((i) => i.kotId).length ?? 0;
  const itemCount = order?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;

  if (!outletId) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-8">
        <p className="text-slate-500 text-center max-w-sm">
          No outlet assigned. Sign in again at the login portal as counter staff with an outlet role.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!selectedTable || !order) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-56px)] bg-surface">
        <div className="px-5 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Dining floor</h2>
            <p className="text-sm text-slate-500">
              {floor?.name ?? "Main hall"} · {tableStats.free} free · {tableStats.active} active
              {tableStats.billPrinted > 0 ? ` · ${tableStats.billPrinted} awaiting payment` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {clockRecordId ? (
              <button type="button" onClick={clockOut} className="pos-chip flex items-center gap-1.5 !py-2 !px-3">
                <Clock className="w-3.5 h-3.5" /> End shift
              </button>
            ) : (
              <button type="button" onClick={clockIn} className="pos-chip flex items-center gap-1.5 !py-2 !px-3 !bg-emerald-50 !text-emerald-700 hover:!bg-emerald-100">
                <Clock className="w-3.5 h-3.5" /> Start shift
              </button>
            )}
          </div>
        </div>

        <div className="px-5 py-3 bg-white/80 border-b border-slate-100">
          <FloorLegend />
        </div>

        <div className="flex-1 p-5 overflow-auto relative">
          {busy && (
            <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-kaana animate-spin" />
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {((floor?.tables ?? []) as TableWithOrder[]).map((t) => {
              const phase = deriveTablePhase(t);
              const style = TABLE_PHASE_STYLES[phase] ?? TABLE_PHASE_STYLES.blocked;
              const clickable = phase !== "blocked" && phase !== "reserved";
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={!clickable || busy}
                  onClick={() => openTable(t)}
                  className={`pos-table-card ${style.card} ring-1 ${style.ring} text-left items-stretch ${
                    clickable ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : "opacity-60 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-start justify-between w-full">
                    <span className="text-2xl font-bold text-slate-900">{t.number}</span>
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${style.dot}`} />
                  </div>
                  <span className={`text-xs font-semibold mt-1 capitalize ${style.label}`}>{phaseLabel(phase)}</span>
                  {!t.activeOrder && (
                    <span className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {t.capacity} seats
                    </span>
                  )}
                  {t.activeOrder && <TableOrderSummary order={t.activeOrder} />}
                </button>
              );
            })}
          </div>
        </div>
        <BillPrintSheet bill={billToPrint} onPrinted={() => setBillToPrint(null)} />
        <Toast message={toast.msg} type={toast.type} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)] bg-slate-100 relative">
      {busy && (
        <div className="absolute inset-0 bg-black/10 z-20 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-xl px-4 py-3 shadow-lg flex items-center gap-2 text-sm font-medium text-slate-700">
            <Loader2 className="w-4 h-4 animate-spin text-kaana" /> Updating…
          </div>
        </div>
      )}

      {/* Order header */}
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => { setSelectedTable(null); setOrder(null); loadFloorAndMenu(); }}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 px-2 py-1.5 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4" /> Floor
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <p className="font-semibold text-slate-900">
              Table {selectedTable.number}
              <span className="text-slate-400 font-normal mx-2">·</span>
              <span className="text-slate-600 font-medium">{order.orderNumber}</span>
            </p>
            <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${
                order.status === "billed" ? "bg-blue-100 text-blue-800" :
                order.status === "open" ? "bg-blue-100 text-blue-700" :
                order.status === "kot_fired" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
              }`}>
                {order.status.replace("_", " ")}
              </span>
              {pendingCount > 0 && <span>{pendingCount} not sent</span>}
              {firedCount > 0 && <span className="flex items-center gap-1"><ChefHat className="w-3 h-3" /> {firedCount} in kitchen</span>}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Bill total</p>
          <p className="text-xl font-bold text-slate-900">{formatInr(order.totalAmount)}</p>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Menu area */}
        <section className="flex-1 flex flex-col min-w-0 bg-slate-50">
          {/* Category tabs */}
          <div className="shrink-0 bg-white border-b border-slate-200 px-3 py-2 flex gap-2 overflow-x-auto">
            {menu.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => { setActiveCategory(cat.id); setSearch(""); }}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeCategory === cat.id && !search
                    ? "bg-sidebar text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat.name}
                <span className="ml-1.5 text-xs opacity-70">{cat.items.length}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="shrink-0 px-4 py-3 bg-white border-b border-slate-100">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entire menu…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-kaana/25 focus:border-kaana focus:bg-white"
              />
            </div>
            {search && (
              <p className="text-xs text-slate-500 mt-2">{filteredItems.length} result{filteredItems.length !== 1 ? "s" : ""} across menu</p>
            )}
          </div>

          {/* Items grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.isAvailable || busy}
                  onClick={() => addItem(item)}
                  className={`pos-menu-card group ${
                    item.isAvailable
                      ? "hover:border-kaana/40 hover:shadow-md cursor-pointer active:shadow-sm"
                      : "opacity-50 cursor-not-allowed bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <VegMark isVeg={item.isVeg} />
                    {!item.isAvailable && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Sold out</span>
                    )}
                  </div>
                  <p className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 flex-1">{item.name}</p>
                  {search && "categoryName" in item && (
                    <p className="text-[11px] text-slate-400 mt-1">{item.categoryName}</p>
                  )}
                  <p className="text-base font-bold text-kaana mt-3">{formatInr(itemPrice(item))}</p>
                </button>
              ))}
            </div>
            {filteredItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Search className="w-10 h-10 mb-3 opacity-40" />
                <p className="font-medium">No items found</p>
                <p className="text-sm mt-1">Try another category or search term</p>
              </div>
            )}
          </div>
        </section>

        {/* Cart */}
        <aside className="w-[340px] lg:w-[380px] shrink-0 bg-slate-900 text-white flex flex-col shadow-xl">
          <div className="px-4 py-3.5 border-b border-slate-700/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-400" />
              <span className="font-semibold">Current order</span>
            </div>
            <span className="text-xs font-medium bg-slate-700 px-2.5 py-1 rounded-full">{itemCount} items</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {order.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500 px-4 text-center">
                <Receipt className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium text-slate-400">No items yet</p>
                <p className="text-xs mt-1">Tap menu items to add to this table</p>
              </div>
            ) : (
              order.items.map((line) => {
                const locked = Boolean(line.kotId) || line.status !== "pending";
                return (
                  <div
                    key={line.id}
                    className={`rounded-xl p-3 border ${
                      locked ? "bg-slate-800/60 border-amber-900/40" : "bg-slate-800 border-slate-700"
                    }`}
                  >
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-white leading-snug">{line.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatInr(line.unitPrice)} × {line.quantity}</p>
                        {locked && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400 mt-1.5">
                            <ChefHat className="w-3 h-3" /> In kitchen
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-sm text-white shrink-0">{formatInr(line.totalPrice)}</p>
                    </div>
                    {!locked && (
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-700/80">
                        <div className="flex items-center gap-1.5">
                          <button type="button" disabled={busy} onClick={() => changeQty(line.id, -1, line.quantity)} className="pos-qty-btn">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold">{line.quantity}</span>
                          <button type="button" disabled={busy} onClick={() => changeQty(line.id, 1, line.quantity)} className="pos-qty-btn">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => removeLine(line.id)}
                          className="p-2 rounded-lg text-red-400 hover:bg-red-950/40 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 py-3 border-t border-slate-700 space-y-1.5 text-sm bg-slate-900/95">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span>{formatInr(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>GST</span>
              <span>{formatInr(order.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-slate-700">
              <span>Total</span>
              <span>{formatInr(order.totalAmount)}</span>
            </div>
          </div>

          <div className="p-4 border-t border-slate-700 space-y-2.5 bg-slate-950/50">
            <button
              type="button"
              disabled={busy || order.items.length === 0 || pendingCount === 0}
              onClick={fireKOT}
              className="pos-action-kot flex items-center justify-center gap-2"
            >
              <ChefHat className="w-4 h-4" />
              Send to kitchen{pendingCount > 0 ? ` (${pendingCount})` : ""}
            </button>
            <button
              type="button"
              disabled={busy || order.items.length === 0}
              onClick={printBill}
              className="pos-action-print flex items-center justify-center gap-2"
            >
              <Receipt className="w-4 h-4" />
              {order.status === "billed" ? "Reprint bill" : "Print bill"}
            </button>
            <button
              type="button"
              disabled={busy || order.items.length === 0}
              onClick={() => setShowPay(true)}
              className="pos-action-pay"
            >
              Settle · {formatInr(order.totalAmount)}
            </button>
            {order.status !== "billed" && order.items.length > 0 && (
              <p className="text-[11px] text-slate-500 text-center leading-snug">
                Print bill and give to customer before settling payment
              </p>
            )}
          </div>
        </aside>
      </div>

      {showPay && order && (
        <PaymentModal order={order} onClose={() => setShowPay(false)} onConfirm={settle} />
      )}
      <BillPrintSheet bill={billToPrint} onPrinted={() => setBillToPrint(null)} />
      <Toast message={toast.msg} type={toast.type} />
    </div>
  );
}
