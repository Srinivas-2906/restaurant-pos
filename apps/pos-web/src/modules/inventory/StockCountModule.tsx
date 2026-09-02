"use client";

import { useEffect, useState } from "react";
import { api, getOutletId } from "@/lib/api";
import { InventoryNav } from "./InventoryNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { FieldLabel, inputClass, selectClass } from "@/components/inventory/FormSection";
import { formatCurrency } from "@kaana/ui";

interface StockCountLine {
  id: string;
  expectedStock: number | string;
  physicalStock: number | string;
  variance: number | string;
  varianceValue: number | string;
  reason?: string | null;
  ingredient: { id: string; name: string; unit: string };
}

interface StockCount {
  id: string;
  countNumber: string;
  countType: string;
  status: string;
  isBlind: boolean;
  countDate: string;
  lines: StockCountLine[];
}

const COUNT_TYPES = [
  { value: "full", label: "Full inventory count" },
  { value: "category", label: "Category count" },
  { value: "location", label: "Location count" },
  { value: "cycle", label: "Cycle count" },
  { value: "closing", label: "Closing count" },
  { value: "surprise_audit", label: "Surprise audit" },
];

export function StockCountModule() {
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [activeCount, setActiveCount] = useState<StockCount | null>(null);
  const [countType, setCountType] = useState("full");
  const [isBlind, setIsBlind] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<StockCount[]>(`/inventory/outlets/${outletId}/stock-counts`).then(setCounts).catch(() => setCounts([]));
  }

  useEffect(load, [outletId]);

  async function startCount(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    try {
      const count = await api<StockCount>(`/inventory/outlets/${outletId}/stock-counts`, {
        method: "POST",
        body: JSON.stringify({ countType, isBlind, locationName: locationName || undefined }),
      });
      setActiveCount(count);
      setMsg(`Count ${count.countNumber} started`);
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function updateLine(lineId: string, physicalStock: number, reason?: string) {
    if (!activeCount) return;
    await api(`/inventory/stock-counts/${activeCount.id}/lines/${lineId}`, {
      method: "PATCH",
      body: JSON.stringify({ physicalStock, reason }),
    });
    const updated = await api<StockCount[]>(`/inventory/outlets/${outletId}/stock-counts`);
    const found = updated.find((c) => c.id === activeCount.id);
    if (found) setActiveCount(found);
  }

  async function approveCount() {
    if (!activeCount) return;
    await api(`/inventory/stock-counts/${activeCount.id}/approve`, { method: "POST", body: "{}" });
    setMsg("Count approved and adjustments posted");
    setActiveCount(null);
    load();
  }

  const displayCount = activeCount ?? counts.find((c) => c.status === "in_progress") ?? null;

  return (
    <PageContent>
      <PageHeader title="Stock Count" description="Physical inventory counts with variance tracking." />
      <InventoryNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      {!displayCount ? (
        <Panel title="Start new count" className="max-w-lg mb-6">
          <form onSubmit={startCount} className="space-y-4">
            <div>
              <FieldLabel>Count type</FieldLabel>
              <select value={countType} onChange={(e) => setCountType(e.target.value)} className={selectClass}>
                {COUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Location (optional)</FieldLabel>
              <input value={locationName} onChange={(e) => setLocationName(e.target.value)} className={inputClass} placeholder="Dry storage, Refrigerator…" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isBlind} onChange={(e) => setIsBlind(e.target.checked)} />
              Blind counting (hide expected quantities from staff)
            </label>
            <button type="submit" className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">Create count</button>
          </form>
        </Panel>
      ) : (
        <Panel title={`${displayCount.countNumber} — ${displayCount.status}`} className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500 capitalize">{displayCount.countType.replace(/_/g, " ")} · {displayCount.isBlind ? "Blind" : "Open"}</p>
            {displayCount.status === "in_progress" && (
              <button type="button" onClick={approveCount} className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Approve & post</button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Item</th>
                  {!displayCount.isBlind && <th className="text-left p-3">Expected</th>}
                  <th className="text-left p-3">Physical</th>
                  <th className="text-left p-3">Variance</th>
                  <th className="text-left p-3">Value</th>
                </tr>
              </thead>
              <tbody>
                {displayCount.lines.map((line) => (
                  <CountLineRow
                    key={line.id}
                    line={line}
                    blind={displayCount.isBlind}
                    editable={displayCount.status === "in_progress"}
                    onSave={updateLine}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title="Count history">
        {counts.length === 0 ? (
          <EmptyState title="No counts" description="Start a physical count to reconcile stock." />
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {counts.map((c) => (
              <li key={c.id} className="py-3 flex justify-between">
                <button type="button" onClick={() => setActiveCount(c)} className="font-medium text-kaana hover:underline">{c.countNumber}</button>
                <span className="capitalize text-gray-500">{c.status.replace(/_/g, " ")} · {new Date(c.countDate).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageContent>
  );
}

function CountLineRow({
  line, blind, editable, onSave,
}: {
  line: StockCountLine;
  blind: boolean;
  editable: boolean;
  onSave: (lineId: string, qty: number, reason?: string) => void;
}) {
  const [physical, setPhysical] = useState(String(line.physicalStock));
  const [reason, setReason] = useState(line.reason ?? "");

  return (
    <tr className="border-t border-gray-100">
      <td className="p-3">{line.ingredient.name}</td>
      {!blind && <td className="p-3">{line.expectedStock} {line.ingredient.unit}</td>}
      <td className="p-3">
        {editable ? (
          <input
            type="number"
            step="0.001"
            value={physical}
            onChange={(e) => setPhysical(e.target.value)}
            onBlur={() => onSave(line.id, Number(physical), reason || undefined)}
            className="w-24 border rounded-lg px-2 py-1"
          />
        ) : (
          <span>{line.physicalStock} {line.ingredient.unit}</span>
        )}
      </td>
      <td className={`p-3 ${Number(line.variance) < 0 ? "text-red-600" : Number(line.variance) > 0 ? "text-green-600" : ""}`}>
        {Number(line.variance).toFixed(3)} {line.ingredient.unit}
      </td>
      <td className="p-3">{formatCurrency(Number(line.varianceValue))}</td>
    </tr>
  );
}
