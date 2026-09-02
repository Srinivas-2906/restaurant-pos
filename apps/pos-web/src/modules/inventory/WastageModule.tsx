"use client";

import { useEffect, useState } from "react";
import { api, getOutletId } from "@/lib/api";
import { InventoryNav } from "./InventoryNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { FieldLabel, inputClass, selectClass } from "@/components/inventory/FormSection";
import { formatCurrency } from "@kaana/ui";
import { WASTAGE_CATEGORIES } from "@kaana/shared-types";

interface Ingredient { id: string; name: string; unit: string; }
interface WastageEntry {
  id: string;
  quantity: number | string;
  unit: string;
  costImpact: number | string;
  category: string;
  reason?: string | null;
  createdAt: string;
  ingredient: { name: string };
}

export function WastageModule() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [entries, setEntries] = useState<WastageEntry[]>([]);
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState("unexplained");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<Ingredient[]>(`/inventory/outlets/${outletId}/items`).then(setIngredients);
    api<WastageEntry[]>(`/inventory/outlets/${outletId}/wastage`).then(setEntries).catch(() => setEntries([]));
  }

  useEffect(load, [outletId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    try {
      await api(`/inventory/outlets/${outletId}/wastage`, {
        method: "POST",
        body: JSON.stringify({ ingredientId, quantity: Number(quantity), category, reason, notes }),
      });
      setMsg("Wastage recorded");
      setQuantity("");
      setReason("");
      setNotes("");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader title="Wastage" description="Track spoilage, prep loss, and other inventory write-offs." />
      <InventoryNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Record wastage">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <FieldLabel required>Item</FieldLabel>
              <select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} className={selectClass} required>
                <option value="">Select item…</option>
                {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel required>Quantity</FieldLabel>
              <input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <FieldLabel required>Category</FieldLabel>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
                {WASTAGE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Reason</FieldLabel>
              <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
            </div>
            <div>
              <FieldLabel>Notes</FieldLabel>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
            </div>
            <button type="submit" className="w-full bg-kaana hover:bg-kaana-dark text-white py-2.5 rounded-xl font-medium">Record wastage</button>
          </form>
        </Panel>

        <Panel title="Recent wastage">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400">No wastage entries yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {entries.slice(0, 15).map((e) => (
                <li key={e.id} className="py-3 flex justify-between gap-4">
                  <div>
                    <p className="font-medium">{e.ingredient.name}</p>
                    <p className="text-gray-500 capitalize">{e.category.replace(/_/g, " ")} · {new Date(e.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p>{e.quantity} {e.unit}</p>
                    <p className="text-red-600">{formatCurrency(Number(e.costImpact))}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PageContent>
  );
}
