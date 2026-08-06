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

interface StockSummary {
  totalValue: number;
  totalItems: number;
  belowParCount: number;
  lowStockCount: number;
  lowStockItems: Array<{ id: string; name: string; currentStock: number; minStock: number; unit: string }>;
  categoryBreakdown: Array<{ name: string; value: number; count: number }>;
  todayClosing: { status: string } | null;
}

const CHART_COLORS = ["#1e4038", "#ea580c", "#2563eb", "#7c3aed", "#059669", "#dc2626"];

export function InventoryModule() {
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<StockSummary>(`/inventory/outlets/${outletId}/stock-summary`)
      .then(setSummary)
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
        title="Inventory"
        description="Stock health, alerts, and daily closing."
        action={
          summary?.todayClosing?.status !== "completed" ? (
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
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Stock value" value={formatCurrency(summary?.totalValue ?? 0)} />
            <MetricCard label="Ingredients" value={String(summary?.totalItems ?? 0)} />
            <MetricCard label="Below par" value={String(summary?.belowParCount ?? 0)} />
            <MetricCard label="Low stock" value={String(summary?.lowStockCount ?? 0)} />
          </div>

          {outletId && <ClosingTracker outletId={outletId} onClosingRecorded={load} />}

          <div className="grid lg:grid-cols-2 gap-6 mt-6">
            <Panel title="Low stock alerts">
              {(summary?.lowStockItems.length ?? 0) === 0 ? (
                <EmptyState title="All stocked" description="No items below minimum levels." />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {summary?.lowStockItems.map((i) => (
                    <li key={i.id} className="py-3 flex justify-between text-sm">
                      <span className="font-medium">{i.name}</span>
                      <span className="text-red-600">{i.currentStock} / {i.minStock} {i.unit}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/inventory/materials" className="inline-block mt-4 text-sm text-kaana font-medium hover:underline">
                Manage materials
              </Link>
            </Panel>

            <Panel title="Stock by category">
              {(summary?.categoryBreakdown.length ?? 0) === 0 ? (
                <EmptyState title="No categories" description="Add categories when creating materials." />
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary?.categoryBreakdown}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {summary?.categoryBreakdown.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </PageContent>
  );
}
