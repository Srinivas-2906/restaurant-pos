import type { TableWithOrder } from "./types";

export type TablePhase = "free" | "ordering" | "kitchen" | "bill_printed" | "reserved" | "blocked";

export function deriveTablePhase(table: TableWithOrder): TablePhase {
  if (table.status === "blocked") return "blocked";
  if (table.status === "reserved") return "reserved";
  if (!table.activeOrder) return "free";
  if (table.activeOrder.status === "billed" || table.status === "billed") return "bill_printed";
  if (table.activeOrder.pendingKot > 0) return "ordering";
  if (table.activeOrder.inKitchen > 0 || table.activeOrder.status === "kot_fired") return "kitchen";
  return "ordering";
}

export function phaseLabel(phase: TablePhase): string {
  switch (phase) {
    case "free":
      return "Available";
    case "ordering":
      return "Ordering";
    case "kitchen":
      return "In kitchen";
    case "bill_printed":
      return "Bill printed";
    case "reserved":
      return "Reserved";
    case "blocked":
      return "Blocked";
  }
}

export function formatElapsed(mins: number): string {
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
