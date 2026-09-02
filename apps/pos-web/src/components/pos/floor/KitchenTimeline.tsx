"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface KitchenTimelineEntry {
  at: string;
  type: string;
  label: string;
  kotNumber?: string;
  stationName?: string;
  itemNames?: string[];
}

export function useKitchenTimeline(orderId: string | null, refreshKey = 0) {
  const [entries, setEntries] = useState<KitchenTimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api<{ entries: KitchenTimelineEntry[] }>(`/orders/${orderId}/kitchen-timeline`);
      setEntries(data.entries ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return { entries, loading, reload: load };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

const TYPE_LABELS: Record<string, string> = {
  kot_fired: "Sent",
  kot_preparing: "Preparing",
  kot_ready: "Ready",
  item_served: "Served",
};

export function KitchenTimelinePanel({
  orderId,
  refreshKey,
}: {
  orderId: string | null;
  refreshKey?: number;
}) {
  const [open, setOpen] = useState(true);
  const { entries, loading } = useKitchenTimeline(orderId, refreshKey);

  if (!orderId) return null;

  return (
    <div className="border-t border-slate-700/80">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
      >
        Kitchen activity
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 max-h-36 overflow-y-auto space-y-2">
          {loading && entries.length === 0 ? (
            <p className="text-xs text-slate-500">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-xs text-slate-500">No kitchen events yet</p>
          ) : (
            entries.map((e, i) => (
              <div key={`${e.at}-${i}`} className="text-xs border-l-2 border-slate-600 pl-2 py-0.5">
                <div className="flex justify-between gap-2 text-slate-400">
                  <span>{formatTime(e.at)}</span>
                  <span className={`font-semibold uppercase ${
                    e.type === "item_served" ? "text-sky-400" :
                    e.type === "kot_ready" ? "text-emerald-400" :
                    e.type === "kot_fired" ? "text-amber-400" : "text-yellow-400"
                  }`}>
                    {TYPE_LABELS[e.type] ?? e.type}
                  </span>
                </div>
                <p className="text-slate-300 mt-0.5">{e.label}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
