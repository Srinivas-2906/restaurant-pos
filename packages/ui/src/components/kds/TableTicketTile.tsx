"use client";

import React, { useMemo, useState } from "react";
import type { TableKOTGroup } from "./group-kots-by-table";

export function TableTicketTile({
  group,
  bumpingId,
  onStartPrep,
  onMarkReady,
}: {
  group: TableKOTGroup;
  bumpingId?: string | null;
  onStartPrep: (kotId: string) => void;
  onMarkReady: (kotId: string) => void;
}) {
  const hasPending = group.kots.some((k) => k.status === "pending");
  const [open, setOpen] = useState(hasPending);
  const overdue = group.elapsedMin > 15;
  const isBumping = bumpingId && group.kots.some((k) => k.id === bumpingId);

  const statusDot =
    overdue ? "bg-red-500 ring-2 ring-red-500/40" :
    group.worstStatus === "preparing" ? "bg-amber-500" : "bg-orange-500";

  const borderClass = useMemo(() => {
    if (isBumping) return "border-green-500 bg-green-950/30";
    if (overdue) return "border-red-500/80 bg-red-950/20";
    if (group.worstStatus === "preparing") return "border-amber-500/70 bg-amber-950/10";
    return "border-orange-500/60 bg-gray-900/90";
  }, [isBumping, overdue, group.worstStatus]);

  return (
    <article
      className={`kds-table-tile flex flex-col border-2 transition-all duration-300 ${borderClass} ${
        isBumping ? "scale-[0.98] opacity-0" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full p-4 text-left hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot}`} />
              <p className="text-xl font-bold tracking-tight truncate">{group.tableLabel}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="kds-status-chip">{group.orderCount} order{group.orderCount !== 1 ? "s" : ""}</span>
              <span className="kds-status-chip">{group.itemCount} item{group.itemCount !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-2xl font-mono font-bold tabular-nums ${overdue ? "text-red-400" : "text-orange-400"}`}>
              {group.elapsedMin}m
            </p>
            <span className="text-gray-500 text-xs">{open ? "▼" : "▶"}</span>
          </div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-800/80">
          {group.orders.map((orderSection) => (
            <div key={orderSection.orderId} className="rounded-xl bg-black/25 border border-gray-800 overflow-hidden">
              <div className="px-3 py-2 bg-gray-900/80 border-b border-gray-800 flex justify-between items-center gap-2">
                <p className="text-xs font-semibold text-gray-300 truncate">
                  {orderSection.orderNumber}
                </p>
                <span className="text-[10px] font-mono text-gray-500 shrink-0">{orderSection.elapsedMin}m</span>
              </div>

              <ul className="px-3 py-2 space-y-1.5">
                {orderSection.items.map((item) => (
                  <li key={item.id} className="flex gap-2 text-sm">
                    <span className="text-orange-400 font-bold tabular-nums shrink-0">{item.quantity}×</span>
                    <div className="min-w-0">
                      <p className="font-medium text-white leading-snug">{item.name}</p>
                      {item.notes && <p className="text-[11px] text-gray-500 italic mt-0.5">{item.notes}</p>}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="px-3 pb-3 space-y-2">
                {orderSection.kots.map((kot) => (
                  <div key={kot.id} className="rounded-lg bg-gray-950/60 p-2.5 border border-gray-800/80">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{kot.kotNumber}</p>
                    {kot.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onStartPrep(kot.id)}
                          className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                        >
                          Start prep
                        </button>
                        <button
                          type="button"
                          onClick={() => onMarkReady(kot.id)}
                          className="kds-bump-ready flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-semibold"
                        >
                          Mark ready
                        </button>
                      </div>
                    )}
                    {kot.status === "preparing" && (
                      <button
                        type="button"
                        onClick={() => onMarkReady(kot.id)}
                        className="kds-bump-ready w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold"
                      >
                        Mark ready ✓
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
