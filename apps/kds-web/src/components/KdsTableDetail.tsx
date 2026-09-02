"use client";

import { ArrowLeft, ChefHat, Clock } from "lucide-react";
import type { TableKOTGroup } from "@kaana/ui";
import {
  KOT_ITEM_STYLES,
  flattenGroupItems,
  formatKdsElapsed,
  kdsPhaseLabel,
  kdsTablePhase,
  type FlatKdsItem,
} from "@/lib/kds-table-phase";

function itemStyle(item: FlatKdsItem) {
  if (item.isOverdue) return KOT_ITEM_STYLES.overdue;
  if (item.kotStatus === "preparing") return KOT_ITEM_STYLES.preparing;
  return KOT_ITEM_STYLES.pending;
}

function statusLabel(item: FlatKdsItem) {
  if (item.isOverdue) return "Overdue";
  if (item.kotStatus === "preparing") return "Preparing";
  return "New";
}

export function KdsTableDetail({
  group,
  bumpingId,
  onBack,
  onStartPrep,
  onMarkReady,
}: {
  group: TableKOTGroup;
  bumpingId?: string | null;
  onBack: () => void;
  onStartPrep: (kotId: string) => void;
  onMarkReady: (kotId: string) => void;
}) {
  const phase = kdsTablePhase(group);
  const items = flattenGroupItems(group);
  const actionKotIds = new Set<string>();

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-5 py-3 bg-white/80 backdrop-blur-sm border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-xl hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4" /> Floor
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <div>
            <p className="font-semibold text-slate-900 flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-amber-600" />
              {group.tableLabel}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {kdsPhaseLabel(phase)} · {formatKdsElapsed(group.elapsedMin)} · {items.length} item{items.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-5 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-[1600px]">
          {items.map((item) => {
            const showActions = !actionKotIds.has(item.kotId);
            if (showActions) actionKotIds.add(item.kotId);
            return (
              <ItemTicketCard
                key={item.key}
                item={item}
                bumping={bumpingId === item.kotId}
                showActions={showActions}
                onStartPrep={() => onStartPrep(item.kotId)}
                onMarkReady={() => onMarkReady(item.kotId)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ItemTicketCard({
  item,
  bumping,
  showActions,
  onStartPrep,
  onMarkReady,
}: {
  item: FlatKdsItem;
  bumping: boolean;
  showActions: boolean;
  onStartPrep: () => void;
  onMarkReady: () => void;
}) {
  const style = itemStyle(item);

  return (
    <article className={`kds-item-ticket ${bumping ? "kds-item-bump" : ""}`}>
      <div className={`kds-item-accent ${style.accent}`} />
      <div className="p-4 flex flex-col min-h-[168px]">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.kotNumber}</p>
            <p className="text-[11px] text-slate-500 truncate">{item.orderNumber}</p>
          </div>
          <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${style.chip}`}>
            {statusLabel(item)}
          </span>
        </div>

        <div className="flex-1 flex items-center gap-3 py-2">
          <span className="text-3xl font-black tabular-nums text-amber-600 leading-none">{item.quantity}×</span>
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-900 leading-snug">{item.name}</p>
            {item.notes && <p className="text-xs text-slate-500 italic mt-1">{item.notes}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2 pt-3 border-t border-dashed border-slate-200">
          <Clock className="w-3 h-3" />
          {formatKdsElapsed(item.elapsedMin)} in kitchen
        </div>

        {showActions && item.kotStatus === "pending" && (
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={onStartPrep} className="role-action-kot flex-1 min-h-11 py-2.5 text-sm">
              Start prep
            </button>
            <button type="button" onClick={onMarkReady} className="role-action-ready flex-1 min-h-11 py-2.5 text-sm">
              Ready
            </button>
          </div>
        )}
        {showActions && item.kotStatus === "preparing" && (
          <button type="button" onClick={onMarkReady} className="role-action-ready w-full min-h-11 py-2.5 mt-3">
            Mark ready
          </button>
        )}
      </div>
    </article>
  );
}
