"use client";

import type { OrderDto } from "@kaana/shared-types";
import { notify } from "@kaana/ui";
import { formatInr } from "@/lib/api";

const SERVE_ACCENTS: Record<string, { accent: string; chip: string }> = {
  ready: { accent: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
  kot_fired: { accent: "bg-amber-500", chip: "bg-amber-50 text-amber-800" },
  preparing: { accent: "bg-amber-500", chip: "bg-amber-50 text-amber-800" },
  served: { accent: "bg-sky-400", chip: "bg-sky-50 text-sky-700" },
};

export function CaptainServePanel({
  order,
  onMarkServed,
  busy,
}: {
  order: OrderDto;
  onMarkServed: (itemId: string) => void;
  busy?: string | null;
}) {
  const kitchenItems = order.items.filter((i) => i.kotId);

  if (kitchenItems.length === 0) {
    return <p className="text-slate-500 text-center py-8">No kitchen items on this order yet.</p>;
  }

  return (
    <div className="space-y-2">
      {kitchenItems.map((item) => {
        const accent = SERVE_ACCENTS[item.status] ?? SERVE_ACCENTS.kot_fired;
        const isReady = item.status === "ready";
        return (
          <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white">
            <div className={`w-1 h-12 rounded-full ${accent.accent}`} />
            <div className="flex-1 min-w-0">
              <p className="font-medium">{item.quantity}× {item.name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${accent.chip}`}>{item.status.replace("_", " ")}</span>
            </div>
            {isReady && (
              <button
                type="button"
                disabled={busy === item.id}
                onClick={() => onMarkServed(item.id)}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {busy === item.id ? "…" : "Served"}
              </button>
            )}
          </div>
        );
      })}
      <p className="text-xs text-slate-500 text-center pt-2">Order total {formatInr(order.totalAmount)}</p>
    </div>
  );
}

export async function handleServeError(err: unknown) {
  notify.error(err instanceof Error ? err.message : "Could not mark item served");
}
