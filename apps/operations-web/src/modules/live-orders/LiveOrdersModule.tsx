"use client";

import { useCallback, useEffect, useState } from "react";
import type { LiveOrdersSummary } from "@kaana/shared-types";
import { api, getOutletId } from "@/lib/api";
import { useOrdersRealtime } from "@/hooks/useOrdersRealtime";
import { Panel } from "@/components/ui/Panel";

const BUCKET_LABELS: Record<string, string> = {
  dineIn: "Dine-in",
  takeaway: "Takeaway",
  ownDelivery: "Own delivery",
  swiggy: "Swiggy",
  zomato: "Zomato",
  other: "Other",
};

export function LiveOrdersModule() {
  const [data, setData] = useState<LiveOrdersSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [outletId, setOutletId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const oid = getOutletId();
    setOutletId(oid);
    if (!oid) return;
    const summary = await api<LiveOrdersSummary>(`/orders/live?outletId=${oid}`);
    setData(summary);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useOrdersRealtime(outletId, () => {
    load().catch(console.error);
  });

  if (loading) {
    return <p className="text-slate-500 p-6">Loading live orders…</p>;
  }

  if (!data) {
    return <p className="text-slate-500 p-6">Select an outlet to view live orders.</p>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Live Orders</h1>
        <p className="text-sm text-slate-500">{data.total} active orders across all channels</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(data.buckets).map(([key, count]) => (
          <Panel key={key} className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{count}</p>
            <p className="text-xs text-slate-500 mt-1">{BUCKET_LABELS[key] ?? key}</p>
          </Panel>
        ))}
      </div>

      <Panel className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Type</th>
              <th className="p-3">Source</th>
              <th className="p-3">Table</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.orders.map((order) => (
              <tr key={order.id} className="border-t border-slate-100">
                <td className="p-3 font-medium">{order.orderNumber}</td>
                <td className="p-3 capitalize">{order.type.replace("_", " ")}</td>
                <td className="p-3 capitalize">{order.source.replace("_", " ")}</td>
                <td className="p-3">{order.tableNumber ? `T${order.tableNumber}` : "—"}</td>
                <td className="p-3">
                  <span className="capitalize">{order.status.replace("_", " ")}</span>
                  {order.billRequestedAt && (
                    <span className="ml-2 text-xs text-violet-600">Bill requested</span>
                  )}
                </td>
                <td className="p-3 text-right">₹{Number(order.totalAmount).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
