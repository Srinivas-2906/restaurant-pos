import React from "react";
import { colors } from "../tokens";
import { formatCurrency, TABLE_STATUS_COLORS } from "../utils";

export function SyncBadge({ status }: { status: "online" | "degraded" | "offline" }) {
  const map = {
    online: { label: "Synced", color: colors.sync.online },
    degraded: { label: "Syncing", color: colors.sync.degraded },
    offline: { label: "Offline", color: colors.sync.offline },
  };
  const s = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-gray-900 text-white">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
      {s.label}
    </span>
  );
}

export function TableCard({ number, status, capacity, guestCount, onClick, selected }: {
  number: string; status: string; capacity: number; guestCount?: number;
  onClick?: () => void; selected?: boolean;
}) {
  const cls = TABLE_STATUS_COLORS[status] ?? TABLE_STATUS_COLORS.free;
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border-2 p-4 text-left transition-all hover:scale-[1.02] ${cls} ${selected ? "ring-2 ring-orange-500 ring-offset-2" : ""}`}
    >
      <p className="text-lg font-bold">{number}</p>
      <p className="text-xs capitalize opacity-75">{status.replace("_", " ")}</p>
      <p className="text-xs mt-1">{guestCount ?? 0}/{capacity} guests</p>
    </button>
  );
}

export function MenuItemGrid({ items, onSelect }: {
  items: Array<{ id: string; name: string; price: number; isVeg?: boolean; isAvailable?: boolean }>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => item.isAvailable !== false && onSelect(item.id)}
          disabled={item.isAvailable === false}
          className={`relative p-3 rounded-lg border text-left h-[72px] ${
            item.isAvailable === false ? "opacity-40 line-through bg-gray-100" : "bg-white hover:border-orange-400"
          }`}
        >
          <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${item.isVeg ? "bg-green-500" : "bg-red-500"}`} />
          <p className="font-medium text-sm truncate pr-3">{item.name}</p>
          <p className="text-orange-600 font-semibold text-sm mt-1">{formatCurrency(item.price)}</p>
        </button>
      ))}
    </div>
  );
}

export function OrderCart({ items, total, onQtyChange, onFire, onPay }: {
  items: Array<{ id: string; name: string; quantity: number; totalPrice: number }>;
  total: number;
  onQtyChange?: (id: string, qty: number) => void;
  onFire?: () => void;
  onPay?: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-gray-50 border-l">
      <div className="p-3 border-b font-semibold">Order ({items.length})</div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between items-center bg-white p-2 rounded-lg text-sm">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-gray-500">{formatCurrency(item.totalPrice)}</p>
            </div>
            {onQtyChange && (
              <div className="flex items-center gap-2">
                <button className="w-7 h-7 rounded bg-gray-200" onClick={() => onQtyChange(item.id, item.quantity - 1)}>-</button>
                <span>{item.quantity}</span>
                <button className="w-7 h-7 rounded bg-gray-200" onClick={() => onQtyChange(item.id, item.quantity + 1)}>+</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="p-3 border-t space-y-2">
        <div className="flex justify-between font-bold text-lg">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
        {onFire && <button onClick={onFire} className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium">Fire KOT</button>}
        {onPay && <button onClick={onPay} className="w-full py-3 bg-orange-600 text-white rounded-lg font-medium">Settle Bill</button>}
      </div>
    </div>
  );
}

export function KOTPreviewCard({ station, items, kotNumber }: {
  station: string; kotNumber: string;
  items: Array<{ name: string; quantity: number }>;
}) {
  return (
    <div className="border rounded-lg p-3">
      <div className="flex justify-between mb-2">
        <span className="font-semibold">{station}</span>
        <span className="text-sm text-gray-500">{kotNumber}</span>
      </div>
      <ul className="text-sm space-y-1">
        {items.map((i, idx) => <li key={idx}>{i.quantity}x {i.name}</li>)}
      </ul>
    </div>
  );
}
