"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { api, getOutletId } from "@/lib/api";
import { InventoryNav } from "./InventoryNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { MetricCard } from "@/components/ui/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClosingTracker } from "@/components/inventory/ClosingTracker";
import { formatCurrency } from "@kaana/ui";

interface Dashboard {
  totalValue: number;
  totalItems: number;
  belowParCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  lowStockItems: Array<{ id: string; name: string; currentStock: number; available: number; reorderLevel: number; unit: string }>;
  categoryBreakdown: Array<{ name: string; value: number; count: number }>;
  todayClosing: { status: string } | null;
  todayFlow: { openingValue: number; purchasesReceived: number; consumption: number; wastage: number; transfers: number };
  alerts: Array<{ id: string; type: string; message: string; ingredient?: string }>;
  reorderSuggestions: Array<{ ingredientId: string; name: string; suggestedQty: number; unit: string }>;
}

const CHART_COLORS = ["#1e4038", "#ea580c", "#2563eb", "#7c3aed", "#059669", "#dc2626"];

export function InventoryModule() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<Dashboard>(`/inventory/outlets/${outletId}/dashboard`)
      .then(setDashboard)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [outletId]);

  async function recordClosing() {
    if (!outletId) return;
    try {
      await api(`/inventory/outlets/${outletId}/stock-closings`, {
        method: "POST",
        body: JSON.stringify({ accuracyPct: 100 }),
      });
      setMsg("Today's stock closing recorded.");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader
        title="Inventory Overview"
        description="Stock health, alerts, and today's flow."
        action={
          dashboard?.todayClosing?.status !== "completed" ? (
            <button type="button" onClick={recordClosing} className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">
              Record today&apos;s closing
            </button>
          ) : null
        }
      />
      <InventoryNav />
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {msg && <p className="text-green-700 mb-4 text-sm">{msg}</p>}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : (
        <>
          <div className="grid md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <MetricCard label="Stock value" value={formatCurrency(dashboard?.totalValue ?? 0)} />
            <MetricCard label="Items" value={String(dashboard?.totalItems ?? 0)} />
            <MetricCard label="Low stock" value={String(dashboard?.lowStockCount ?? 0)} />
            <MetricCard label="Out of stock" value={String(dashboard?.outOfStockCount ?? 0)} />
            <MetricCard label="Today's purchases" value={formatCurrency(dashboard?.todayFlow.purchasesReceived ?? 0)} />
            <MetricCard label="Today's consumption" value={formatCurrency(dashboard?.todayFlow.consumption ?? 0)} />
          </div>

          {outletId && <ClosingTracker outletId={outletId} onClosingRecorded={load} />}

          {(dashboard?.alerts.length ?? 0) > 0 && (
            <Panel title="Needs attention" className="mb-6">
              <ul className="divide-y divide-gray-100 text-sm">
                {dashboard?.alerts.map((a) => (
                  <li key={a.id} className="py-2 text-amber-800">{a.message}</li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Today's stock flow" className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div><p className="text-gray-500">Stock value</p><p className="font-semibold">{formatCurrency(dashboard?.todayFlow.openingValue ?? 0)}</p></div>
              <div><p className="text-gray-500">Purchases</p><p className="font-semibold text-green-600">+{formatCurrency(dashboard?.todayFlow.purchasesReceived ?? 0)}</p></div>
              <div><p className="text-gray-500">Consumption</p><p className="font-semibold text-red-600">−{formatCurrency(dashboard?.todayFlow.consumption ?? 0)}</p></div>
              <div><p className="text-gray-500">Wastage</p><p className="font-semibold">{formatCurrency(dashboard?.todayFlow.wastage ?? 0)}</p></div>
              <div><p className="text-gray-500">Transfers</p><p className="font-semibold">{dashboard?.todayFlow.transfers ?? 0}</p></div>
            </div>
          </Panel>

          <div className="grid lg:grid-cols-2 gap-6">
            <Panel title="Low stock alerts">
              {(dashboard?.lowStockItems.length ?? 0) === 0 ? (
                <EmptyState title="All stocked" description="No items below reorder level." />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {dashboard?.lowStockItems.map((i) => (
                    <li key={i.id} className="py-3 flex justify-between text-sm">
                      <span className="font-medium">{i.name}</span>
                      <span className="text-red-600">{i.available.toFixed(2)} / {i.reorderLevel} {i.unit}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/inventory/items" className="inline-block mt-4 text-sm text-kaana font-medium hover:underline">
                Manage items
              </Link>
            </Panel>

            <Panel title="Reorder suggestions">
              {(dashboard?.reorderSuggestions.length ?? 0) === 0 ? (
                <EmptyState title="No suggestions" description="All items above reorder levels." />
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {dashboard?.reorderSuggestions.map((s) => (
                    <li key={s.ingredientId} className="py-3 flex justify-between">
                      <span>{s.name}</span>
                      <span className="font-medium">Order {s.suggestedQty} {s.unit}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/purchases/orders" className="inline-block mt-4 text-sm text-kaana font-medium hover:underline">
                Create PO
              </Link>
            </Panel>
          </div>

          <Panel title="Stock by category" className="mt-6">
            {(dashboard?.categoryBreakdown.length ?? 0) === 0 ? (
              <EmptyState title="No categories" description="Add categories when creating items." />
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dashboard?.categoryBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {dashboard?.categoryBreakdown.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
        </>
      )}
    </PageContent>
  );
}
