"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { notifyOrderUpdate } from "@kaana/ui";
import { useCaptainRealtime } from "@/hooks/useCaptainRealtime";
import { RoleAppShell } from "@/components/RoleAppShell";
import { CAPTAIN_TABLE_STYLES, captainPhaseLabel, captainTablePhase } from "@/lib/captain-table-phase";
import { api, formatInr, logout, resolveOutletId } from "@/lib/api";

interface TableActiveOrder {
  id: string;
  orderNumber: string;
  inKitchen: number;
  readyCount?: number;
  servedCount?: number;
  pendingKot?: number;
  totalAmount: number | string;
  itemQty: number;
}

interface FloorTable {
  id: string;
  number: string;
  status: string;
  capacity: number;
  activeOrder?: TableActiveOrder | null;
}

function FloorApp() {
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [outletName, setOutletName] = useState("");
  const [outletId, setOutletId] = useState("");
  const [loading, setLoading] = useState(true);

  const loadFloor = useCallback(async () => {
    const oid = await resolveOutletId();
    if (!oid) return;
    setOutletId(oid);
    const floor = await api<{ name?: string; tables: FloorTable[] }>(`/outlets/${oid}/floor`);
    setOutletName(floor.name ?? "Outlet");
    setTables(floor.tables ?? []);
  }, []);

  useEffect(() => {
    async function init() {
      await loadFloor().catch(console.error);
      setLoading(false);
    }
    init();
  }, [loadFloor]);

  useCaptainRealtime(outletId || null, useCallback((event) => {
    if (event.type) notifyOrderUpdate(event, "captain");
    loadFloor().catch(console.error);
  }, [loadFloor]));

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-surface text-slate-500">Loading floor…</div>;
  }

  const readyTables = tables.filter((t) => (t.activeOrder?.readyCount ?? 0) > 0);

  return (
    <RoleAppShell
      variant="captain"
      title="Kaana Kitchens Captain"
      badge="Floor"
      subtitle={outletName}
      hint="Tap a table to take orders or serve ready items."
      trailing={
        <>
          {readyTables.length > 0 ? (
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-100 text-sm font-semibold border border-emerald-400/40 animate-pulse">
              {readyTables.length} ready
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = "/";
            }}
            className="ml-3 text-white/60 hover:text-white text-xs border border-white/20 rounded-lg px-2 py-1"
          >
            Sign out
          </button>
        </>
      }
    >
      <div className="p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {tables.map((table) => {
            const ao = table.activeOrder;
            const phase = captainTablePhase(ao);
            const style = CAPTAIN_TABLE_STYLES[phase];
            const ready = ao?.readyCount ?? 0;
            const cooking = ao?.inKitchen ?? 0;
            const served = ao?.servedCount ?? 0;
            const hasReady = ready > 0;

            const content = (
              <>
                <div className="flex items-start justify-between w-full">
                  <span className="text-2xl font-bold text-slate-900">T{table.number}</span>
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${style.dot}`} />
                </div>
                <span className={`text-xs font-semibold mt-1 ${style.label}`}>{captainPhaseLabel(phase)}</span>
                {ao ? (
                  <div className="w-full mt-2 pt-2 border-t border-black/10 space-y-1">
                    <p className="text-sm font-bold text-slate-900">{formatInr(ao.totalAmount)}</p>
                    <p className="text-[11px] text-slate-600">{ao.itemQty} items · {ao.orderNumber}</p>
                    <div className="flex flex-wrap gap-1">
                      {cooking > 0 && <span className="role-chip role-chip-cooking">{cooking} cooking</span>}
                      {ready > 0 && <span className="role-chip role-chip-ready">{ready} ready</span>}
                      {served > 0 && <span className="role-chip role-chip-served">{served} served</span>}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <Users className="w-3 h-3" /> {table.capacity} seats
                  </span>
                )}
              </>
            );

            const cardClass = `role-floor-card hover:-translate-y-0.5 transition-all ${hasReady ? "captain-ready-glow" : ""}`;

            if (!ao) {
              return (
                <Link
                  key={table.id}
                  href={`/floor/table/${table.id}?number=${table.number}&capacity=${table.capacity}`}
                  className={cardClass}
                >
                  <div className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" />
                  <div className="pt-1">{content}</div>
                </Link>
              );
            }

            return (
              <Link
                key={table.id}
                href={`/floor/table/${table.id}?number=${table.number}&capacity=${table.capacity}`}
                className={cardClass}
              >
                <div className={`absolute inset-x-4 top-0 h-0.5 rounded-full bg-gradient-to-r ${
                  hasReady ? "from-emerald-400 to-teal-500" : phase === "kitchen" ? "from-amber-400 to-amber-500" : "from-teal-400 to-emerald-500"
                }`} />
                <div className="pt-1">{content}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </RoleAppShell>
  );
}

export default function FloorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-surface">Loading…</div>}>
      <FloorApp />
    </Suspense>
  );
}
