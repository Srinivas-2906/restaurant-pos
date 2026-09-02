import type { TableKOTGroup } from "@kaana/ui";

export type KdsTablePhase = "pending" | "preparing" | "overdue";

export function kdsTablePhase(group: TableKOTGroup): KdsTablePhase {
  if (group.elapsedMin > 15) return "overdue";
  if (group.worstStatus === "preparing") return "preparing";
  return "pending";
}

/** Soft tiles — accent via dot/label, not heavy borders */
export const KDS_TABLE_STYLES: Record<KdsTablePhase, { card: string; dot: string; label: string; ring: string; accent: string }> = {
  pending: {
    card: "bg-white",
    dot: "bg-orange-500",
    label: "text-orange-600",
    ring: "ring-orange-100",
    accent: "from-orange-400 to-orange-500",
  },
  preparing: {
    card: "bg-white",
    dot: "bg-amber-500",
    label: "text-amber-700",
    ring: "ring-amber-100",
    accent: "from-amber-400 to-amber-500",
  },
  overdue: {
    card: "bg-white",
    dot: "bg-red-500",
    label: "text-red-600",
    ring: "ring-red-100",
    accent: "from-red-400 to-red-500",
  },
};

export type KotItemStatus = "pending" | "preparing";

export const KOT_ITEM_STYLES: Record<KotItemStatus | "overdue", { accent: string; chip: string }> = {
  pending: { accent: "bg-orange-500", chip: "bg-orange-50 text-orange-700" },
  preparing: { accent: "bg-amber-500", chip: "bg-amber-50 text-amber-800" },
  overdue: { accent: "bg-red-500", chip: "bg-red-50 text-red-700" },
};

export function kdsPhaseLabel(phase: KdsTablePhase): string {
  switch (phase) {
    case "pending":
      return "New ticket";
    case "preparing":
      return "Preparing";
    case "overdue":
      return "Overdue";
  }
}

export function formatKdsElapsed(mins: number): string {
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export interface FlatKdsItem {
  key: string;
  kotId: string;
  kotNumber: string;
  kotStatus: string;
  orderNumber: string;
  elapsedMin: number;
  quantity: number;
  name: string;
  notes?: string | null;
  isOverdue: boolean;
}

/** One card per line item — sorted by wait time */
export function flattenGroupItems(group: TableKOTGroup): FlatKdsItem[] {
  const items: FlatKdsItem[] = [];
  for (const order of group.orders) {
    for (const kot of order.kots) {
      for (const line of kot.items) {
        items.push({
          key: `${kot.id}-${line.orderItem.id}`,
          kotId: kot.id,
          kotNumber: kot.kotNumber,
          kotStatus: kot.status,
          orderNumber: order.orderNumber,
          elapsedMin: order.elapsedMin,
          quantity: line.quantity,
          name: line.orderItem.name,
          notes: line.orderItem.notes,
          isOverdue: order.elapsedMin > 15,
        });
      }
    }
  }
  return items.sort((a, b) => b.elapsedMin - a.elapsedMin);
}
