"use client";

import { useEffect, useState } from "react";
import { api, getOutletId } from "@/lib/api";
import { InventoryNav } from "./InventoryNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { FieldLabel, inputClass, selectClass } from "@/components/inventory/FormSection";

interface TransferLine {
  id: string;
  requestedQty: number | string;
  dispatchedQty: number | string;
  receivedQty: number | string;
  ingredient: { name: string; unit: string };
}

interface Transfer {
  id: string;
  transferNumber: string;
  status: string;
  fromOutletId: string;
  toOutletId: string;
  requestedAt: string;
  notes?: string | null;
  lines?: TransferLine[];
}

interface Ingredient { id: string; name: string; unit: string; }

export function TransfersModule() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [toOutletId, setToOutletId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([{ ingredientId: "", quantity: 1 }]);
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<Transfer[]>(`/inventory/outlets/${outletId}/transfers`).then(setTransfers).catch(() => setTransfers([]));
    api<Ingredient[]>(`/inventory/outlets/${outletId}/items`).then(setIngredients);
  }

  useEffect(load, [outletId]);

  async function requestTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId || !toOutletId) return;
    try {
      await api("/inventory/ck/transfers", {
        method: "POST",
        body: JSON.stringify({
          fromOutletId: outletId,
          toOutletId,
          items: lines.filter((l) => l.ingredientId).map((l) => ({ ingredientId: l.ingredientId, quantity: l.quantity })),
          notes,
        }),
      });
      setMsg("Transfer requested");
      setToOutletId("");
      setNotes("");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function dispatch(transferId: string) {
    await api(`/inventory/transfers/${transferId}/dispatch`, { method: "POST" });
    setMsg("Transfer dispatched — source stock reduced, in-transit created");
    load();
  }

  async function receive(transferId: string) {
    await api(`/inventory/transfers/${transferId}/receive`, { method: "POST", body: "{}" });
    setMsg("Transfer received at destination");
    load();
  }

  return (
    <PageContent>
      <PageHeader title="Transfers" description="Inter-outlet and central kitchen stock transfers with audit trail." />
      <InventoryNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <Panel title="Request transfer" className="mb-6 max-w-xl">
        <form onSubmit={requestTransfer} className="space-y-4">
          <div>
            <FieldLabel required>Destination outlet ID</FieldLabel>
            <input value={toOutletId} onChange={(e) => setToOutletId(e.target.value)} className={inputClass} required />
          </div>
          {lines.map((line, idx) => (
            <div key={idx} className="flex gap-2">
              <select value={line.ingredientId} onChange={(e) => { const n = [...lines]; n[idx].ingredientId = e.target.value; setLines(n); }} className={`flex-1 ${selectClass}`}>
                <option value="">Item…</option>
                {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <input type="number" min={0.01} step="0.01" value={line.quantity} onChange={(e) => { const n = [...lines]; n[idx].quantity = Number(e.target.value); setLines(n); }} className="w-24 border rounded-xl px-3 py-2.5" />
            </div>
          ))}
          <button type="button" onClick={() => setLines([...lines, { ingredientId: "", quantity: 1 }])} className="text-sm text-kaana font-medium">+ Add item</button>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={2} className={inputClass} />
          <button type="submit" className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">Request transfer</button>
        </form>
      </Panel>

      <Panel title="Transfer history">
        {transfers.length === 0 ? (
          <EmptyState title="No transfers" description="Inter-outlet transfers will appear here." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {transfers.map((t) => (
              <li key={t.id} className="py-4 text-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium">{t.transferNumber}</p>
                    <p className="text-gray-500">{new Date(t.requestedAt).toLocaleDateString()} · {t.fromOutletId.slice(-6)} → {t.toOutletId.slice(-6)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="capitalize text-gray-600">{t.status.replace(/_/g, " ")}</span>
                    {t.status === "requested" && t.fromOutletId === outletId && (
                      <button type="button" onClick={() => dispatch(t.id)} className="text-kaana hover:underline">Dispatch</button>
                    )}
                    {t.status === "in_transit" && t.toOutletId === outletId && (
                      <button type="button" onClick={() => receive(t.id)} className="text-kaana hover:underline">Receive</button>
                    )}
                  </div>
                </div>
                {t.lines && t.lines.length > 0 && (
                  <ul className="text-gray-500 pl-2">
                    {t.lines.map((l) => (
                      <li key={l.id}>{l.ingredient.name}: req {l.requestedQty} / disp {l.dispatchedQty} / recv {l.receivedQty} {l.ingredient.unit}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageContent>
  );
}
