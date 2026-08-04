"use client";

import { useEffect, useState } from "react";
import { api, getOutletId } from "@/lib/api";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  currentStock: number | string;
  minStock: number | string;
  supplier?: { name: string };
}

export function InventoryModule() {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const outletId = getOutletId();

  useEffect(() => {
    if (!outletId) return;
    api<Ingredient[]>(`/inventory/outlets/${outletId}/ingredients`)
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [outletId]);

  const lowStock = items.filter((i) => Number(i.currentStock) <= Number(i.minStock));

  return (
    <PageContent>
      <PageHeader title="Inventory" description="Track ingredient stock levels and suppliers." />

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {lowStock.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <h3 className="font-semibold text-red-800">Low stock alert — {lowStock.length} item{lowStock.length !== 1 ? "s" : ""}</h3>
          <p className="text-sm text-red-700 mt-1">Review and reorder before service is affected.</p>
        </div>
      )}

      <Panel title={`Ingredients (${items.length})`}>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : items.length === 0 ? (
          <EmptyState title="No ingredients" description="Add ingredients via the API or seed data." />
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-600">Ingredient</th>
                  <th className="text-left p-3 font-medium text-gray-600">Stock</th>
                  <th className="text-left p-3 font-medium text-gray-600">Min</th>
                  <th className="text-left p-3 font-medium text-gray-600">Supplier</th>
                  <th className="text-left p-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-t border-gray-100">
                    <td className="p-3 font-medium">{i.name}</td>
                    <td className="p-3">{i.currentStock} {i.unit}</td>
                    <td className="p-3">{i.minStock}</td>
                    <td className="p-3">{i.supplier?.name ?? "—"}</td>
                    <td className="p-3">
                      {Number(i.currentStock) <= Number(i.minStock) ? (
                        <span className="text-red-600 font-medium">Low</span>
                      ) : (
                        <span className="text-green-600 font-medium">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </PageContent>
  );
}

export function RecipesModule() {
  const [recipes, setRecipes] = useState<Array<{ menuItemId: string; name: string; ingredients: Array<{ name: string; quantity: number; unit: string }> }>>([]);
  const outletId = getOutletId();

  useEffect(() => {
    if (!outletId) return;
    api<typeof recipes>(`/inventory/outlets/${outletId}/recipes`).then(setRecipes).catch(() => setRecipes([]));
  }, [outletId]);

  return (
    <PageContent>
      <PageHeader title="Recipes" description="Menu item ingredient breakdowns." />
      <div className="space-y-4">
        {recipes.length === 0 ? (
          <Panel><EmptyState title="No recipes" description="Recipes will appear once configured." /></Panel>
        ) : (
          recipes.map((r) => (
            <Panel key={r.menuItemId} title={r.name}>
              <ul className="text-sm text-gray-700 space-y-1">
                {r.ingredients?.map((item, j) => (
                  <li key={j}>{item.name}: {item.quantity} {item.unit}</li>
                ))}
              </ul>
            </Panel>
          ))
        )}
      </div>
    </PageContent>
  );
}
