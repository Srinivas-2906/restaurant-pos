"use client";

import type { TableKOTGroup } from "@kaana/ui";
import { KDS_TABLE_STYLES, formatKdsElapsed, kdsPhaseLabel, kdsTablePhase } from "@/lib/kds-table-phase";

export function KdsFloor({
  groups,
  onSelectTable,
}: {
  groups: TableKOTGroup[];
  onSelectTable: (group: TableKOTGroup) => void;
}) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <p className="text-xl font-semibold text-slate-700">Kitchen is clear</p>
        <p className="text-sm mt-2">Tickets appear when POS sends orders to the kitchen</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {groups.map((group) => {
        const phase = kdsTablePhase(group);
        const style = KDS_TABLE_STYLES[phase];
        const pendingKots = group.kots.filter((k) => k.status === "pending").length;
        const preparingKots = group.kots.filter((k) => k.status === "preparing").length;

        return (
          <button
            key={group.tableKey}
            type="button"
            onClick={() => onSelectTable(group)}
            className={`role-floor-card hover:-translate-y-0.5 cursor-pointer ${phase === "overdue" ? "kds-overdue-pulse" : ""}`}
          >
            <div className={`absolute inset-x-4 top-0 h-0.5 rounded-full bg-gradient-to-r ${style.accent}`} />
            <div className="flex items-start justify-between w-full pt-1">
              <span className="text-2xl font-bold text-slate-900">
                {group.tableNumber ?? group.tableLabel.replace("Table ", "")}
              </span>
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${style.dot}`} />
            </div>
            <span className={`text-xs font-semibold mt-1 ${style.label}`}>{kdsPhaseLabel(phase)}</span>
            <div className="w-full mt-2 pt-2 border-t border-slate-100 space-y-1">
              <p className="text-[11px] text-slate-500">
                {group.orderCount} order{group.orderCount !== 1 ? "s" : ""} · {group.itemCount} items · {formatKdsElapsed(group.elapsedMin)}
              </p>
              <div className="flex flex-wrap gap-1">
                {pendingKots > 0 && <span className="role-chip role-chip-pending">{pendingKots} new</span>}
                {preparingKots > 0 && <span className="role-chip role-chip-preparing">{preparingKots} prep</span>}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
