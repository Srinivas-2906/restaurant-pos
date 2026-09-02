"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getOutletId } from "@/lib/api";
import { InventoryNav } from "./InventoryNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { MetricCard } from "@/components/ui/MetricCard";
import { formatCurrency } from "@kaana/ui";

interface FoodCostReport {
  revenue: number;
  actualConsumption: number;
  theoreticalConsumption: number;
  variance: number;
  foodCostPct: number;
  theoreticalFoodCostPct: number;
}

interface StockRow {
  name: string;
  available: number;
  unit: string;
  value: number;
  isLowStock: boolean;
}

interface ConsumptionRow {
  name: string;
  quantity: number;
  unit: string;
  value: number;
}

export function ReportsModule() {
  const outletId = getOutletId();
  const [foodCost, setFoodCost] = useState<FoodCostReport | null>(null);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [consumption, setConsumption] = useState<ConsumptionRow[]>([]);
  const [suppliers, setSuppliers] = useState<Array<{ name: string; onTimeDeliveryPct: number; rejectionRate: number; totalPurchases: number }>>([]);

  useEffect(() => {
    if (!outletId) return;
    const to = new Date().toISOString();
    const from = new Date(Date.now() - 7 * 86400000).toISOString();
    api<FoodCostReport>(`/reports/inventory/food-cost?outletId=${outletId}&from=${from}&to=${to}`).then(setFoodCost).catch(() => setFoodCost(null));
    api<StockRow[]>(`/reports/inventory?outletId=${outletId}`).then(setStock).catch(() => setStock([]));
    api<ConsumptionRow[]>(`/reports/inventory/consumption?outletId=${outletId}&from=${from}&to=${to}`).then(setConsumption).catch(() => setConsumption([]));
    api<typeof suppliers>(`/reports/inventory/suppliers?outletId=${outletId}`).then(setSuppliers).catch(() => setSuppliers([]));
  }, [outletId]);

  const lowStock = stock.filter((s) => s.isLowStock);

  return (
    <PageContent>
      <PageHeader title="Inventory Reports" description="Stock, consumption, cost, and supplier analytics." />
      <InventoryNav />

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Food cost %" value={foodCost ? `${foodCost.foodCostPct}%` : "—"} />
        <MetricCard label="Theoretical FC %" value={foodCost ? `${foodCost.theoreticalFoodCostPct}%` : "—"} />
        <MetricCard label="7-day consumption" value={foodCost ? formatCurrency(foodCost.actualConsumption) : "—"} />
        <MetricCard label="Variance" value={foodCost ? formatCurrency(foodCost.variance) : "—"} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Low / out of stock">
          {lowStock.length === 0 ? (
            <p className="text-sm text-gray-400">All items above reorder level.</p>
          ) : (
            <ul className="divide-y text-sm">
              {lowStock.slice(0, 10).map((s) => (
                <li key={s.name} className="py-2 flex justify-between">
                  <span>{s.name}</span>
                  <span className="text-red-600">{s.available} {s.unit}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Top consumed (7 days)">
          {consumption.length === 0 ? (
            <p className="text-sm text-gray-400">No consumption data.</p>
          ) : (
            <ul className="divide-y text-sm">
              {consumption.slice(0, 10).map((c) => (
                <li key={c.name} className="py-2 flex justify-between">
                  <span>{c.name} ({c.quantity} {c.unit})</span>
                  <span>{formatCurrency(c.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Supplier performance">
          {suppliers.length === 0 ? (
            <p className="text-sm text-gray-400">No supplier data.</p>
          ) : (
            <ul className="divide-y text-sm">
              {suppliers.map((s) => (
                <li key={s.name} className="py-2">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-gray-500">On-time {s.onTimeDeliveryPct}% · Rejection {s.rejectionRate}% · {formatCurrency(s.totalPurchases)} total</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Quick access">
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/inventory/movements" className="px-4 py-2 rounded-xl border border-gray-200 hover:border-kaana">Item ledger</Link>
            <Link href="/inventory/wastage" className="px-4 py-2 rounded-xl border border-gray-200 hover:border-kaana">Wastage</Link>
            <Link href="/inventory/stock-count" className="px-4 py-2 rounded-xl border border-gray-200 hover:border-kaana">Count variance</Link>
            <Link href="/purchases/suppliers" className="px-4 py-2 rounded-xl border border-gray-200 hover:border-kaana">Suppliers</Link>
          </div>
        </Panel>
      </div>
    </PageContent>
  );
}
