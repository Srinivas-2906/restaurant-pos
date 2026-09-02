"use client";

import { formatTime, TABLE_PHASE_STYLES } from "@/lib/api";
import type { FloorPlan } from "@/lib/types";

function tablePhase(table: FloorPlan["tables"][0]): string {
  if (table.status === "blocked") return "blocked";
  if (table.status === "cleaning") return "cleaning";
  if (table.status === "reserved") return "reserved";
  if (table.activeOrder) return "ordering";
  if (table.status === "billed") return "bill_printed";
  return table.status === "free" ? "free" : "ordering";
}

export function FloorView({ floor }: { floor: FloorPlan }) {
  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 text-xs text-slate-600">
        {Object.entries(TABLE_PHASE_STYLES).map(([phase, style]) => (
          <span key={phase} className="inline-flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-full ${style.dot}`} />
            {phase.replace("_", " ")}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {floor.tables.map((table) => {
          const phase = tablePhase(table);
          const style = TABLE_PHASE_STYLES[phase] ?? TABLE_PHASE_STYLES.free;
          const reservation = table.activeReservation ?? table.upcomingReservation;

          return (
            <div key={table.id} className={`rounded-2xl border-2 p-4 min-h-[100px] flex flex-col ${style.card}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-lg text-slate-900">T{table.number}</span>
                <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
              </div>
              <p className="text-xs text-slate-600 mt-1">{table.capacity} seats</p>
              {reservation && (
                <div className="mt-2 pt-2 border-t border-black/10 text-[11px] text-violet-900">
                  <p className="font-semibold truncate">{reservation.guestName}</p>
                  <p>{formatTime(reservation.date)} · {reservation.guestCount} guests</p>
                </div>
              )}
              {table.activeOrder ? (
                <p className="text-[10px] text-orange-700 mt-auto pt-2 font-semibold">Order active</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
