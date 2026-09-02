"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getOutletId } from "@/lib/api";
import { InventoryNav } from "./InventoryNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { SlideOver } from "@/components/ui/SlideOver";
import { FieldLabel, inputClass, selectClass } from "@/components/inventory/FormSection";
import { formatCurrency } from "@kaana/ui";
import { MOVEMENT_TYPE_LABELS } from "@kaana/shared-types";

interface LedgerRow {
  id: string;
  type: string;
  quantity: number | string;
  balanceAfter: number | string;
  unitCost?: number | string | null;
  totalValue?: number | string | null;
  reference?: string | null;
  reason?: string | null;
  notes?: string | null;
  createdAt: string;
  ingredient: { name: string; unit: string };
}

interface Ingredient { id: string; name: string; }

export function MovementsModule() {
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [ingredientFilter, setIngredientFilter] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    const params = new URLSearchParams({ limit: "200" });
    if (typeFilter) params.set("type", typeFilter);
    if (ingredientFilter) params.set("ingredientId", ingredientFilter);
    api<LedgerRow[]>(`/inventory/outlets/${outletId}/stock-ledger?${params}`).then(setLedger).catch(() => setLedger([]));
    api<Ingredient[]>(`/inventory/outlets/${outletId}/items`).then(setIngredients).catch(() => setIngredients([]));
  }

  useEffect(load, [outletId, typeFilter, ingredientFilter]);

  async function adjust(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId || !reason.trim()) return;
    try {
      await api(`/inventory/outlets/${outletId}/stock-adjustments`, {
        method: "POST",
        body: JSON.stringify({ ingredientId, quantity: Number(quantity), reason, notes }),
      });
      setMsg("Adjustment recorded");
      setAdjustOpen(false);
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
      <PageHeader
        title="Stock Movements"
        description="Immutable inventory ledger — every stock change is recorded here."
        action={
          <button type="button" onClick={() => setAdjustOpen(true)} className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">
            Manual adjustment
          </button>
        }
      />
      <InventoryNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm">
          <option value="">All types</option>
          {Object.entries(MOVEMENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={ingredientFilter} onChange={(e) => setIngredientFilter(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm">
          <option value="">All items</option>
          {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <Link href="/inventory/stock-count" className="text-sm text-kaana self-center hover:underline">Perform stock count →</Link>
      </div>

      <Panel title="Ledger">
        {ledger.length === 0 ? (
          <EmptyState title="No movements" description="Stock changes from purchases, sales, and adjustments appear here." />
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-600">Date</th>
                  <th className="text-left p-3 font-medium text-gray-600">Item</th>
                  <th className="text-left p-3 font-medium text-gray-600">Type</th>
                  <th className="text-right p-3 font-medium text-gray-600">Qty</th>
                  <th className="text-right p-3 font-medium text-gray-600">Balance</th>
                  <th className="text-right p-3 font-medium text-gray-600">Value</th>
                  <th className="text-left p-3 font-medium text-gray-600">Reference</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100">
                    <td className="p-3 text-gray-500 whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="p-3 font-medium">{row.ingredient.name}</td>
                    <td className="p-3">{MOVEMENT_TYPE_LABELS[row.type] ?? row.type}</td>
                    <td className={`p-3 text-right ${Number(row.quantity) < 0 ? "text-red-600" : Number(row.quantity) > 0 ? "text-green-600" : "text-gray-400"}`}>
                      {Number(row.quantity) === 0 ? "—" : `${Number(row.quantity) > 0 ? "+" : ""}${row.quantity}`}
                    </td>
                    <td className="p-3 text-right">{row.balanceAfter} {row.ingredient.unit}</td>
                    <td className="p-3 text-right">{row.totalValue != null ? formatCurrency(Number(row.totalValue)) : "—"}</td>
                    <td className="p-3 text-gray-500 truncate max-w-[120px]" title={row.reference ?? row.reason ?? ""}>{row.reference ?? row.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <SlideOver
        open={adjustOpen}
        title="Manual adjustment"
        onClose={() => setAdjustOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdjustOpen(false)} className="px-4 py-2 rounded-xl border text-sm">Cancel</button>
            <button type="submit" form="adjust-form" className="px-4 py-2 rounded-xl bg-kaana text-white text-sm font-medium">Post adjustment</button>
          </div>
        }
      >
        <form id="adjust-form" onSubmit={adjust} className="space-y-4">
          <p className="text-sm text-gray-600">Adjustments require a reason and create an immutable ledger entry. Use stock count for physical reconciliation.</p>
          <div>
            <FieldLabel required>Item</FieldLabel>
            <select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} className={selectClass} required>
              <option value="">Select…</option>
              {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel required>Quantity (+ in / − out)</FieldLabel>
            <input type="number" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <FieldLabel required>Reason</FieldLabel>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} required placeholder="Required for audit trail" />
          </div>
          <div>
            <FieldLabel>Notes</FieldLabel>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
          </div>
        </form>
      </SlideOver>
    </PageContent>
  );
}
