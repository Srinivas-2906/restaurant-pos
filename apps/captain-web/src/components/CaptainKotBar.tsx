"use client";

import type { OrderDto } from "@kaana/shared-types";

export function CaptainKotBar({
  order,
  onFire,
  firing,
}: {
  order: OrderDto;
  onFire: () => void;
  firing?: boolean;
}) {
  const pendingCount = order.items.filter((i) => !i.kotId && i.status === "pending").length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {order.kots?.map((kot) => (
        <span key={kot.id} className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">
          {kot.kotNumber} · {kot.status}
        </span>
      ))}
      <button
        type="button"
        disabled={pendingCount === 0 || firing}
        onClick={onFire}
        className="ml-auto px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold disabled:opacity-50"
      >
        {firing ? "Sending…" : pendingCount > 0 ? `Send KOT (${pendingCount})` : "All items sent"}
      </button>
    </div>
  );
}
