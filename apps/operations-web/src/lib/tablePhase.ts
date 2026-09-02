export interface TableActiveOrder {
  status: string;
  pendingKot?: number;
  inKitchen?: number;
  readyCount?: number;
  servedCount?: number;
  allReady?: boolean;
}

export interface FloorTableInput {
  status?: string;
  activeOrder?: TableActiveOrder | null;
}

export type TableDisplayPhase =
  | "free"
  | "ordering"
  | "kitchen"
  | "ready_to_serve"
  | "serving"
  | "billed"
  | "reserved"
  | "blocked"
  | "cleaning";

export function deriveTableDisplayPhase(table: FloorTableInput): TableDisplayPhase {
  if (table.status === "blocked") return "blocked";
  if (table.status === "cleaning") return "cleaning";
  if (table.status === "reserved" && !table.activeOrder) return "reserved";
  if (!table.activeOrder) return "free";

  const order = table.activeOrder;
  if (order.status === "billed" || table.status === "billed") return "billed";

  const readyCount = order.readyCount ?? 0;
  const inKitchen = order.inKitchen ?? 0;
  const servedCount = order.servedCount ?? 0;
  const pendingKot = order.pendingKot ?? 0;

  if (pendingKot > 0) return "ordering";
  if (servedCount > 0 && (readyCount > 0 || inKitchen > 0)) return "serving";
  if (order.allReady || (readyCount > 0 && inKitchen === 0 && servedCount === 0)) return "ready_to_serve";
  if (inKitchen > 0 || order.status === "kot_fired" || order.status === "preparing") return "kitchen";
  if (readyCount > 0) return "ready_to_serve";
  if (servedCount > 0) return "serving";
  return "ordering";
}

export function tableDisplayLabel(phase: TableDisplayPhase): string {
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
    case "billed":
      return "Bill printed";
    case "reserved":
      return "Reserved";
    case "blocked":
      return "Blocked";
    case "cleaning":
      return "Cleaning";
  }
}

export function isTableActive(table: FloorTableInput): boolean {
  return deriveTableDisplayPhase(table) !== "free";
}
