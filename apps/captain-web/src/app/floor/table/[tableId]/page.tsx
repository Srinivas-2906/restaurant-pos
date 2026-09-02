"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { notify, notifyOrderUpdate } from "@kaana/ui";
import type { OrderDto } from "@kaana/shared-types";
import { useCaptainRealtime } from "@/hooks/useCaptainRealtime";
import { RoleAppShell } from "@/components/RoleAppShell";
import { CaptainTableOrder } from "@/components/CaptainTableOrder";
import { CaptainServePanel } from "@/components/CaptainServePanel";
import {
  getOpenOrderByTable,
  markItemServed,
  resolveOutletId,
} from "@/lib/api";

type Tab = "order" | "serve";

function TableDetailApp() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tableId = params.tableId as string;
  const tableNumber = searchParams.get("number") ?? tableId.slice(-2);
  const guestCount = Number(searchParams.get("capacity") ?? 2);
  const initialTab = (searchParams.get("tab") as Tab) ?? "order";

  const [tab, setTab] = useState<Tab>(initialTab);
  const [outletId, setOutletId] = useState("");
  const [serveOrder, setServeOrder] = useState<OrderDto | null>(null);
  const [serveBusy, setServeBusy] = useState<string | null>(null);
  const [loadingServe, setLoadingServe] = useState(false);

  const loadServe = useCallback(async () => {
    const oid = await resolveOutletId();
    if (!oid) return;
    setOutletId(oid);
    const data = await getOpenOrderByTable(oid, tableId);
    setServeOrder(data);
  }, [tableId]);

  useEffect(() => {
    if (tab !== "serve") return;
    setLoadingServe(true);
    loadServe().finally(() => setLoadingServe(false));
  }, [tab, loadServe]);

  useCaptainRealtime(outletId || null, useCallback((event) => {
    if (event.type) notifyOrderUpdate(event, "captain");
    if (tab === "serve") loadServe().catch(console.error);
  }, [tab, loadServe]));

  async function handleMarkServed(itemId: string) {
    if (!serveOrder) return;
    setServeBusy(itemId);
    try {
      await markItemServed(serveOrder.id, itemId);
      notify.success("Item marked served");
      await loadServe();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not mark served");
    } finally {
      setServeBusy(null);
    }
  }

  return (
    <RoleAppShell variant="captain" title={`Table ${tableNumber}`} badge="Floor">
      <div className="p-4 max-w-6xl mx-auto">
        <Link href="/floor" className="inline-flex items-center gap-1 text-sm text-teal-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Floor
        </Link>

        <div className="flex gap-2 mb-4">
          {(["order", "serve"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize ${
                tab === t ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {t === "order" ? "Take order" : "Serve"}
            </button>
          ))}
        </div>

        {tab === "order" ? (
          <CaptainTableOrder tableId={tableId} tableNumber={tableNumber} guestCount={guestCount} />
        ) : loadingServe ? (
          <p className="text-slate-500 text-center py-12">Loading…</p>
        ) : !serveOrder ? (
          <p className="text-slate-500 text-center py-12">No active order on this table.</p>
        ) : (
          <CaptainServePanel order={serveOrder} busy={serveBusy} onMarkServed={handleMarkServed} />
        )}
      </div>
    </RoleAppShell>
  );
}

export default function TableDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-surface">Loading…</div>}>
      <TableDetailApp />
    </Suspense>
  );
}
