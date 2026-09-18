import type { FloorTable } from "@kaana/api-client";

export type TablePhase = "free" | "occupied" | "kitchen" | "ready" | "bill_requested";

export function deriveTablePhase(table: FloorTable): TablePhase {
  if (table.status === "bill_requested") return "bill_requested";
  const ao = table.activeOrder;
  if (!ao) return table.status === "free" ? "free" : "occupied";
  if ((ao.readyCount ?? 0) > 0) return "ready";
  if ((ao.inKitchen ?? 0) > 0 || ao.status === "kot_fired" || ao.status === "preparing") return "kitchen";
  return "occupied";
}

export const TABLE_PHASE_LABEL: Record<TablePhase, string> = {
  free: "Available",
  occupied: "Open",
  kitchen: "In kitchen",
  ready: "Ready",
  bill_requested: "Bill requested",
};

export const TABLE_PHASE_COLOR: Record<TablePhase, { border: string; bg: string }> = {
  free: { border: "#cbd5e1", bg: "#ffffff" },
  occupied: { border: "#fdba74", bg: "#fffbeb" },
  kitchen: { border: "#fcd34d", bg: "#fefce8" },
  ready: { border: "#86efac", bg: "#ecfdf5" },
  bill_requested: { border: "#c4b5fd", bg: "#f5f3ff" },
};

export function collectReadyTables(tables: FloorTable[]) {
  return tables.filter((t) => (t.activeOrder?.readyCount ?? 0) > 0);
}
