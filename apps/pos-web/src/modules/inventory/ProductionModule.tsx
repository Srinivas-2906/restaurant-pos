"use client";

import { useEffect, useState } from "react";
import { api, getOutletId } from "@/lib/api";
import { InventoryNav } from "./InventoryNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { FieldLabel, inputClass, selectClass } from "@/components/inventory/FormSection";

interface Ingredient { id: string; name: string; unit: string; itemType?: string; }
interface ProductionOrder {
  id: string;
  orderNumber: string;
  status: string;
  plannedOutput: number | string;
  actualOutput?: number | string | null;
  outputItem: { name: string; unit: string };
  inputs: Array<{ id: string; plannedQty: number | string; actualQty: number | string; ingredient: { name: string; unit: string } }>;
}

export function ProductionModule() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [items, setItems] = useState<Ingredient[]>([]);
  const [outputItemId, setOutputItemId] = useState("");
  const [plannedOutput, setPlannedOutput] = useState("");
  const [inputs, setInputs] = useState([{ ingredientId: "", plannedQty: 1 }]);
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<ProductionOrder[]>(`/inventory/outlets/${outletId}/production-orders`).then(setOrders).catch(() => setOrders([]));
    api<Ingredient[]>(`/inventory/outlets/${outletId}/items`).then(setItems);
  }

  useEffect(load, [outletId]);

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    try {
      await api(`/inventory/outlets/${outletId}/production-orders`, {
        method: "POST",
        body: JSON.stringify({
          outputItemId,
          plannedOutput: Number(plannedOutput),
          inputs: inputs.filter((i) => i.ingredientId).map((i) => ({ ingredientId: i.ingredientId, plannedQty: i.plannedQty })),
        }),
      });
      setMsg("Production order created");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function completeOrder(order: ProductionOrder) {
    const actualOutput = prompt("Actual output quantity?", String(order.plannedOutput));
    if (!actualOutput) return;
    await api(`/inventory/production-orders/${order.id}/complete`, {
      method: "POST",
      body: JSON.stringify({
        actualOutput: Number(actualOutput),
        inputs: order.inputs.map((i) => ({ inputId: i.id, actualQty: Number(i.plannedQty) })),
      }),
    });
    setMsg("Production completed");
    load();
  }

  const semiItems = items.filter((i) => i.itemType === "semi_prepared" || i.itemType === "raw_ingredient");

  return (
    <PageContent>
      <PageHeader title="Production" description="Batch preparation for gravies, dough, and central-kitchen items." />
      <InventoryNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <Panel title="New production order" className="mb-6 max-w-xl">
        <form onSubmit={createOrder} className="space-y-4">
          <div>
            <FieldLabel required>Output item</FieldLabel>
            <select value={outputItemId} onChange={(e) => setOutputItemId(e.target.value)} className={selectClass} required>
              <option value="">Select…</option>
              {semiItems.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel required>Planned output</FieldLabel>
            <input type="number" step="0.01" value={plannedOutput} onChange={(e) => setPlannedOutput(e.target.value)} className={inputClass} required />
          </div>
          <p className="text-sm font-medium text-gray-700">Ingredients</p>
          {inputs.map((line, idx) => (
            <div key={idx} className="flex gap-2">
              <select value={line.ingredientId} onChange={(e) => { const n = [...inputs]; n[idx].ingredientId = e.target.value; setInputs(n); }} className={`flex-1 ${selectClass}`}>
                <option value="">Ingredient…</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <input type="number" step="0.01" value={line.plannedQty} onChange={(e) => { const n = [...inputs]; n[idx].plannedQty = Number(e.target.value); setInputs(n); }} className="w-24 border rounded-xl px-3 py-2.5" />
            </div>
          ))}
          <button type="button" onClick={() => setInputs([...inputs, { ingredientId: "", plannedQty: 1 }])} className="text-sm text-kaana font-medium">+ Add ingredient</button>
          <button type="submit" className="w-full bg-kaana text-white py-2.5 rounded-xl font-medium">Create order</button>
        </form>
      </Panel>

      <Panel title="Production orders">
        {orders.length === 0 ? (
          <EmptyState title="No production orders" description="Create a batch to consume ingredients and add finished stock." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {orders.map((o) => (
              <li key={o.id} className="py-4 flex justify-between items-start text-sm">
                <div>
                  <p className="font-medium">{o.orderNumber} — {o.outputItem.name}</p>
                  <p className="text-gray-500">Planned: {o.plannedOutput} {o.outputItem.unit} · {o.inputs.length} inputs</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="capitalize text-gray-600">{o.status}</span>
                  {o.status === "planned" && (
                    <button type="button" onClick={() => completeOrder(o)} className="text-kaana font-medium hover:underline">Complete</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageContent>
  );
}
