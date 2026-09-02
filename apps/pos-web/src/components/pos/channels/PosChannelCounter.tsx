"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChefHat,
  Loader2,
  Minus,
  Package,
  Plus,
  Receipt,
  Search,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { notify, notifyOrderUpdate } from "@kaana/ui";
import { usePosRealtime } from "@/hooks/usePosRealtime";
import { api, getOutletId } from "@/lib/api";
import { ORDER_TYPE_META } from "@/components/pos/channels/channelConfig";
import { BillPrintSheet, type ProformaBill } from "@/components/pos/floor/BillPrintSheet";
import { KitchenTimelinePanel } from "@/components/pos/floor/KitchenTimeline";
import { PaymentModal } from "@/components/pos/floor/PaymentModal";
import { itemKitchenLabel } from "@/components/pos/floor/tablePhase";
import {
  formatInr,
  itemPrice,
  money,
  type Category,
  type MenuItem,
  type Order,
} from "@/components/pos/floor/types";

function VegMark({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 rounded-sm border-2 shrink-0 ${
        isVeg ? "border-emerald-600" : "border-red-600"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? "bg-emerald-600" : "bg-red-600"}`} />
    </span>
  );
}

interface PosChannelCounterProps {
  mode: "takeaway" | "delivery";
}

const MODE_ICON = { takeaway: Package, delivery: Truck } as const;

export function PosChannelCounter({ mode }: PosChannelCounterProps) {
  const outletId = getOutletId() || "";
  const meta = ORDER_TYPE_META[mode];
  const ModeIcon = MODE_ICON[mode];

  const [menu, setMenu] = useState<Category[]>([]);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [activeCategory, setActiveCategory] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [billToPrint, setBillToPrint] = useState<ProformaBill | null>(null);
  const [timelineKey, setTimelineKey] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [showOpenOrders, setShowOpenOrders] = useState(false);

  const loadData = useCallback(async () => {
    if (!outletId) return;
    const [menuData, ordersData] = await Promise.all([
      api<Array<{ categories: Category[] }>>(`/outlets/${outletId}/menu`),
      api<Order[]>(`/orders?outletId=${outletId}&type=${mode}`),
    ]);
    const cats = menuData[0]?.categories ?? [];
    setMenu(cats);
    if (cats[0] && !activeCategory) setActiveCategory(cats[0].id);
    const activeStatuses = new Set(["open", "kot_fired", "preparing", "ready", "served", "billed"]);
    setOpenOrders(
      ordersData.filter(
        (o) =>
          !o.table &&
          o.source !== "swiggy" &&
          o.source !== "zomato" &&
          activeStatuses.has(o.status),
      ),
    );
  }, [outletId, mode, activeCategory]);

  useEffect(() => {
    if (!outletId) {
      setLoading(false);
      return;
    }
    loadData()
      .catch((e) => notify.error(e.message))
      .finally(() => setLoading(false));
  }, [outletId, loadData]);

  const refreshOrder = useCallback(async (orderId: string) => {
    const updated = await api<Order>(`/orders/${orderId}`);
    setOrder(updated);
    return updated;
  }, []);

  usePosRealtime(
    outletId,
    useCallback(
      async (event) => {
        await loadData();
        if (event.orderId && order?.id === event.orderId) {
          await refreshOrder(event.orderId);
          setTimelineKey((k) => k + 1);
        }
        if (event.type) notifyOrderUpdate(event, "pos");
      },
      [loadData, order?.id, refreshOrder],
    ),
  );

  function buildOrderNotes() {
    return [
      customerName ? `Customer: ${customerName}` : null,
      customerPhone ? `Phone: ${customerPhone}` : null,
      mode === "delivery" && deliveryAddress ? `Address: ${deliveryAddress}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function ensureOrder(): Promise<Order | null> {
    if (order) return order;
    if (!outletId) return null;
    try {
      const notes = buildOrderNotes();
      const created = await api<Order>("/orders", {
        method: "POST",
        body: JSON.stringify({
          outletId,
          type: mode,
          source: "walk_in",
          guestCount: 1,
          notes: notes || undefined,
        }),
      });
      setOrder(created);
      await loadData();
      return created;
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not create order");
      return null;
    }
  }

  async function startNewOrder() {
    setOrder(null);
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryAddress("");
  }

  async function resumeOrder(o: Order) {
    setOrder(o);
    const notes = o.notes ?? "";
    const nameMatch = notes.match(/Customer: (.+)/);
    const phoneMatch = notes.match(/Phone: (.+)/);
    const addrMatch = notes.match(/Address: (.+)/);
    if (nameMatch) setCustomerName(nameMatch[1].split("\n")[0]);
    if (phoneMatch) setCustomerPhone(phoneMatch[1].split("\n")[0]);
    if (addrMatch) setDeliveryAddress(addrMatch[1].split("\n")[0]);
  }

  async function addItem(item: MenuItem) {
    if (busy || !item.isAvailable) return;
    setBusy(true);
    try {
      const active = await ensureOrder();
      if (!active) return;
      await api(`/orders/${active.id}/items`, {
        method: "POST",
        body: JSON.stringify({ menuItemId: item.id, quantity: 1 }),
      });
      await refreshOrder(active.id);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not add item");
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
      notify.error(e instanceof Error ? e.message : "Could not update quantity");
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
      notify.error(e instanceof Error ? e.message : "Could not remove item");
    } finally {
      setBusy(false);
    }
  }

  async function fireKOT() {
    if (!order || busy) return;
    const pending = order.items.filter((i) => !i.kotId);
    if (pending.length === 0) {
      notify.error("All items already sent to kitchen");
      return;
    }
    setBusy(true);
    try {
      const kots = await api<Array<{ kotNumber: string }>>(`/orders/${order.id}/kot`, { method: "POST" });
      await refreshOrder(order.id);
      notify.success(`Sent to kitchen · ${kots.map((k) => k.kotNumber).join(", ")}`);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "KOT failed");
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
      notify.success(result.bill.isReprint ? "Bill reprinted" : "Bill printed");
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Print bill failed");
    } finally {
      setBusy(false);
    }
  }

  async function settle(payments: Array<{ method: string; amount: number }>) {
    if (!order) return;
    const result = await api<{ invoice: { invoiceNumber: string } }>(`/orders/${order.id}/settle`, {
      method: "POST",
      body: JSON.stringify({ payments, customerPhone: customerPhone || undefined }),
    });
    setShowPay(false);
    notify.success(`Payment complete · ${result.invoice.invoiceNumber}`);
    startNewOrder();
    await loadData();
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

  const pendingCount = order?.items.filter((i) => !i.kotId).length ?? 0;
  const itemCount = order?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const orderTotal = order ? money(order.totalAmount) : 0;

  if (!outletId) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-8">
        <p className="text-slate-500 text-center max-w-sm">No outlet assigned.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-6.5rem)] sm:min-h-[calc(100dvh-56px)] bg-slate-100 relative">
      {busy && (
        <div className="absolute inset-0 bg-black/10 z-20 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-xl px-4 py-3 shadow-lg flex items-center gap-2 text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-kaana" /> Updating…
          </div>
        </div>
      )}

      <div className="px-3 py-2 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/floor" className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 px-1.5 py-1 rounded hover:bg-slate-100">
            <ArrowLeft className="w-3.5 h-3.5" /> Counter
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <ModeIcon className="w-4 h-4 text-kaana shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {meta.label}
              {order ? ` · ${order.orderNumber}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {openOrders.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowOpenOrders((v) => !v)}
                className="text-xs font-medium px-2 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Open ({openOrders.length})
              </button>
              {showOpenOrders && (
                <>
                  <button type="button" className="fixed inset-0 z-10" aria-label="Close" onClick={() => setShowOpenOrders(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-white border border-slate-200 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto">
                    {openOrders.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          resumeOrder(o);
                          setShowOpenOrders(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex justify-between gap-2"
                      >
                        <span className="font-semibold text-slate-900">{o.orderNumber}</span>
                        <span className="text-slate-500">{formatInr(o.totalAmount)}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {order && (
            <button
              type="button"
              onClick={startNewOrder}
              className="text-xs font-medium px-2 py-1 rounded-md text-kaana hover:bg-orange-50"
            >
              + New
            </button>
          )}
          <p className="text-base font-bold text-slate-900">{formatInr(orderTotal)}</p>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden flex-col lg:flex-row">
        <section className="flex-1 flex flex-col min-w-0 bg-slate-50 pb-20 lg:pb-0">
          <div className="shrink-0 bg-white border-b border-slate-200 px-2 py-1.5 flex gap-1.5 overflow-x-auto">
            {menu.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => { setActiveCategory(cat.id); setSearch(""); }}
                className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium ${
                  activeCategory === cat.id && !search ? "bg-sidebar text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <div className="shrink-0 px-3 py-2 bg-white border-b border-slate-100">
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menu…"
                className="w-full pl-8 pr-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-1 focus:ring-kaana/30"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.isAvailable || busy}
                  onClick={() => addItem(item)}
                  className={`rounded-lg border border-slate-200 bg-white p-2.5 text-left text-sm transition-all ${
                    item.isAvailable && !busy ? "hover:border-kaana/40 hover:shadow-sm cursor-pointer" : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  <VegMark isVeg={item.isVeg} />
                  <p className="font-medium text-slate-900 text-xs mt-1.5 line-clamp-2 leading-snug">{item.name}</p>
                  <p className="text-sm font-bold text-kaana mt-1">{formatInr(itemPrice(item))}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside
          className={`bg-slate-900 text-white flex-col shadow-xl ${
            cartOpen ? "fixed inset-0 z-40 flex" : "hidden"
          } lg:flex lg:relative lg:inset-auto lg:z-auto w-full lg:w-[300px] shrink-0`}
        >
          <div className="px-3 py-2 border-b border-slate-700/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-slate-400" /> Order
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-medium bg-slate-700 px-2 py-0.5 rounded-full">{itemCount}</span>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="lg:hidden min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800"
                  aria-label="Close order"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Name (optional)"
                className="col-span-2 sm:col-span-1 px-2 py-1 rounded-md border border-slate-600 bg-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-kaana/40"
              />
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="col-span-2 sm:col-span-1 px-2 py-1 rounded-md border border-slate-600 bg-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-kaana/40"
              />
            </div>
            {mode === "delivery" && (
              <input
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Address (optional)"
                className="mt-1.5 w-full px-2 py-1 rounded-md border border-slate-600 bg-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-kaana/40"
              />
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {!order || order.items.length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-8">Tap menu items to build order</p>
            ) : (
              order.items.map((line) => {
                const locked = Boolean(line.kotId) || line.status !== "pending";
                const kitchenBadge = itemKitchenLabel(line.status);
                return (
                  <div key={line.id} className="rounded-lg p-2.5 bg-slate-800 border border-slate-700/80">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-xs leading-snug">{line.name}</p>
                        <p className="text-[11px] text-slate-400">{formatInr(line.unitPrice)} × {line.quantity}</p>
                        {kitchenBadge && (
                          <span className={`text-[9px] font-semibold uppercase mt-0.5 inline-block ${kitchenBadge.className}`}>
                            {kitchenBadge.text}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-xs shrink-0">{formatInr(line.totalPrice)}</p>
                    </div>
                    {!locked && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <button type="button" disabled={busy} onClick={() => changeQty(line.id, -1, line.quantity)} className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-xs">{line.quantity}</span>
                        <button type="button" disabled={busy} onClick={() => changeQty(line.id, 1, line.quantity)} className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40">
                          <Plus className="w-3 h-3" />
                        </button>
                        <button type="button" disabled={busy} onClick={() => removeLine(line.id)} className="ml-auto p-1 text-red-400 hover:text-red-300">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {order && <KitchenTimelinePanel orderId={order.id} refreshKey={timelineKey} />}
          <div className="p-2.5 border-t border-slate-700 space-y-1.5">
            <button type="button" disabled={busy || !order || pendingCount === 0} onClick={fireKOT} className="w-full py-2 rounded-lg text-xs font-semibold text-amber-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 flex items-center justify-center gap-1.5">
              <ChefHat className="w-3.5 h-3.5" /> Kitchen{pendingCount > 0 ? ` (${pendingCount})` : ""}
            </button>
            <button type="button" disabled={busy || !order || order.items.length === 0} onClick={printBill} className="w-full py-2 rounded-lg text-xs font-semibold text-blue-900 bg-blue-100 hover:bg-blue-200 disabled:opacity-40 border border-blue-200/60 flex items-center justify-center gap-1.5">
              <Receipt className="w-3.5 h-3.5" /> Print
            </button>
            <button type="button" disabled={busy || !order || order.items.length === 0} onClick={() => setShowPay(true)} className="w-full py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40">
              Settle · {formatInr(orderTotal)}
            </button>
          </div>
        </aside>
      </div>

      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className={`${cartOpen ? "hidden" : "flex"} lg:hidden fixed bottom-0 inset-x-0 z-30 items-center justify-between gap-3 px-4 py-3 min-h-11 bg-slate-900 text-white pb-[max(0.75rem,env(safe-area-inset-bottom))]`}
      >
        <span className="font-semibold">Order · {itemCount} items</span>
        <span className="font-bold">{formatInr(orderTotal)}</span>
      </button>

      {showPay && order && (
        <PaymentModal order={order} onClose={() => setShowPay(false)} onConfirm={settle} />
      )}
      <BillPrintSheet bill={billToPrint} onPrinted={() => setBillToPrint(null)} />
    </div>
  );
}
