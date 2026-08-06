"use client";

import { useEffect, useState } from "react";
import { api, getOutletId } from "@/lib/api";
import { PurchasesNav } from "./PurchasesNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

interface PO {
  id: string;
  status: string;
  items?: unknown[];
  supplier?: { name: string };
}

export function ReceivePOModule() {
  const [orders, setOrders] = useState<PO[]>([]);
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<PO[]>(`/inventory/outlets/${outletId}/purchase-orders`).then(setOrders).catch(() => setOrders([]));
  }

  useEffect(load, [outletId]);

  async function receive(poId: string) {
    try {
      await api(`/inventory/purchase-orders/${poId}/receive`, { method: "POST" });
      setMsg("Goods received");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  const pending = orders.filter((o) => o.status === "draft" || o.status === "pending" || o.status === "ordered");

  return (
    <PageContent>
      <PageHeader title="Purchases" description="Receive incoming purchase orders." />
      <PurchasesNav />
      {msg && <p className="mb-4 text-sm text-green-700">{msg}</p>}
      {pending.length === 0 ? (
        <Panel><EmptyState title="No pending POs" description="All purchase orders have been received." /></Panel>
      ) : (
        pending.map((po) => (
          <Panel key={po.id} className="mb-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">PO #{po.id.slice(-8)}</p>
                <p className="text-sm text-gray-500">{po.supplier?.name ?? "Supplier"}</p>
              </div>
              <button type="button" onClick={() => receive(po.id)} className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">
                Receive
              </button>
            </div>
          </Panel>
        ))
      )}
    </PageContent>
  );
}

export function NewPOModule() {
  const [ingredients, setIngredients] = useState<Array<{ id: string; name: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState([{ ingredientId: "", quantity: 1, unitPrice: 0 }]);
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  useEffect(() => {
    if (!outletId) return;
    api<Array<{ id: string; name: string }>>(`/inventory/outlets/${outletId}/ingredients`).then(setIngredients);
    api<Array<{ id: string; name: string }>>(`/inventory/outlets/${outletId}/suppliers`).then(setSuppliers);
  }, [outletId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    try {
      await api(`/inventory/outlets/${outletId}/purchase-orders`, {
        method: "POST",
        body: JSON.stringify({
          supplierId,
          items: lines.filter((l) => l.ingredientId).map((l) => ({ ingredientId: l.ingredientId, quantity: l.quantity, unitPrice: l.unitPrice || 0 })),
        }),
      });
      setMsg("PO created");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader title="New Purchase Order" description="Create a PO for supplier delivery." />
      <PurchasesNav />
      <Panel>
        <form onSubmit={submit} className="space-y-4">
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" required>
            <option value="">Supplier...</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {lines.map((line, idx) => (
            <div key={idx} className="flex gap-2">
              <select value={line.ingredientId} onChange={(e) => { const n = [...lines]; n[idx].ingredientId = e.target.value; setLines(n); }} className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5" required>
                <option value="">Ingredient...</option>
                {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <input type="number" min={1} value={line.quantity} onChange={(e) => { const n = [...lines]; n[idx].quantity = Number(e.target.value); setLines(n); }} className="w-20 border border-gray-200 rounded-xl px-3 py-2.5" />
              <input type="number" min={0} step="0.01" value={line.unitPrice} onChange={(e) => { const n = [...lines]; n[idx].unitPrice = Number(e.target.value); setLines(n); }} className="w-24 border border-gray-200 rounded-xl px-3 py-2.5" placeholder="Price" />
            </div>
          ))}
          <button type="button" onClick={() => setLines([...lines, { ingredientId: "", quantity: 1, unitPrice: 0 }])} className="text-sm text-kaana font-medium">+ Add line</button>
          {msg && <p className="text-sm text-green-700">{msg}</p>}
          <button type="submit" className="w-full bg-kaana hover:bg-kaana-dark text-white py-2.5 rounded-xl font-medium">Create PO</button>
        </form>
      </Panel>
    </PageContent>
  );
}

export function WastageModule() {
  const [ingredients, setIngredients] = useState<Array<{ id: string; name: string; unit: string }>>([]);
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  useEffect(() => {
    if (!outletId) return;
    api<typeof ingredients>(`/inventory/outlets/${outletId}/ingredients`).then(setIngredients);
  }, [outletId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    try {
      await api(`/inventory/outlets/${outletId}/wastage`, {
        method: "POST",
        body: JSON.stringify({ ingredientId, quantity: Number(quantity), notes }),
      });
      setMsg("Wastage recorded");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent className="max-w-lg">
      <PageHeader title="Record Wastage" description="Log spoiled or discarded ingredients." />
      <PurchasesNav />
      <Panel>
        <form onSubmit={submit} className="space-y-4">
          <select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" required>
            <option value="">Ingredient...</option>
            {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" placeholder="Quantity" required />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" rows={3} placeholder="Notes (optional)" />
          {msg && <p className="text-sm text-green-700">{msg}</p>}
          <button type="submit" className="w-full bg-kaana hover:bg-kaana-dark text-white py-2.5 rounded-xl font-medium">Record Wastage</button>
        </form>
      </Panel>
    </PageContent>
  );
}
