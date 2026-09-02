"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getOutletId } from "@/lib/api";
import { PurchasesNav } from "./PurchasesNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { MetricCard } from "@/components/ui/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { FieldLabel, inputClass, selectClass } from "@/components/inventory/FormSection";
import { formatCurrency } from "@kaana/ui";

interface PO {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number | string;
  supplier?: { name: string };
  items?: Array<{ id: string; quantity: number | string; receivedQty: number | string; ingredient: { name: string; purchaseUnit?: string | null; unit: string } }>;
}

export function PurchaseDashboardModule() {
  const [orders, setOrders] = useState<PO[]>([]);
  const [receipts, setReceipts] = useState<Array<{ id: string; grnNumber: string; receivedAt: string }>>([]);
  const outletId = getOutletId();

  useEffect(() => {
    if (!outletId) return;
    api<PO[]>(`/inventory/outlets/${outletId}/purchase-orders`).then(setOrders);
    api<typeof receipts>(`/inventory/outlets/${outletId}/goods-receipts`).then(setReceipts).catch(() => setReceipts([]));
  }, [outletId]);

  const pending = orders.filter((o) => ["draft", "sent", "partial"].includes(o.status));
  const todayReceipts = receipts.filter((r) => new Date(r.receivedAt).toDateString() === new Date().toDateString());

  return (
    <PageContent>
      <PageHeader title="Purchase Dashboard" description="Procurement overview and quick actions." />
      <PurchasesNav />

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Pending POs" value={String(pending.length)} />
        <MetricCard label="Today's receipts" value={String(todayReceipts.length)} />
        <MetricCard label="Open PO value" value={formatCurrency(pending.reduce((s, o) => s + Number(o.totalAmount), 0))} />
        <MetricCard label="Total POs" value={String(orders.length)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Quick actions">
          <div className="flex flex-wrap gap-3">
            <Link href="/purchases/orders" className="px-4 py-2 rounded-xl bg-kaana text-white text-sm font-medium">New PO</Link>
            <Link href="/purchases/receipts" className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium">Goods receipts</Link>
            <Link href="/purchases/suppliers" className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium">Suppliers</Link>
            <Link href="/purchases/requests" className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium">Purchase requests</Link>
          </div>
        </Panel>

        <Panel title="Overdue / pending POs">
          {pending.length === 0 ? (
            <EmptyState title="All clear" description="No pending purchase orders." />
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {pending.slice(0, 8).map((po) => (
                <li key={po.id} className="py-2 flex justify-between">
                  <span className="font-medium">{po.poNumber}</span>
                  <span className="text-gray-500 capitalize">{po.status} · {formatCurrency(Number(po.totalAmount))}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PageContent>
  );
}

export function PurchaseOrdersModule() {
  const [ingredients, setIngredients] = useState<Array<{ id: string; name: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [orders, setOrders] = useState<PO[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState([{ ingredientId: "", quantity: 1, unitPrice: 0 }]);
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<PO[]>(`/inventory/outlets/${outletId}/purchase-orders`).then(setOrders);
  }

  useEffect(() => {
    if (!outletId) return;
    api<Array<{ id: string; name: string }>>(`/inventory/outlets/${outletId}/items`).then(setIngredients);
    api<Array<{ id: string; name: string }>>(`/inventory/outlets/${outletId}/suppliers`).then(setSuppliers);
    load();
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
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function sendPO(poId: string) {
    await api(`/inventory/purchase-orders/${poId}/send`, { method: "POST" });
    load();
  }

  return (
    <PageContent>
      <PageHeader title="Purchase Orders" description="Create and manage supplier purchase orders." />
      <PurchasesNav />
      {msg && <p className="mb-4 text-sm text-green-700">{msg}</p>}

      <Panel title="Create PO" className="mb-6">
        <form onSubmit={submit} className="space-y-4 max-w-2xl">
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={selectClass} required>
            <option value="">Supplier…</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {lines.map((line, idx) => (
            <div key={idx} className="flex gap-2">
              <select value={line.ingredientId} onChange={(e) => { const n = [...lines]; n[idx].ingredientId = e.target.value; setLines(n); }} className={`flex-1 ${selectClass}`} required>
                <option value="">Item…</option>
                {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <input type="number" min={0.01} step="0.01" value={line.quantity} onChange={(e) => { const n = [...lines]; n[idx].quantity = Number(e.target.value); setLines(n); }} className="w-24 border rounded-xl px-3 py-2.5" placeholder="Qty" />
              <input type="number" min={0} step="0.01" value={line.unitPrice} onChange={(e) => { const n = [...lines]; n[idx].unitPrice = Number(e.target.value); setLines(n); }} className="w-28 border rounded-xl px-3 py-2.5" placeholder="Price" />
            </div>
          ))}
          <button type="button" onClick={() => setLines([...lines, { ingredientId: "", quantity: 1, unitPrice: 0 }])} className="text-sm text-kaana font-medium">+ Add line</button>
          <button type="submit" className="block bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Create PO</button>
        </form>
      </Panel>

      <Panel title="Purchase orders">
        {orders.length === 0 ? (
          <EmptyState title="No POs" description="Create a purchase order to order from suppliers." />
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">PO #</th>
                  <th className="text-left p-3">Supplier</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Amount</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {orders.map((po) => (
                  <tr key={po.id} className="border-t border-gray-100">
                    <td className="p-3 font-medium">{po.poNumber}</td>
                    <td className="p-3">{po.supplier?.name ?? "—"}</td>
                    <td className="p-3 capitalize">{po.status}</td>
                    <td className="p-3">{formatCurrency(Number(po.totalAmount))}</td>
                    <td className="p-3">
                      {po.status === "draft" && (
                        <button type="button" onClick={() => sendPO(po.id)} className="text-kaana text-sm hover:underline">Send</button>
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

export function GoodsReceiptsModule() {
  const [orders, setOrders] = useState<PO[]>([]);
  const [receipts, setReceipts] = useState<Array<{ id: string; grnNumber: string; receivedAt: string; supplier?: { name: string } }>>([]);
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<PO[]>(`/inventory/outlets/${outletId}/purchase-orders`).then(setOrders);
    api<typeof receipts>(`/inventory/outlets/${outletId}/goods-receipts`).then(setReceipts).catch(() => setReceipts([]));
  }

  useEffect(load, [outletId]);

  async function receive(poId: string) {
    try {
      await api(`/inventory/purchase-orders/${poId}/receive`, { method: "POST", body: "{}" });
      setMsg("Goods received — stock updated");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  const receivable = orders.filter((o) => ["sent", "partial", "draft"].includes(o.status));

  return (
    <PageContent>
      <PageHeader title="Goods Receipts" description="Receive stock against purchase orders. Stock increases here, not on PO creation." />
      <PurchasesNav />
      {msg && <p className="mb-4 text-sm text-green-700">{msg}</p>}

      <Panel title="Pending receipts" className="mb-6">
        {receivable.length === 0 ? (
          <EmptyState title="Nothing to receive" description="All POs have been fully received." />
        ) : (
          receivable.map((po) => (
            <div key={po.id} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
              <div>
                <p className="font-medium">{po.poNumber}</p>
                <p className="text-sm text-gray-500">{po.supplier?.name} · {formatCurrency(Number(po.totalAmount))}</p>
              </div>
              <button type="button" onClick={() => receive(po.id)} className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Receive goods</button>
            </div>
          ))
        )}
      </Panel>

      <Panel title="Receipt history">
        {receipts.length === 0 ? (
          <p className="text-sm text-gray-400">No goods receipts yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {receipts.map((r) => (
              <li key={r.id} className="py-2 flex justify-between">
                <span className="font-medium">{r.grnNumber}</span>
                <span className="text-gray-500">{r.supplier?.name} · {new Date(r.receivedAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageContent>
  );
}

export function PurchaseRequestsModule() {
  const [requests, setRequests] = useState<Array<{ id: string; requestNumber: string; status: string; reason?: string | null }>>([]);
  const [items, setItems] = useState<Array<{ id: string; name: string; currentStock?: number; reorderLevel?: number }>>([]);
  const [lines, setLines] = useState([{ ingredientId: "", requestedQty: 1 }]);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  useEffect(() => {
    if (!outletId) return;
    api<typeof requests>(`/inventory/outlets/${outletId}/purchase-requests`).then(setRequests).catch(() => setRequests([]));
    api<typeof items>(`/inventory/outlets/${outletId}/items`).then(setItems);
  }, [outletId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    await api(`/inventory/outlets/${outletId}/purchase-requests`, {
      method: "POST",
      body: JSON.stringify({
        reason,
        lines: lines.filter((l) => l.ingredientId).map((l) => ({
          ingredientId: l.ingredientId,
          requestedQty: l.requestedQty,
          currentStock: 0,
          suggestedQty: l.requestedQty,
        })),
      }),
    });
    setMsg("Purchase request created");
  }

  return (
    <PageContent>
      <PageHeader title="Purchase Requests" description="Internal requisitions before creating POs." />
      <PurchasesNav />
      {msg && <p className="mb-4 text-sm text-green-700">{msg}</p>}

      <Panel title="New request" className="mb-6 max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <div><FieldLabel>Reason</FieldLabel><input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} /></div>
          {lines.map((line, idx) => (
            <div key={idx} className="flex gap-2">
              <select value={line.ingredientId} onChange={(e) => { const n = [...lines]; n[idx].ingredientId = e.target.value; setLines(n); }} className={`flex-1 ${selectClass}`}>
                <option value="">Item…</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <input type="number" min={1} value={line.requestedQty} onChange={(e) => { const n = [...lines]; n[idx].requestedQty = Number(e.target.value); setLines(n); }} className="w-24 border rounded-xl px-3 py-2.5" />
            </div>
          ))}
          <button type="submit" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Submit request</button>
        </form>
      </Panel>

      <Panel title="Requests">
        {requests.length === 0 ? (
          <EmptyState title="No requests" description="Create a purchase request when stock needs replenishing." />
        ) : (
          <ul className="divide-y text-sm">
            {requests.map((r) => (
              <li key={r.id} className="py-2 flex justify-between">
                <span className="font-medium">{r.requestNumber}</span>
                <span className="capitalize text-gray-500">{r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageContent>
  );
}

export function PurchaseInvoicesModule() {
  const [invoices, setInvoices] = useState<Array<{ id: string; invoiceNumber: string; totalAmount: number | string; paymentStatus: string; supplier?: { name: string } }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<typeof invoices>(`/inventory/outlets/${outletId}/purchase-invoices`).then(setInvoices).catch(() => setInvoices([]));
  }

  useEffect(() => {
    if (!outletId) return;
    load();
    api<Array<{ id: string; name: string }>>(`/inventory/outlets/${outletId}/suppliers`).then(setSuppliers);
  }, [outletId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    await api(`/inventory/outlets/${outletId}/purchase-invoices`, {
      method: "POST",
      body: JSON.stringify({
        supplierId,
        invoiceNumber,
        invoiceDate: new Date().toISOString(),
        totalAmount: Number(totalAmount),
      }),
    });
    setMsg("Invoice recorded");
    load();
  }

  return (
    <PageContent>
      <PageHeader title="Purchase Invoices" description="Supplier invoices with three-way PO/GRN/invoice matching." />
      <PurchasesNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <Panel title="Record invoice" className="mb-6 max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={selectClass} required>
            <option value="">Supplier…</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Supplier invoice number" className={inputClass} required />
          <input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="Total amount" className={inputClass} required />
          <button type="submit" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Save invoice</button>
        </form>
      </Panel>

      <Panel>
        {invoices.length === 0 ? (
          <EmptyState title="No invoices" description="Record supplier invoices after goods receipt." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Invoice #</th>
                <th className="text-left p-3">Supplier</th>
                <th className="text-left p-3">Amount</th>
                <th className="text-left p-3">Payment</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t">
                  <td className="p-3 font-medium">{inv.invoiceNumber}</td>
                  <td className="p-3">{inv.supplier?.name}</td>
                  <td className="p-3">{formatCurrency(Number(inv.totalAmount))}</td>
                  <td className="p-3 capitalize">{inv.paymentStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </PageContent>
  );
}

export function PurchaseReturnsModule() {
  const [returns, setReturns] = useState<Array<{ id: string; returnNumber: string; reason: string; supplier?: { name: string } }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [items, setItems] = useState<Array<{ id: string; name: string }>>([]);
  const [supplierId, setSupplierId] = useState("");
  const [reason, setReason] = useState("damaged");
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<typeof returns>(`/inventory/outlets/${outletId}/purchase-returns`).then(setReturns).catch(() => setReturns([]));
  }

  useEffect(() => {
    if (!outletId) return;
    load();
    api<Array<{ id: string; name: string }>>(`/inventory/outlets/${outletId}/suppliers`).then(setSuppliers);
    api<Array<{ id: string; name: string }>>(`/inventory/outlets/${outletId}/items`).then(setItems);
  }, [outletId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    await api(`/inventory/outlets/${outletId}/purchase-returns`, {
      method: "POST",
      body: JSON.stringify({
        supplierId,
        reason,
        lines: [{ ingredientId, quantity: Number(quantity) }],
      }),
    });
    setMsg("Return recorded — stock reduced");
    load();
  }

  return (
    <PageContent>
      <PageHeader title="Purchase Returns" description="Return damaged or excess goods to suppliers." />
      <PurchasesNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <Panel title="New return" className="mb-6 max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={selectClass} required>
            <option value="">Supplier…</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={selectClass}>
            <option value="damaged">Damaged items</option>
            <option value="expired">Expired goods</option>
            <option value="poor_quality">Poor quality</option>
            <option value="excess">Excess delivery</option>
            <option value="incorrect">Incorrect item</option>
          </select>
          <select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} className={selectClass} required>
            <option value="">Item…</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantity" className={inputClass} required />
          <button type="submit" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Record return</button>
        </form>
      </Panel>

      <Panel>
        {returns.length === 0 ? (
          <EmptyState title="No returns" description="Purchase returns reduce stock and create supplier credit notes." />
        ) : (
          <ul className="divide-y text-sm">
            {returns.map((r) => (
              <li key={r.id} className="py-3 flex justify-between">
                <span className="font-medium">{r.returnNumber}</span>
                <span className="text-gray-500">{r.supplier?.name} · {r.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageContent>
  );
}

// Legacy exports
export { GoodsReceiptsModule as ReceivePOModule };
export { PurchaseOrdersModule as NewPOModule };
