import type { TableWithOrder } from "./types";

export type TablePhase = "free" | "ordering" | "kitchen" | "ready_to_serve" | "serving" | "bill_printed" | "reserved" | "blocked" | "cleaning";

export function deriveTablePhase(table: TableWithOrder): TablePhase {
  if (table.status === "blocked") return "blocked";
  if (table.status === "cleaning") return "cleaning";
  if (table.status === "reserved") return "reserved";
  if (table.status === "bill_requested") return "bill_printed";
  if (!table.activeOrder) return "free";
  if (table.activeOrder.status === "billed" || table.status === "billed") return "bill_printed";
  if (table.activeOrder.pendingKot > 0) return "ordering";
  const readyCount = table.activeOrder.readyCount ?? 0;
  const inKitchen = table.activeOrder.inKitchen ?? 0;
  const servedCount = table.activeOrder.servedCount ?? 0;
  if (servedCount > 0 && (readyCount > 0 || inKitchen > 0)) return "serving";
  if (table.activeOrder.allReady || (readyCount > 0 && inKitchen === 0 && servedCount === 0)) return "ready_to_serve";
  if (inKitchen > 0 || table.activeOrder.status === "kot_fired" || table.activeOrder.status === "preparing") {
    return "kitchen";
  }
  if (readyCount > 0) return "ready_to_serve";
  if (servedCount > 0) return "serving";
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
    case "ready_to_serve":
      return "Ready";
    case "serving":
      return "Serving";
    case "bill_printed":
      return "Bill requested";
    case "reserved":
      return "Reserved";
    case "cleaning":
      return "Needs cleaning";
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

export function itemKitchenLabel(status: string): { text: string; className: string } | null {
  switch (status) {
    case "kot_fired":
      return { text: "Cooking", className: "text-amber-400" };
    case "preparing":
      return { text: "Preparing", className: "text-yellow-400" };
    case "ready":
      return { text: "Ready", className: "text-emerald-400" };
    case "served":
      return { text: "Served", className: "text-sky-400" };
    default:
      return null;
  }
}
