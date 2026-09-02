"use client";

import type { OrderDto } from "@kaana/shared-types";
import { formatInr } from "@/lib/api";

export function CaptainCart({
  order,
  onQtyChange,
  onRemove,
  disabled,
}: {
  order: OrderDto;
  onQtyChange: (itemId: string, qty: number) => void;
  onRemove: (itemId: string) => void;
  disabled?: boolean;
}) {
  const pending = order.items.filter((i) => !i.kotId && i.status === "pending");
  const fired = order.items.filter((i) => i.kotId || i.status !== "pending");

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-orange-600 mb-2">Not sent yet</p>
          <div className="space-y-2">
            {pending.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-orange-50 border border-orange-200">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-slate-500">{formatInr(item.totalPrice)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" disabled={disabled} className="w-7 h-7 rounded bg-white border" onClick={() => onQtyChange(item.id, item.quantity - 1)}>−</button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
                  <button type="button" disabled={disabled} className="w-7 h-7 rounded bg-white border" onClick={() => onQtyChange(item.id, item.quantity + 1)}>+</button>
                  <button type="button" disabled={disabled} className="ml-1 text-xs text-red-600" onClick={() => onRemove(item.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fired.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Sent to kitchen</p>
          <div className="space-y-1">
            {fired.map((item) => (
              <div key={item.id} className="flex justify-between text-sm py-1 border-b border-slate-100">
                <span>{item.quantity}× {item.name}</span>
                <span className="text-slate-500 capitalize">{item.status.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-2 border-t flex justify-between font-bold">
        <span>Total</span>
        <span>{formatInr(order.totalAmount)}</span>
      </div>
    </div>
  );
}
