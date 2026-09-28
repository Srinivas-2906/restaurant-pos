import type { PendingSyncOrderSummary } from "./posLocalStore";

export type PendingOutboxSummary = {
  operationType: string;
  status: string;
  label: string;
};

export function labelOutboxOperation(operationType: string): string {
  switch (operationType) {
    case "CREATE_ORDER":
      return "Create order";
    case "ADD_ITEM":
      return "Add item";
    case "FIRE_KOT":
      return "Fire KOT";
    case "SETTLE":
      return "Settle bill";
    default:
      return operationType.replaceAll("_", " ").toLowerCase();
  }
}

export function formatPendingSyncHeadline(summary: PendingSyncOrderSummary): string {
  const method = summary.paymentMethod?.toUpperCase() ?? "CASH";
  return `${method} sale ${formatInrShort(summary.paymentAmount ?? summary.totalAmount)} — waiting to sync`;
}

function formatInrShort(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function formatPendingSyncMeta(summary: PendingSyncOrderSummary): string {
  const when = new Date(summary.occurredAt).toLocaleString("en-IN");
  return `${summary.itemCount} item${summary.itemCount === 1 ? "" : "s"} · ${summary.orderNumber} · ${when}`;
}
