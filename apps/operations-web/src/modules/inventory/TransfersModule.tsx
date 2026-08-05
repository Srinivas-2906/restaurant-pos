"use client";

import { useEffect, useState } from "react";
import { api, getOutletId } from "@/lib/api";
import { InventoryNav } from "./InventoryNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

interface Transfer {
  id: string;
  transferNumber: string;
  status: string;
  fromOutletId: string;
  toOutletId: string;
  requestedAt: string;
  notes?: string | null;
}

export function TransfersModule() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [toOutletId, setToOutletId] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<Transfer[]>(`/inventory/outlets/${outletId}/transfers`).then(setTransfers).catch(() => setTransfers([]));
  }

  useEffect(load, [outletId]);

  async function requestTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId || !toOutletId) return;
    try {
      await api("/inventory/ck/transfers", {
        method: "POST",
        body: JSON.stringify({ fromOutletId: outletId, toOutletId, items: [], notes }),
      });
      setMsg("Transfer requested");
      setToOutletId("");
      setNotes("");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader title="Transfers" description="Central kitchen and inter-outlet stock transfers." />
      <InventoryNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <Panel title="Request transfer" className="mb-6 max-w-lg">
        <form onSubmit={requestTransfer} className="space-y-4">
          <input value={toOutletId} onChange={(e) => setToOutletId(e.target.value)} placeholder="Destination outlet ID" className="w-full border border-gray-200 rounded-xl px-3 py-2.5" required />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
          <button type="submit" className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">Request transfer</button>
        </form>
      </Panel>

      <Panel title="Transfer history">
        {transfers.length === 0 ? (
          <EmptyState title="No transfers" description="Inter-outlet transfers will appear here." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {transfers.map((t) => (
              <li key={t.id} className="py-3 flex justify-between text-sm">
                <div>
                  <p className="font-medium">{t.transferNumber}</p>
                  <p className="text-gray-500">{new Date(t.requestedAt).toLocaleDateString()}</p>
                </div>
                <span className="capitalize text-gray-600">{t.status.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageContent>
  );
}
