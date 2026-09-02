export type CaptainTablePhase = "free" | "ordering" | "kitchen" | "ready_to_serve" | "serving";

export function captainTablePhase(activeOrder?: {
  inKitchen?: number;
  readyCount?: number;
  servedCount?: number;
  pendingKot?: number;
} | null): CaptainTablePhase {
  if (!activeOrder) return "free";
  const ready = activeOrder.readyCount ?? 0;
  const cooking = activeOrder.inKitchen ?? 0;
  const served = activeOrder.servedCount ?? 0;
  const pending = activeOrder.pendingKot ?? 0;

  if (ready > 0) return "ready_to_serve";
  if (cooking > 0) return "kitchen";
  if (served > 0 && ready === 0 && cooking === 0) return "serving";
  if (pending > 0) return "ordering";
  return "ordering";
}

export const CAPTAIN_TABLE_STYLES: Record<CaptainTablePhase, { card: string; dot: string; label: string; ring: string }> = {
  free: {
    card: "bg-emerald-50 border-emerald-200 opacity-70",
    dot: "bg-emerald-500",
    label: "text-emerald-700",
    ring: "ring-emerald-200",
  },
  ordering: {
    card: "bg-orange-50 border-orange-300",
    dot: "bg-orange-500",
    label: "text-orange-700",
    ring: "ring-orange-200",
  },
  kitchen: {
    card: "bg-amber-50 border-amber-300",
    dot: "bg-amber-500",
    label: "text-amber-800",
    ring: "ring-amber-200",
  },
  ready_to_serve: {
    card: "bg-emerald-50 border-emerald-400",
    dot: "bg-emerald-500",
    label: "text-emerald-800",
    ring: "ring-emerald-300",
  },
  serving: {
    card: "bg-teal-50 border-teal-300",
    dot: "bg-teal-500",
    label: "text-teal-800",
    ring: "ring-teal-200",
  },
};

export function captainPhaseLabel(phase: CaptainTablePhase): string {
  switch (phase) {
    case "free":
      return "Available";
    case "ordering":
      return "Ordering";
    case "kitchen":
      return "In kitchen";
    case "ready_to_serve":
      return "Ready to serve";
    case "serving":
      return "Serving";
  }
}
