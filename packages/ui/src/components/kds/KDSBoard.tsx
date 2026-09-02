"use client";

import React, { useMemo, useState } from "react";
import { groupKotsByTable, type KdsQueueItem } from "./group-kots-by-table";
import { TableTicketTile } from "./TableTicketTile";

export type KdsBoardFilter = "all" | "pending" | "preparing";

export function KDSBoard({
  kots,
  bumpingId,
  onStartPrep,
  onMarkReady,
}: {
  kots: KdsQueueItem[];
  bumpingId?: string | null;
  onStartPrep: (kotId: string) => void;
  onMarkReady: (kotId: string) => void;
}) {
  const [filter, setFilter] = useState<KdsBoardFilter>("all");
  const groups = groupKotsByTable(kots);

  const pendingCount = kots.filter((k) => k.status === "pending").length;
  const preparingCount = kots.filter((k) => k.status === "preparing").length;

  const filteredGroups = useMemo(() => {
    if (filter === "all") return groups;
    return groups.filter((g) => g.kots.some((k) => k.status === filter));
  }, [groups, filter]);

  if (groups.length === 0) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-24 text-gray-500">
        <p className="text-xl font-medium">Kitchen is clear</p>
        <p className="text-sm mt-2">New tickets appear here when POS fires KOT</p>
      </div>
    );
  }

  const tabs: { id: KdsBoardFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: groups.length },
    { id: "pending", label: "Pending", count: pendingCount },
    { id: "preparing", label: "Preparing", count: preparingCount },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500" /> Pending
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Preparing
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 ring-1 ring-red-500/50" /> Overdue (&gt;15m)
          </span>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-gray-900 border border-gray-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === tab.id
                  ? "bg-orange-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {tab.label}
              {tab.id !== "all" && tab.count > 0 ? ` (${tab.count})` : tab.id === "all" ? ` (${tab.count})` : ""}
            </button>
          ))}
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <p className="text-center text-gray-500 py-12 text-sm">No tables match this filter</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredGroups.map((group) => (
            <TableTicketTile
              key={group.tableKey}
              group={group}
              bumpingId={bumpingId}
              onStartPrep={onStartPrep}
              onMarkReady={onMarkReady}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export type { KdsQueueItem };
