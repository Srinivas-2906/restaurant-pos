"use client";

import { useEffect, useState } from "react";
import { api, getOutletId } from "@/lib/api";
import { InventoryNav } from "./InventoryNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

interface LedgerRow {
  id: string;
  type: string;
  quantity: number | string;
  balanceAfter: number | string;
  reference?: string | null;
  notes?: string | null;
  createdAt: string;
  ingredient: { name: string; unit: string };
}

interface Ingredient {
  id: string;
  name: string;
}

export function MovementsModule() {
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<LedgerRow[]>(`/inventory/outlets/${outletId}/stock-ledger`).then(setLedger).catch(() => setLedger([]));
    api<Ingredient[]>(`/inventory/outlets/${outletId}/ingredients`).then(setIngredients).catch(() => setIngredients([]));
  }

  useEffect(load, [outletId]);

  async function adjust(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    try {
      await api(`/inventory/outlets/${outletId}/stock-adjustments`, {
        method: "POST",
        body: JSON.stringify({ ingredientId, quantity: Number(quantity), notes }),
      });
      setMsg("Adjustment recorded");
      setQuantity("");
      setNotes("");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader title="Stock movements" description="Manual adjustments and movement history." />
      <InventoryNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <Panel title="Record adjustment" className="mb-6 max-w-lg">
        <form onSubmit={adjust} className="space-y-4">
          <select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" required>
            <option value="">Select ingredient...</option>
            {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantity (+ add, − deduct)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5" required />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason (optional)" rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
          <button type="submit" className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">Save adjustment</button>
        </form>
      </Panel>

      <Panel title="Movement history">
        {ledger.length === 0 ? (
          <EmptyState title="No movements" description="Stock changes will appear here." />
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-600">Date</th>
                  <th className="text-left p-3 font-medium text-gray-600">Ingredient</th>
                  <th className="text-left p-3 font-medium text-gray-600">Type</th>
                  <th className="text-left p-3 font-medium text-gray-600">Qty</th>
                  <th className="text-left p-3 font-medium text-gray-600">Balance</th>
                  <th className="text-left p-3 font-medium text-gray-600">Notes</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="p-3">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="p-3">{r.ingredient.name}</td>
                    <td className="p-3 capitalize">{r.type.replace(/_/g, " ")}</td>
                    <td className="p-3">{r.quantity} {r.ingredient.unit}</td>
                    <td className="p-3">{r.balanceAfter}</td>
                    <td className="p-3 text-gray-500">{r.notes ?? r.reference ?? "—"}</td>
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
