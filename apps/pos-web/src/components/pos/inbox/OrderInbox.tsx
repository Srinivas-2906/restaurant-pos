"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  ChefHat,
  RefreshCw,
} from "lucide-react";
import { notify } from "@kaana/ui";
import { usePosRealtime } from "@/hooks/usePosRealtime";
import {
  API_URL,
  api,
  cancelOrder,
  fetchOrderInbox,
  getOutletId,
  simulatePartnerOrder,
} from "@/lib/api";
import { SwiggyLogo, ZomatoLogo } from "@/components/pos/channels/AggregatorLogos";
import {
  INTEGRATION_PARTNERS,
  ORDER_SOURCE_META,
  ORDER_TYPE_META,
  PARTNER_WEBHOOK_PATH,
  type OrderSource,
} from "@/components/pos/channels/channelConfig";
import { formatInr, type Order } from "@/components/pos/floor/types";

function SourceLogo({ source }: { source: OrderSource }) {
  if (source === "swiggy") return <SwiggyLogo className="h-5 w-[68px] shrink-0" />;
  if (source === "zomato") return <ZomatoLogo className="h-5 w-[68px] shrink-0" />;
  const meta = ORDER_SOURCE_META[source];
  return (
    <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-lg ${meta.badgeClass}`}>
      {meta.label}
    </span>
  );
}

function elapsedMins(createdAt?: string) {
  if (!createdAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000));
}

function slaLabel(mins: number) {
  const remaining = Math.max(0, 15 - mins);
  if (remaining <= 3) return { text: `${remaining} min left`, urgent: true };
  return { text: `${remaining} min SLA`, urgent: false };
}

function itemSummary(order: Order) {
  return order.items
    .slice(0, 3)
    .map((i) => `${i.quantity}× ${i.name}`)
    .join(", ");
}

function customerFromOrder(order: Order) {
  const agg = order.aggregatorData as { customer?: { name?: string; phone?: string } } | null;
  if (agg?.customer?.name) return agg.customer.name;
  if (order.notes?.startsWith("Customer:")) return order.notes.replace("Customer:", "").trim();
  return "Guest";
}

export function OrderInbox() {
  const outletId = getOutletId() || "";
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [simulating, setSimulating] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    if (!outletId) return;
    const data = await fetchOrderInbox(outletId);
    setOrders(data);
  }, [outletId]);

  useEffect(() => {
    if (!outletId) {
      setLoading(false);
      return;
    }
    loadInbox()
      .catch((e) => notify.error(e.message))
      .finally(() => setLoading(false));
  }, [outletId, loadInbox]);

  usePosRealtime(
    outletId,
    useCallback(
      async (event) => {
        await loadInbox();
        const src = event.source;
        if (src === "swiggy" || src === "zomato") {
          notify.info(`New ${ORDER_SOURCE_META[src].label} order received`);
        }
      },
      [loadInbox],
    ),
  );

  const webhookUrl = `${API_URL.replace(/\/api$/, "")}${PARTNER_WEBHOOK_PATH}`;

  async function handleSimulate(source: "swiggy" | "zomato") {
    if (!outletId || simulating) return;
    setSimulating(source);
    try {
      const order = await simulatePartnerOrder(outletId, source);
      await loadInbox();
      notify.success(`Mock ${ORDER_SOURCE_META[source].label} order · ${order.orderNumber}`);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setSimulating(null);
    }
  }

  async function handleReject(order: Order) {
    if (busyId) return;
    setBusyId(order.id);
    try {
      await cancelOrder(order.id, "Rejected at POS");
      await loadInbox();
      notify.success(`Order ${order.orderNumber} rejected`);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleHandOff(order: Order) {
    if (busyId) return;
    setBusyId(order.id);
    try {
      await api(`/orders/${order.id}/settle`, {
        method: "POST",
        body: JSON.stringify({
          payments: [{
            method: "wallet",
            amount: Number(order.totalAmount ?? 0),
            reference: order.externalOrderId ?? order.source,
          }],
        }),
      });
      await loadInbox();
      notify.success(`Order ${order.orderNumber} handed off`);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not complete order");
    } finally {
      setBusyId(null);
    }
  }

  const stats = useMemo(
    () => ({
      swiggy: orders.filter((o) => o.source === "swiggy").length,
      zomato: orders.filter((o) => o.source === "zomato").length,
      total: orders.length,
    }),
    [orders],
  );

  if (!outletId) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-8">
        <p className="text-slate-500 text-center max-w-sm">No outlet assigned.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)] bg-slate-50">
      <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-kaana" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900 leading-tight">Order Inbox</h2>
            <p className="text-[11px] text-slate-500">{stats.total} active · Swiggy {stats.swiggy} · Zomato {stats.zomato}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => loadInbox().catch(() => undefined)}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <Link href="/floor" className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded-md hover:bg-slate-100">
            ← Counter
          </Link>
        </div>
      </div>

      {/* Compact integration bar */}
      <div className="px-4 py-2.5 bg-white border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          {INTEGRATION_PARTNERS.map((partner) => (
            <div
              key={partner.id}
              className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${partner.color}`}
            >
              {partner.id === "swiggy" ? (
                <SwiggyLogo className="h-5 w-[72px]" />
              ) : (
                <ZomatoLogo className="h-5 w-[72px]" />
              )}
              <span className="text-[10px] font-medium text-emerald-700">Demo</span>
              <button
                type="button"
                disabled={!!simulating}
                onClick={() => handleSimulate(partner.id)}
                className="text-[11px] font-medium px-2 py-0.5 rounded bg-white/80 border border-slate-200 hover:bg-white disabled:opacity-50"
              >
                {simulating === partner.id ? "…" : "Simulate"}
              </button>
            </div>
          ))}
          <span className="text-[10px] text-slate-400 font-mono truncate max-w-xs hidden sm:inline" title={webhookUrl}>
            {PARTNER_WEBHOOK_PATH}
          </span>
        </div>
      </div>

      {/* Order list */}
      <div className="flex-1 p-4 overflow-auto">
        {loading ? (
          <div className="space-y-2 max-w-3xl mx-auto">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-slate-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Bell className="w-8 h-8 mb-3 opacity-30" />
            <p className="text-sm text-slate-600">Inbox is clear</p>
            <p className="text-xs mt-0.5">Use Simulate to test aggregator orders</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl mx-auto">
            {orders.map((order) => {
              const source = (order.source ?? "phone") as OrderSource;
              const type = order.type ?? "delivery";
              const mins = elapsedMins(order.createdAt);
              const sla = slaLabel(mins);
              const isBusy = busyId === order.id;

              return (
                <article
                  key={order.id}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <SourceLogo source={source} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold text-slate-900">{order.orderNumber}</span>
                        {order.externalOrderId && (
                          <span className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">
                            {order.externalOrderId}
                          </span>
                        )}
                        <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                          {ORDER_TYPE_META[type]?.label ?? type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 truncate mt-0.5">{itemSummary(order)}</p>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1 text-[11px] text-slate-400">
                        <span>{customerFromOrder(order)}</span>
                        <span>·</span>
                        <span>{formatElapsed(mins)} ago</span>
                        <span className={sla.urgent ? "text-red-600 font-medium" : "text-amber-600"}>
                          SLA {sla.text}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-900">{formatInr(order.totalAmount)}</p>
                      <span
                        className={`inline-block mt-0.5 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                          order.status === "ready"
                            ? "bg-emerald-50 text-emerald-700"
                            : order.status === "preparing" || order.status === "kot_fired"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {order.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
                    {order.status === "open" && (
                      <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Accepted
                      </span>
                    )}
                    {(order.status === "kot_fired" || order.status === "preparing") && (
                      <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                        <ChefHat className="w-3 h-3" /> Kitchen
                      </span>
                    )}
                    {order.status === "ready" && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleHandOff(order)}
                        className="px-2.5 py-1 bg-emerald-600 text-white rounded-md text-[11px] font-medium hover:bg-emerald-500 disabled:opacity-50"
                      >
                        Hand off
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleReject(order)}
                      className="ml-auto px-2.5 py-1 border border-red-200 text-red-600 rounded-md text-[11px] font-medium hover:bg-red-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatElapsed(mins: number) {
  if (mins < 1) return "<1 min";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
