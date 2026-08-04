import React from "react";
import { colors } from "../tokens";

export function KOTCard({ kotNumber, table, source, items, status, elapsedMin, onBump }: {
  kotNumber: string; table?: string; source?: string;
  items: Array<{ name: string; quantity: number }>;
  status: "pending" | "preparing" | "ready";
  elapsedMin: number;
  onBump?: () => void;
}) {
  const statusColor = status === "ready" ? colors.kds.ready : status === "preparing" ? colors.kds.preparing : colors.kds.new;
  const overdue = elapsedMin > 15;
  return (
    <div className={`rounded-xl border-2 p-4 min-w-[280px] ${overdue ? "border-red-500 bg-red-50" : "bg-white"}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-xl font-bold">{kotNumber}</p>
          <p className="text-sm text-gray-500">{table ? `Table ${table}` : source ?? "Takeaway"}</p>
        </div>
        <div className="text-right">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: statusColor }} />
          <p className={`text-2xl font-mono font-bold mt-1 ${overdue ? "text-red-600" : ""}`}>{elapsedMin}m</p>
        </div>
      </div>
      <ul className="space-y-1 mb-4">
        {items.map((i, idx) => (
          <li key={idx} className="text-lg font-medium">{i.quantity}x {i.name}</li>
        ))}
      </ul>
      {onBump && (
        <button onClick={onBump} className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold text-lg">
          {status === "pending" ? "Start Prep" : "Mark Ready"}
        </button>
      )}
    </div>
  );
}

export function AggregatedItemRow({ name, quantity, onBump }: {
  name: string; quantity: number; onBump?: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-xl border mb-2">
      <div>
        <p className="text-2xl font-bold">{quantity}x</p>
        <p className="text-lg">{name}</p>
      </div>
      {onBump && (
        <button onClick={onBump} className="px-6 py-3 bg-orange-600 text-white rounded-lg font-medium">Bump</button>
      )}
    </div>
  );
}

export function StationSelector({ stations, onSelect }: {
  stations: Array<{ id: string; name: string; code: string }>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 p-6">
      {stations.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className="p-8 bg-gray-900 text-white rounded-2xl text-2xl font-bold hover:bg-orange-600 transition-colors"
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}
